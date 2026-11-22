#!/usr/bin/env python3
"""Build the population model for the ward map (travel time to the nearest facility).

Outputs (public/data/access/):
- population.json.gz — powiaty, gminy with age × sex structure, population cells (origins for travel times),
- gminy-map.json.gz — gmina boundaries as SVG paths (the map loads them only for the gmina view).

Sources (cached outside the repo in data/maps/gminy/; --fetch downloads them again):
- gmina and powiat boundaries: PRG, GUGiK (open data), WFS service AdministrativeBoundaries
  (layers A03_Granice_gmin, A02_Granice_powiatow), simplified when cached,
- population by sex and economic age group per gmina: GUS, Bank Danych Lokalnych (API BDL, subjects P1342, P2137;
  no key: 100 requests per 15 min, so the first download takes about an hour; BDL_API_KEY speeds it up),
- towns with coordinates and population: data/maps/miasta-wikidata.csv (build_cities_map.py),
- powiat seats: Wikidata (CC0), data/maps/powiaty/powiaty-siedziby.csv.

Model: every town is a population point inside its gmina; the rest of the gmina population is spread evenly
over a grid (GRID_KM) inside the gmina. Points are grouped into cells (gmina × CELL_KM square), weighted by
population; a cell is one origin for travel times (build_travel_times.py). Each cell takes the age × sex
structure of its gmina. A city with powiat rights is joined with the powiat whose seat it is (e.g. powiat
suwalski + Suwałki) into one assessment unit.

Age groups follow the hospitalization files (GRUPA_WIEKOWA_PACJENTA): 0-17, 18-44, 45-64, 65+.
GUS economic age groups match them exactly (women 60-64 moved from post-working age to 45-64).

Output population.json.gz:
  {"version": 2, "source": ..., "year": rok danych GUS, "viewBox": [w, h], "kmPerUnit": ..., "cellKm": ...,
   "groups": ["M 0-17", ..., "K 65+"],
   "powiaty": [[nazwa, OW NFZ, ludność, ścieżka SVG, indeks jednostki oceny, TERYT], ...],
   "gminy": [[nazwa, TERYT (7 znaków), indeks powiatu, ludność, [8 grup płeć × wiek]], ...],
   "cells": [[x, y, ludność, indeks gminy], ...]}
Output gminy-map.json.gz: {"version": 1, "paths": [ścieżka SVG gminy, ...]} (kolejność jak "gminy").

Usage:
  python3 scripts/build_access_population.py [--fetch] [--year 2025]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz
from build_regions_map import LAT0, WIDTH, project_regions

SOURCE_NOTE = ("Granice gmin i powiatów: PRG, GUGiK; ludność wg płci i wieku: GUS, Bank Danych Lokalnych; "
               "miasta i siedziby powiatów: Wikidata (CC0)")
WFS_URL = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
WFS_LAYERS = {"gminy": "ms:A03_Granice_gmin", "powiaty": "ms:A02_Granice_powiatow"}
WFS_PAGE = 100
BDL_URL = "https://bdl.stat.gov.pl/api/v1/data/by-variable/{var}?unit-level=6&year={year}&page-size=100&page={page}&format=json"
# Zmienne BDL: ekonomiczne grupy wieku wg płci (P1342) pokrywają się z grupami plików hospitalizacji
# (przedprodukcyjny 0-17, mobilny 18-44, niemobilny 45-64 / kobiety 45-59, poprodukcyjny 65+ / kobiety 60+);
# kobiety 60-64 (P2137) przesuwamy z poprodukcyjnego do 45-64.
BDL_VARS = {"M 0-17": 150, "M 18-44": 148539, "M 45-64": 148538, "M 65+": 156,
            "K 0-17": 151, "K 18-44": 148541, "K 45-59": 148540, "K 60+": 157, "K 60-64": 47693}
GROUPS = [f"{sex} {age}" for sex in ("M", "K") for age in ("0-17", "18-44", "45-64", "65+")]
SIMPLIFY_DEG = 0.0015  # uproszczenie granic w cache (ok. 100–170 m)
GRID_KM = 3.0
CELL_KM = 12.0
USER_AGENT = "funduszdanych-build/1.0 (scripts/build_access_population.py)"


def http_get(url: str, timeout: int = 300, headers: dict[str, str] | None = None) -> bytes:
    for attempt in range(6):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 and error.code < 500:
                raise
            # BDL po przekroczeniu limitu odpowiada 429 albo stroną blokady (500): czekamy dłużej.
            wait = 120 * (attempt + 1) if error.code in (429, 500) and "bdl.stat" in url else 10
        except OSError:
            wait = 10
        print(f"  ponowienie za {wait} s: {url[:90]}", flush=True)
        time.sleep(wait)
    raise SystemExit(f"nie udało się pobrać: {url}")


def simplify_ring(ring: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas–Peucker (iteracyjnie) dla zamkniętego pierścienia."""
    if len(ring) < 8:
        return ring
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    while stack:
        a, b = stack.pop()
        (xa, ya), (xb, yb) = ring[a], ring[b]
        dx, dy = xb - xa, yb - ya
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            x, y = ring[i]
            d = abs(dy * (x - xa) - dx * (y - ya)) / norm if (dx or dy) else math.hypot(x - xa, y - ya)
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    out = [p for p, k in zip(ring, keep) if k]
    return out if len(out) >= 4 else ring


def fetch_prg(layer: str, path: Path) -> None:
    """Granice z WFS PRG (GML 3.2, EPSG:4326 = szerokość, długość) → uproszczony GeoJSON z kodem TERYT."""
    ns = {"gml": "http://www.opengis.net/gml/3.2", "ms": "http://mapserver.gis.umn.edu/mapserver",
          "wfs": "http://www.opengis.net/wfs/2.0"}
    features: dict[str, dict] = {}
    start = 0
    while True:
        query = urllib.parse.urlencode({"service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": layer,
                                        "count": WFS_PAGE, "startIndex": start, "srsName": "EPSG:4326"})
        root = ET.fromstring(http_get(f"{WFS_URL}?{query}"))
        members = root.findall("wfs:member", ns)
        for member in members:
            item = member[0]
            code = item.findtext("ms:JPT_KOD_JE", default="", namespaces=ns)
            valid_from = item.findtext("ms:WAZNY_OD", default="", namespaces=ns)
            polys = []
            for polygon in item.iter(f"{{{ns['gml']}}}Polygon"):
                rings = []
                for pos in polygon.iter(f"{{{ns['gml']}}}posList"):
                    v = [float(t) for t in pos.text.split()]
                    ring = [(round(v[i + 1], 5), round(v[i], 5)) for i in range(0, len(v), 2)]
                    rings.append(simplify_ring(ring, SIMPLIFY_DEG))
                polys.append(rings)
            if code and (code not in features or valid_from > features[code]["properties"]["od"]):
                features[code] = {"type": "Feature", "properties": {"kod": code, "nazwa": item.findtext("ms:JPT_NAZWA_", namespaces=ns), "od": valid_from},
                                  "geometry": {"type": "MultiPolygon", "coordinates": polys}}
        print(f"  {layer}: {start + len(members)}", flush=True)
        if len(members) < WFS_PAGE:
            break
        start += WFS_PAGE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"type": "FeatureCollection", "features": list(features.values())}, ensure_ascii=False), encoding="utf-8")


def bdl_teryt(unit_id: str) -> str:
    """Identyfikator jednostki BDL (12 znaków) → TERYT gminy (województwo, powiat, gmina, rodzaj)."""
    return unit_id[2:4] + unit_id[7:12]


def fetch_bdl(var: int, year: int, path: Path) -> None:
    """Jedna zmienna BDL dla wszystkich gmin; strony zapisujemy na bieżąco (przerwane pobieranie wznawia się)."""
    key = os.environ.get("BDL_API_KEY")  # bezpłatny klucz z api.stat.gov.pl: limit 500 zamiast 100 zapytań na 15 min
    delay = 2.0 if key else 9.5
    part = path.with_suffix(".part.json")
    state = json.loads(part.read_text(encoding="utf-8")) if part.exists() else {"page": 0, "values": {}}
    while True:
        data = json.loads(http_get(BDL_URL.format(var=var, year=year, page=state["page"]), headers={"X-ClientId": key} if key else None))
        for row in data["results"]:
            if row["values"]:
                state["values"][bdl_teryt(row["id"])] = row["values"][0]["val"]
        state["page"] += 1
        part.parent.mkdir(parents=True, exist_ok=True)
        part.write_text(json.dumps(state), encoding="utf-8")
        time.sleep(delay)
        if state["page"] * 100 >= data["totalRecords"]:
            break
    if not state["values"]:
        raise SystemExit(f"BDL: brak danych zmiennej {var} za {year}")
    path.write_text(json.dumps(state["values"]), encoding="utf-8")
    part.unlink()


def inside(x: float, y: float, ring: list[tuple[float, float]]) -> bool:
    """Punkt w wielokącie (promień w prawo)."""
    hit = False
    for (xa, ya), (xb, yb) in zip(ring, ring[-1:] + ring[:-1]):
        if (ya > y) != (yb > y) and x < (xb - xa) * (y - ya) / (yb - ya) + xa:
            hit = not hit
    return hit


def in_rings(x: float, y: float, rings: list) -> bool:
    """Pierwszy pierścień to obrys, kolejne to dziury."""
    return inside(x, y, rings[0]) and not any(inside(x, y, hole) for hole in rings[1:])


def bbox(polys: list) -> tuple[float, float, float, float]:
    xs = [p[0] for rings in polys for p in rings[0]]
    ys = [p[1] for rings in polys for p in rings[0]]
    return min(xs), min(ys), max(xs), max(ys)


def thin(ring: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    out = [ring[0]]
    for point in ring[1:]:
        if math.hypot(point[0] - out[-1][0], point[1] - out[-1][1]) >= tol:
            out.append(point)
    return out if len(out) >= 4 else ring


def svg_path(polys: list, tol: float) -> str:
    """Ścieżka SVG z przesunięciami całkowitymi (jak regions-map)."""
    parts_all = []
    for rings in polys:
        for ring in rings:
            pts = [(round(x), round(y)) for x, y in thin(ring, tol)]
            px, py = pts[0]
            parts = []
            for x, y in pts[1:]:
                if (x, y) != (px, py):
                    parts.append(f"{x - px} {y - py}")
                    px, py = x, y
            if parts:
                parts_all.append(f"M{pts[0][0]} {pts[0][1]}l" + " ".join(parts).replace(" -", "-") + "z")
    return "".join(parts_all)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", type=Path, default=ROOT / "data" / "maps" / "gminy")
    parser.add_argument("--seats", type=Path, default=ROOT / "data" / "maps" / "powiaty" / "powiaty-siedziby.csv")
    parser.add_argument("--towns", type=Path, default=ROOT / "data" / "maps" / "miasta-wikidata.csv")
    parser.add_argument("--regions", type=Path, default=ROOT / "data" / "maps" / "wojewodztwa-min.geojson")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "data" / "access" / "population.json.gz")
    parser.add_argument("--map-output", type=Path, default=ROOT / "public" / "data" / "access" / "gminy-map.json.gz")
    parser.add_argument("--year", type=int, default=2025, help="rok danych GUS o ludności")
    parser.add_argument("--fetch", action="store_true", help="pobierz granice i ludność ponownie")
    args = parser.parse_args()

    for key, layer in WFS_LAYERS.items():
        path = args.cache / f"prg-{key}.geojson"
        if args.fetch or not path.exists():
            print(f"PRG: {layer}", flush=True)
            fetch_prg(layer, path)
    bdl: dict[str, dict[str, float]] = {}
    for label, var in BDL_VARS.items():
        path = args.cache / "bdl" / f"{var}_{args.year}.json"
        if args.fetch or not path.exists():
            print(f"BDL: {var} ({label}, {args.year})", flush=True)
            fetch_bdl(var, args.year, path)
        bdl[label] = json.loads(path.read_text(encoding="utf-8"))

    voiv = json.loads(args.regions.read_text(encoding="utf-8"))["features"]
    _, to_box, height = project_regions(voiv)
    proj = lambda lon, lat: to_box(lon * math.cos(LAT0), -lat)  # noqa: E731
    (ax, ay), (bx, by) = proj(19, 52), proj(19, 53)
    km_per_unit = 110.57 / math.hypot(bx - ax, by - ay)

    def load(key: str) -> list[tuple[str, str, list]]:
        features = json.loads((args.cache / f"prg-{key}.geojson").read_text(encoding="utf-8"))["features"]
        out = [(f["properties"]["kod"], f["properties"]["nazwa"],
                [[[proj(lon, lat) for lon, lat in ring] for ring in poly] for poly in f["geometry"]["coordinates"]])
               for f in features]
        return sorted(out)

    # Powiaty (TERYT 4 znaki); OW NFZ = kod województwa TERYT / 2 (ta sama kolejność alfabetyczna).
    powiaty: list[list] = []
    powiat_index: dict[str, int] = {}
    for code, name, polys in load("powiaty"):
        name = name.removeprefix("powiat ")
        powiat_index[code] = len(powiaty)
        powiaty.append([f"m. {name}" if name[0].isupper() else name, f"{int(code[:2]) // 2:02d}", 0, svg_path(polys, 2.0), None, code])

    # Gminy (TERYT 7 znaków) z ludnością według płci i wieku
    def people(teryt: str, label: str) -> float:
        values = bdl[label]
        if teryt in values:
            return values[teryt]
        # Gmina, która zmieniła rodzaj (np. wiejska → miejsko-wiejska po nadaniu praw miejskich): w BDL stary kod.
        renamed = [v for k, v in values.items() if k[:6] == teryt[:6] and k[6] in "123"]
        if len(renamed) == 1:
            return renamed[0]
        # Warszawa: w BDL tylko dzielnice (rodzaj 8)
        parts = [v for k, v in values.items() if k[:4] == teryt[:4] and k[6] == "8"]
        if not parts:
            raise SystemExit(f"BDL: brak gminy {teryt}")
        return sum(parts)

    gminy: list[list] = []
    shapes: list[list] = []
    for code, name, polys in load("gminy"):
        v = {label: people(code, label) for label in BDL_VARS}
        groups = [v["M 0-17"], v["M 18-44"], v["M 45-64"], v["M 65+"],
                  v["K 0-17"], v["K 18-44"], v["K 45-59"] + v["K 60-64"], v["K 60+"] - v["K 60-64"]]
        groups = [round(x) for x in groups]
        p_idx = powiat_index[code[:4]]
        gminy.append([name, code, p_idx, sum(groups), groups])
        powiaty[p_idx][2] += sum(groups)
        shapes.append(polys)

    # Jednostka oceny: miasto na prawach powiatu + powiat, którego jest siedzibą (Wikidata P36).
    seats: dict[str, list[str]] = defaultdict(list)
    for row in csv.DictReader(args.seats.open(encoding="utf-8")):
        seats[row["seatName"]].append(row["name"].removeprefix("powiat "))
    renamed = {"karkonoski": "jeleniogórski"}  # nazwa w Wikidata → nazwa w PRG
    for i, row in enumerate(powiaty):
        unit = i
        if row[0].startswith("m. "):
            lands = [renamed.get(n, n) for n in seats.get(row[0][3:], [])]
            unit = next((j for j, other in enumerate(powiaty) if other[0] in lands and other[1] == row[1]), i)
        row[4] = unit

    boxes = [bbox(polys) for polys in shapes]

    def which(x: float, y: float) -> int | None:
        for i, polys in enumerate(shapes):
            x0, y0, x1, y1 = boxes[i]
            if x0 <= x <= x1 and y0 <= y <= y1 and any(in_rings(x, y, rings) for rings in polys):
                return i
        return None

    # Miasta: najnowsza ludność, punkt w gminie
    towns: dict[str, tuple[str, float, float, float]] = {}
    for row in csv.DictReader(args.towns.open(encoding="utf-8")):
        if not row["pop"] or not row["coord"]:
            continue
        date = row["popDate"] or "0"
        if row["item"] not in towns or date > towns[row["item"]][0]:
            lon, lat = (float(v) for v in row["coord"].removeprefix("Point(").removesuffix(")").split())
            towns[row["item"]] = (date, float(row["pop"]), lon, lat)
    town_points: dict[int, list[tuple[float, float, float]]] = defaultdict(list)
    for _date, count, lon, lat in towns.values():
        x, y = proj(lon, lat)
        i = which(x, y)
        if i is not None:
            town_points[i].append((x, y, count))

    # Punkty ludności: miasta + siatka z resztą mieszkańców; potem skupiska (gmina × komórka CELL_KM)
    step = GRID_KM / km_per_unit
    cell = CELL_KM / km_per_unit
    acc: dict[tuple[int, int, int], list[float]] = {}
    for i, polys in enumerate(shapes):
        x0, y0, x1, y1 = boxes[i]
        grid = []
        y = math.floor(y0 / step) * step + step / 2
        while y <= y1:
            x = math.floor(x0 / step) * step + step / 2
            while x <= x1:
                if any(in_rings(x, y, rings) for rings in polys):
                    grid.append((x, y))
                x += step
            y += step
        total = gminy[i][3]
        in_towns = sum(p for _, _, p in town_points[i])
        # Miasta liczniejsze niż gmina (różne lata danych): skala do ludności gminy.
        scale = min(1.0, total / in_towns) if in_towns else 1.0
        rest = max(0.0, total - in_towns * scale)
        if not grid and rest > 0:  # mała gmina bez punktu siatki: środek największego obrysu
            ring = max((rings[0] for rings in polys), key=len)
            grid.append((sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)))
        points = [(x, y, rest / len(grid)) for x, y in grid] + [(x, y, p * scale) for x, y, p in town_points[i]]
        for x, y, count in points:
            if count <= 0:
                continue
            key = (i, int(x // cell), int(y // cell))
            a = acc.setdefault(key, [0.0, 0.0, 0.0])
            a[0] += x * count; a[1] += y * count; a[2] += count

    cells = [[round(a[0] / a[2], 1), round(a[1] / a[2], 1), round(a[2]), key[0]] for key, a in sorted(acc.items())]
    payload = {"version": 2, "source": SOURCE_NOTE, "year": args.year, "viewBox": [WIDTH, height],
               "kmPerUnit": round(km_per_unit, 5), "cellKm": CELL_KM, "groups": GROUPS,
               "powiaty": powiaty, "gminy": gminy, "cells": cells}
    size = write_json_gz(args.output, payload)
    map_size = write_json_gz(args.map_output, {"version": 1, "paths": [svg_path(polys, 1.0) for polys in shapes]})
    joined = sum(1 for i, row in enumerate(powiaty) if row[4] != i)
    print(f"access/population: {len(powiaty)} powiatów ({joined} miast dołączonych do powiatu), {len(gminy)} gmin, "
          f"{len(cells)} skupisk, {sum(c[2] for c in cells) / 1e6:.2f} mln osób ({args.year}), {size / 1024:.0f} KiB; "
          f"gminy-map {map_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
