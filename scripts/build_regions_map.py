#!/usr/bin/env python3
"""Build a light voivodeship map for the browser: public/data/regions-map.json.gz.

Source: wojewodztwa-min.geojson from github.com/ppatrzyk/polska-geojson (MIT license;
boundaries converted from PRG, Główny Urząd Geodezji i Kartografii). The file is cached in
data/maps/ (outside the repo); --fetch downloads it again.

Output (one SVG path per voivodeship, ready to draw without a map library):
  {"version": 1, "source": ..., "viewBox": [w, h],
   "regions": [[OW NFZ code, name, "M x y l dx dy ... z", [label x, label y]], ...]}
Coordinates: equirectangular projection with longitude scaled by cos(52°), simplified
(Douglas-Peucker) and rounded to whole units of a 1000-unit-wide box; path segments are
relative ("l"), which keeps the file small.

Usage:
  python3 scripts/build_regions_map.py [--fetch]
"""
from __future__ import annotations

import argparse
import json
import math
import unicodedata
import urllib.request
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz

SOURCE_URL = "https://github.com/ppatrzyk/polska-geojson/raw/master/wojewodztwa/wojewodztwa-min.geojson"
SOURCE_NOTE = "ppatrzyk/polska-geojson (MIT), granice z PRG (GUGiK)"
WIDTH = 1000
TOLERANCE = 1.2  # jednostki docelowego pudełka (~0,8 km)
LAT0 = math.radians(52.0)

# Kody OW NFZ = kody TERYT województw.
OW_BY_NAME = {
    "dolnoslaskie": "01", "kujawsko-pomorskie": "02", "lubelskie": "03", "lubuskie": "04",
    "lodzkie": "05", "malopolskie": "06", "mazowieckie": "07", "opolskie": "08",
    "podkarpackie": "09", "podlaskie": "10", "pomorskie": "11", "slaskie": "12",
    "swietokrzyskie": "13", "warminsko-mazurskie": "14", "wielkopolskie": "15", "zachodniopomorskie": "16",
}


def normalize(name: str) -> str:
    name = name.strip().lower().replace("ł", "l")
    return "".join(c for c in unicodedata.normalize("NFD", name) if unicodedata.category(c) != "Mn")


def simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas-Peucker bez zależności zewnętrznych."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        (x1, y1), (x2, y2) = points[start], points[end]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy)
        best, index = 0.0, -1
        for i in range(start + 1, end):
            x, y = points[i]
            # Zamknięty pierścień: początek = koniec, więc liczymy odległość od punktu, nie od odcinka.
            distance = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm if norm else math.hypot(x - x1, y - y1)
            if distance > best:
                best, index = distance, i
        if index >= 0 and best > tolerance:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [p for p, k in zip(points, keep) if k]


def polygons(geometry: dict) -> list[list[list[list[float]]]]:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise SystemExit(f"nieobsługiwana geometria {geometry['type']}")


def ring_area_centroid(ring: list[tuple[float, float]]) -> tuple[float, float, float]:
    area = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        cross = x1 * y2 - x2 * y1
        area += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    area /= 2
    if not area:
        return 0.0, ring[0][0], ring[0][1]
    return abs(area), cx / (6 * area), cy / (6 * area)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=ROOT / "data" / "maps" / "wojewodztwa-min.geojson")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "data" / "regions-map.json.gz")
    parser.add_argument("--fetch", action="store_true", help="pobierz plik źródłowy ponownie")
    args = parser.parse_args()

    if args.fetch or not args.source.exists():
        args.source.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(SOURCE_URL, args.source)
    features = json.loads(args.source.read_text(encoding="utf-8"))["features"]

    # Rzutowanie: x = długość × cos(52°), y = −szerokość; potem skala do pudełka o szerokości WIDTH.
    projected = []
    for feature in features:
        code = OW_BY_NAME.get(normalize(feature["properties"]["nazwa"]))
        if not code:
            raise SystemExit(f"nieznane województwo: {feature['properties']['nazwa']}")
        rings = [[(lon * math.cos(LAT0), -lat) for lon, lat in ring] for polygon in polygons(feature["geometry"]) for ring in polygon]
        projected.append((code, feature["properties"]["nazwa"], rings))
    xs = [x for _, _, rings in projected for ring in rings for x, _ in ring]
    ys = [y for _, _, rings in projected for ring in rings for _, y in ring]
    scale = WIDTH / (max(xs) - min(xs))
    height = math.ceil((max(ys) - min(ys)) * scale)

    regions = []
    for code, name, rings in sorted(projected):
        parts = []
        best = (0.0, 0.0, 0.0)
        for ring in rings:
            points = [((x - min(xs)) * scale, (y - min(ys)) * scale) for x, y in ring]
            points = simplify(points, TOLERANCE)
            rounded = []
            for x, y in points:
                p = (round(x), round(y))
                if not rounded or rounded[-1] != p:
                    rounded.append(p)
            if len(rounded) < 4:
                continue
            path = f"M{rounded[0][0]} {rounded[0][1]}l" + " ".join(f"{x2 - x1} {y2 - y1}" for (x1, y1), (x2, y2) in zip(rounded, rounded[1:])) + "z"
            parts.append(path.replace(" -", "-"))
            area, cx, cy = ring_area_centroid(points)
            if area > best[0]:
                best = (area, cx, cy)
        regions.append([code, name, "".join(parts), [round(best[1]), round(best[2])]])

    payload = {"version": 1, "source": SOURCE_NOTE, "viewBox": [WIDTH, height], "regions": regions}
    size = write_json_gz(args.output, payload)
    print(f"regions-map: {len(regions)} województw, viewBox {WIDTH}×{height}, {size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
