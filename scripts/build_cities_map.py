#!/usr/bin/env python3
"""Build city points for the explorer map: public/data/cities-map.json.gz.

Source: Wikidata (CC0) — Polish towns (instance of a subclass of city Q515 or town Q3957) with a SIMC code,
coordinates and population (latest statement by date). The query result is cached in
data/maps/miasta-wikidata.csv (outside the repo); --fetch runs the query again.

Only towns that are the seat city of at least one provider in public/data/hospitalizations/<year>.json.gz
are written. Coordinates use the same projection and box as regions-map.json.gz (build_regions_map.py),
so a point can be drawn on the voivodeship map without a map library.

Output:
  {"version": 1, "source": ..., "viewBox": [w, h],
   "cities": [[NAZWA (wielkie litery, jak w danych NFZ), OW NFZ, x, y, ludność, rok ludności], ...]}

Usage:
  python3 scripts/build_cities_map.py [--fetch]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz
from build_regions_map import WIDTH, lonlat, project_regions

SOURCE_NOTE = "Wikidata (CC0): miasta, współrzędne i ludność"
SPARQL_URL = "https://query.wikidata.org/sparql"
QUERY = """
SELECT DISTINCT ?item ?name ?pop ?popDate ?coord WHERE {
  # Miasto (Q515) albo miasteczko (Q3957, np. Drezdenko) z kodem SIMC.
  { ?item wdt:P31/wdt:P279* wd:Q515 } UNION { ?item wdt:P31/wdt:P279* wd:Q3957 }
  ?item wdt:P4046 ?simc ; wdt:P17 wd:Q36 ; wdt:P625 ?coord .
  # Nazwa polska albo wielojęzyczna („mul”): część miast ma już tylko etykietę „mul”.
  OPTIONAL { ?item rdfs:label ?pl FILTER(lang(?pl) = "pl") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(lang(?mul) = "mul") }
  BIND(COALESCE(?pl, ?mul) AS ?name)
  FILTER(BOUND(?name))
  OPTIONAL { ?item p:P1082 ?ps . ?ps ps:P1082 ?pop . OPTIONAL { ?ps pq:P585 ?popDate } }
}
"""


def fetch(path: Path) -> None:
    url = f"{SPARQL_URL}?{urllib.parse.urlencode({'query': QUERY})}"
    request = urllib.request.Request(url, headers={"Accept": "text/csv", "User-Agent": "funduszdanych-build/1.0 (scripts/build_cities_map.py)"})
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(request, timeout=180) as response:
        path.write_bytes(response.read())


def towns(path: Path) -> dict[str, dict]:
    """Miasto → nazwa, współrzędne i najnowsza ludność (wpis z najpóźniejszą datą; bez daty = najstarszy)."""
    out: dict[str, dict] = {}
    for row in csv.DictReader(path.open(encoding="utf-8")):
        town = out.setdefault(row["item"], {"name": row["name"], "coord": row["coord"], "pop": None, "date": ""})
        if row["pop"] and (town["pop"] is None or (row["popDate"] or "") > town["date"]):
            town["pop"], town["date"] = int(float(row["pop"])), row["popDate"] or ""
    return out


def inside(point: tuple[float, float], ring: list[tuple[float, float]]) -> bool:
    """Punkt w wielokącie (promień w prawo)."""
    x, y = point
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def seat_cities() -> dict[str, set[str]]:
    """Miasta siedzib świadczeniodawców ze wszystkich lat → OW NFZ, w których rozliczają."""
    out: dict[str, set[str]] = defaultdict(set)
    for file in sorted((ROOT / "public" / "data" / "hospitalizations").glob("[0-9]*.json.gz")):
        for ow, _nip, _name, city in json.load(gzip.open(file))["facilities"]:
            out[city.strip().upper()].add(ow)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=ROOT / "data" / "maps" / "miasta-wikidata.csv")
    parser.add_argument("--regions", type=Path, default=ROOT / "data" / "maps" / "wojewodztwa-min.geojson")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "data" / "cities-map.json.gz")
    parser.add_argument("--fetch", action="store_true", help="pobierz miasta z Wikidata ponownie")
    args = parser.parse_args()

    if args.fetch or not args.source.exists():
        fetch(args.source)
    projected, to_box, height = project_regions(json.loads(args.regions.read_text(encoding="utf-8"))["features"])

    # Województwo miasta z położenia (punkt w granicach), nie z opisu: działa także bez kodu TERC.
    by_name: dict[str, list[tuple[str, float, float, int, str]]] = defaultdict(list)
    for town in towns(args.source).values():
        if town["pop"] is None:
            continue
        lon, lat = (float(v) for v in town["coord"].removeprefix("Point(").removesuffix(")").split())
        point = lonlat(lon, lat)
        ow = next((code for code, _, rings in projected if any(inside(point, ring) for ring in rings)), None)
        if ow:
            x, y = to_box(*point)
            by_name[town["name"].upper()].append((ow, x, y, town["pop"], town["date"][:4]))

    cities, missing = [], []
    for name, ows in sorted(seat_cities().items()):
        # Dzielnica w nazwie siedziby („WARSZAWA PRAGA-PÓŁNOC”, „POZNAŃ-WILDA”): punkt miasta.
        candidates = by_name.get(name) or next((by_name[part] for part in (name.split(" ")[0], name.split("-")[0]) if part in by_name and part != name), [])
        # Miasto o tej nazwie w województwie świadczeniodawcy; jedno miasto o tej nazwie w kraju — także poza nim.
        matched = [c for c in candidates if c[0] in ows] or (candidates if len(candidates) == 1 else [])
        if not matched:
            missing.append(name)
        for ow, x, y, pop, year in matched[:1]:
            cities.append([name, ow, round(x, 1), round(y, 1), pop, year])

    payload = {"version": 1, "source": SOURCE_NOTE, "viewBox": [WIDTH, height], "cities": cities}
    size = write_json_gz(args.output, payload)
    print(f"cities-map: {len(cities)} miast, bez dopasowania {len(missing)}, {size / 1024:.1f} KiB")
    if missing:
        print("bez dopasowania (wsie albo inne nazwy):", ", ".join(missing[:40]), "…" if len(missing) > 40 else "")


if __name__ == "__main__":
    main()
