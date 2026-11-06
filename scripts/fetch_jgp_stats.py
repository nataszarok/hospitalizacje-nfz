#!/usr/bin/env python3
"""Download NFZ JGP statistics (app-stat-api-jgp) used by the <5 calibration.

For every JGP product in data/jgp_benefits_nfz.json and every requested year, saves
data/nfz_jgp_stats/tabele/<rok>/<KOD_PRODUKTU>.json with national tables:
  general    "Dane ogólne": hospitalizations, patients (sum of the group, ratio hosp./patients)
  discharge  discharge mode (code 9 = death)
  service    contract ranges (zakresy świadczeń)
  histogram  length of stay in days (x = days, y = hospitalizations)
  admission  admission mode (codes as KOD_TRYBU_PRZYJECIA)
  gender     patient sex
  age        patient age groups
A product without data for that year is saved with "available": false. Existing files are kept
and only missing tables are added, so the script can be stopped and run again. The API has years 2017–2024 (state 5.11.2026).

Usage:
  python3 scripts/fetch_jgp_stats.py --years 2024
  python3 scripts/fetch_jgp_stats.py --years 2019-2024 --workers 3
"""
from __future__ import annotations

import argparse
import json
import subprocess
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.nfz.gov.pl/app-stat-api-jgp"
TABLES = {
    "general-data": "general", "hospitalization-by-discharge": "discharge", "hospitalization-by-service": "service",
    "histograms": "histogram", "hospitalization-by-admission": "admission", "hospitalization-by-gender": "gender",
    "hospitalization-by-age": "age",
}


def get(url: str) -> dict | None:
    # curl zamiast urllib: API odrzuca zapytania bez nagłówków przeglądarki.
    for attempt in range(4):
        out = subprocess.run(["curl", "-s", "--max-time", "40", url], capture_output=True, text=True).stdout
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            time.sleep(2 + 3 * attempt)
    return None


def fetch(item: dict, year: str, out_dir: Path) -> bool:
    path = out_dir / f"{item['code']}.json"
    result: dict = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    # Tabela None = nieudane pobranie (do ponowienia); [] = API nie ma tej tabeli dla produktu.
    if result and (not result.get("available") or all(result.get(short) is not None for short in TABLES.values())):
        return bool(result.get("available"))
    index = get(f"{API}/index-of-tables?catalog=1a&name={urllib.parse.quote(item['name'])}&year={year}&format=json&api-version=1.1")
    if index is None:   # błąd sieci albo API: nic nie zapisujemy, kolejne uruchomienie spróbuje znowu
        return bool(result.get("available"))
    result = {**result, "code": item["code"], "name": item["name"], "year": year, "available": bool(index.get("data"))}
    if result["available"]:
        # Tabela może wystąpić kilka razy (np. icd-10); bierzemy pierwszy link danego typu.
        links: dict[str, str] = {}
        for y in index["data"]["attributes"]["years"]:
            for t in y["tables"]:
                links.setdefault(t["type"], t["links"]["related"])
        for table, short in TABLES.items():
            if result.get(short) is not None:
                continue
            if table not in links:
                result[short] = []
                continue
            data = get(f"{links[table]}&api-version=1.1&limit=25")
            result[short] = (data["data"]["attributes"]["data"] or []) if data and data.get("data") else None
    path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result["available"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2024", help="rok albo zakres, np. 2019-2024")
    parser.add_argument("--workers", type=int, default=3, help="liczba równoległych zapytań")
    args = parser.parse_args()
    first, _, last = args.years.partition("-")
    items = json.loads((ROOT / "data" / "jgp_benefits_nfz.json").read_text(encoding="utf-8"))
    for year in range(int(first), int(last or first) + 1):
        out_dir = ROOT / "data" / "nfz_jgp_stats" / "tabele" / str(year)
        out_dir.mkdir(parents=True, exist_ok=True)
        with ThreadPoolExecutor(args.workers) as pool:
            found = list(pool.map(lambda item: fetch(item, str(year), out_dir), items))
        print(f"{year}: {sum(found)} produktów z danymi, {len(found) - sum(found)} bez danych → {out_dir.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
