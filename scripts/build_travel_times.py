#!/usr/bin/env python3
"""Build car travel times and road distances from population cells to provider seat cities.

Outputs: public/data/access/travel-times.json.gz (minutes) and public/data/access/road-km.json.gz (kilometres by road;
the browser loads it only in the "km" view).

Router: OSRM (Open Source Routing Machine) in Docker, car profile, on the OpenStreetMap extract of Poland
(ODbL; download.openstreetmap.fr mirror). Free-flow times: no traffic. Everything runs locally.

Inputs:
- origins: population cells from public/data/access/population.json.gz (build_access_population.py),
- destinations: provider seat cities from public/data/cities-map.json.gz (build_cities_map.py).

Steps (the slow ones are cached outside the repo in data/routing/):
1. --prepare: osrm-extract / osrm-partition / osrm-customize on data/routing/osrm/poland.osm.pbf (about 30–60 min,
   needs ~8+ GB RAM in Docker); --fetch-map downloads the extract again first.
2. --route: starts osrm-routed in Docker, asks the /table service in chunks, stops the container.
   The raw table is cached in data/routing/osrm-table.json.gz together with the input coordinates; without
   --route the cache is reused when the inputs did not change.
3. Writes minutes and kilometres rounded to whole numbers, capped at 255 (255 = 255 or more / no route).
   Both come from the same /table query (annotations=duration,distance), so km is the length of the fastest route.

Output:
  travel-times: {"version": 1, "source": ..., "router": ..., "cities": [NAZWA, ...], "origins": liczba skupisk,
                 "minutes": [skupisko 0 × miasta..., skupisko 1 × miasta..., ...]}   # płaska tablica, wiersz = skupisko
  road-km:      {"version": 1, ..., "km": [...]}                                     # ten sam układ

The browser takes, for every cell, the first open city (filters, simulation) — so one table serves every ward.

Usage:
  python3 scripts/build_travel_times.py [--prepare] [--route] [--fetch-map]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import subprocess
import time
import urllib.request
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz
from build_regions_map import LAT0, project_regions

IMAGE = "ghcr.io/project-osrm/osrm-backend:v6.0.0"
CONTAINER = "funduszdanych-osrm"
PORT = 5055
MAP_URL = "https://download.openstreetmap.fr/extracts/europe/poland-latest.osm.pbf"
SOURCE_NOTE = "OSRM 6.0, profil car, mapa OpenStreetMap (ODbL); czas przejazdu bez korków"
CHUNK = 150  # skupisk w jednym zapytaniu /table
CAP = 255


def docker(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["docker", *args], check=check, capture_output=True, text=True)


def prepare(osrm_dir: Path, fetch_map: bool) -> None:
    pbf = osrm_dir / "poland.osm.pbf"
    if fetch_map or not pbf.exists():
        osrm_dir.mkdir(parents=True, exist_ok=True)
        print("pobieranie mapy Polski (ok. 2,4 GB)…", flush=True)
        subprocess.run(["curl", "-sSL", "-C", "-", "--retry", "5", "-o", str(pbf), MAP_URL], check=True)
    # 4 wątki: szczyt pamięci ok. 7,8 GB (więcej wątków przekracza domyślne 8 GB Dockera i extract kończy się bez .ebg).
    for step in (["osrm-extract", "--threads", "4", "-p", "/opt/car.lua", "/data/poland.osm.pbf"],
                 ["osrm-partition", "/data/poland.osrm"], ["osrm-customize", "/data/poland.osrm"]):
        print(" ".join(step), flush=True)
        t0 = time.time()
        subprocess.run(["docker", "run", "--rm", "-v", f"{osrm_dir}:/data", IMAGE, *step], check=True)
        print(f"  {time.time() - t0:.0f} s", flush=True)


def to_lonlat(regions: Path):
    """Odwrotność rzutu mapy (build_regions_map): jednostki mapy → (lon, lat)."""
    _, to_box, _ = project_regions(json.loads(regions.read_text(encoding="utf-8"))["features"])
    x0, y0 = to_box(0, 0)
    x1, _ = to_box(1, 0)
    scale = x1 - x0
    return lambda x, y: ((x - x0) / scale / math.cos(LAT0), -((y - y0) / scale))


def route(osrm_dir: Path, origins: list[tuple[float, float]], dests: list[tuple[float, float]]):
    """Zwraca (czasy w s, odległości w m): wiersz = skupisko, kolumna = miasto."""
    docker("rm", "-f", CONTAINER, check=False)
    docker("run", "-d", "--rm", "--name", CONTAINER, "-p", f"{PORT}:5000", "-v", f"{osrm_dir}:/data", IMAGE,
           "osrm-routed", "--algorithm", "mld", "--max-table-size", "100000", "/data/poland.osrm")
    try:
        for _ in range(120):  # serwer wczytuje graf
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{PORT}/nearest/v1/driving/21.0,52.2", timeout=5)
                break
            except OSError:
                time.sleep(2)
        dest_part = ";".join(f"{lon:.5f},{lat:.5f}" for lon, lat in dests)
        table: list[list[float | None]] = []
        lengths: list[list[float | None]] = []
        snap_max = 0.0
        for start in range(0, len(origins), CHUNK):
            chunk = origins[start:start + CHUNK]
            coords = ";".join(f"{lon:.5f},{lat:.5f}" for lon, lat in chunk) + ";" + dest_part
            sources = ";".join(str(i) for i in range(len(chunk)))
            destinations = ";".join(str(len(chunk) + j) for j in range(len(dests)))
            url = f"http://127.0.0.1:{PORT}/table/v1/driving/{coords}?sources={sources}&destinations={destinations}&annotations=duration,distance"
            with urllib.request.urlopen(url, timeout=600) as response:
                result = json.load(response)
            if result.get("code") != "Ok":
                raise SystemExit(f"OSRM: {result.get('code')} {result.get('message')}")
            table.extend(result["durations"])
            lengths.extend(result["distances"])
            snap_max = max(snap_max, *(s["distance"] for s in result["sources"]))
            print(f"  skupiska {min(start + CHUNK, len(origins))}/{len(origins)}", flush=True)
        print(f"największe przyciągnięcie skupiska do drogi: {snap_max:.0f} m", flush=True)
        return table, lengths
    finally:
        docker("stop", CONTAINER, check=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--osrm-dir", type=Path, default=ROOT / "data" / "routing" / "osrm")
    parser.add_argument("--cache", type=Path, default=ROOT / "data" / "routing" / "osrm-table.json.gz")
    parser.add_argument("--population", type=Path, default=ROOT / "public" / "data" / "access" / "population.json.gz")
    parser.add_argument("--cities", type=Path, default=ROOT / "public" / "data" / "cities-map.json.gz")
    parser.add_argument("--regions", type=Path, default=ROOT / "data" / "maps" / "wojewodztwa-min.geojson")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "data" / "access" / "travel-times.json.gz")
    parser.add_argument("--km-output", type=Path, default=ROOT / "public" / "data" / "access" / "road-km.json.gz")
    parser.add_argument("--prepare", action="store_true", help="przygotuj graf OSRM (extract, partition, customize)")
    parser.add_argument("--fetch-map", action="store_true", help="pobierz mapę Polski z OpenStreetMap ponownie")
    parser.add_argument("--route", action="store_true", help="policz tabelę czasów ponownie (Docker)")
    args = parser.parse_args()

    if args.prepare or args.fetch_map:
        prepare(args.osrm_dir, args.fetch_map)
    unproject = to_lonlat(args.regions)
    population = json.load(gzip.open(args.population))
    cities = json.load(gzip.open(args.cities))["cities"]
    origins = [unproject(x, y) for x, y, _people, _powiat in population["cells"]]
    dests = [unproject(x, y) for _name, _ow, x, y, _pop, _year in cities]
    key = hashlib.sha256(json.dumps([[round(v, 5) for v in p] for p in origins + dests]).encode()).hexdigest()

    cached = json.load(gzip.open(args.cache)) if args.cache.exists() else None
    if args.route or not cached or cached.get("key") != key or "distances" not in cached:
        if not (args.osrm_dir / "poland.osrm.mldgr").exists():
            # Bez Dockera i grafu (np. w npm run generate:data na innym komputerze) zostaje plik z repo;
            # verify-static.mjs sprawdzi, czy pasuje do skupisk ludności i listy miast.
            if not args.route and args.output.exists() and args.km_output.exists():
                print("access/travel-times: brak grafu OSRM i tabeli w cache — zostaje istniejący plik "
                      "(nowe czasy: python3 scripts/build_travel_times.py --prepare)")
                return
            raise SystemExit("brak grafu OSRM: uruchom z --prepare (wymaga Dockera)")
        table, lengths = route(args.osrm_dir, origins, dests)
        args.cache.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(args.cache, "wt", encoding="utf-8") as fh:
            json.dump({"key": key, "router": IMAGE, "durations": table, "distances": lengths}, fh)
    else:
        table, lengths = cached["durations"], cached["distances"]

    def flat(rows: list[list[float | None]], unit: float) -> tuple[list[int], int]:
        values: list[int] = []
        missing = 0
        for row in rows:
            for v in row:
                if v is None:
                    missing += 1
                    values.append(CAP)
                else:
                    values.append(min(CAP, round(v / unit)))
        return values, missing

    minutes, unreachable = flat(table, 60)
    km, _ = flat(lengths, 1000)
    payload = {"version": 1, "source": SOURCE_NOTE, "router": IMAGE, "cities": [c[0] for c in cities],
               "origins": len(origins), "minutes": minutes}
    size = write_json_gz(args.output, payload)
    km_size = write_json_gz(args.km_output, {"version": 1, "source": SOURCE_NOTE.replace("czas przejazdu bez korków", "długość najszybszej trasy"),
                                            "router": IMAGE, "cities": payload["cities"], "origins": len(origins), "km": km})
    print(f"access/travel-times: {len(origins)} skupisk × {len(cities)} miast, bez trasy {unreachable}, {size / 1024:.0f} KiB; "
          f"road-km {km_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
