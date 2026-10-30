"""Buduje public/data/sanok_kody_e.json.gz z data/hospitalizacje_<rok>.csv.

Plik zawiera hospitalizacje z kodami JGP z grupy E dla dwóch placówek
pod adresem ul. 800-lecia 26 w Sanoku, zsumowane do kwartałów
i przedziałów długości pobytu. Wartość "<5" liczymy jako 1 (wariant min).

Użycie:
    python3 scripts/build_sanok_jgp_e.py --years 2022,2023,2024,2025
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT = ROOT / "public" / "data" / "sanok_kody_e.json.gz"

FACILITIES = [
    {"key": "pcisn", "nip": "6772299255", "name": "PCISN", "description": "kardiologia inwazyjna"},
    {"key": "szpital", "nip": "6871640438", "name": "SP ZOZ Sanok", "description": "szpital powiatowy"},
]
LENGTHS_OF_STAY = ["0 dni", "1-2 dni", "3-5 dni", "6 i więcej dni"]


def load_jgp_catalog() -> dict[str, tuple[str, str]]:
    with open(DATA_DIR / "kody_produktu_jgp.csv", encoding="utf-8-sig", newline="") as handle:
        return {
            row["KOD_PRODUKTU_JEDNOSTKOWEGO"].strip(): (row["KOD_JGP"].strip(), row["NAZWA"].strip().rstrip("* ").strip())
            for row in csv.DictReader(handle)
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default="2022,2023,2024,2025")
    args = parser.parse_args()
    years = [year.strip() for year in args.years.split(",") if year.strip()]

    catalog = load_jgp_catalog()
    facility_index = {facility["nip"]: index for index, facility in enumerate(FACILITIES)}
    los_index = {los: index for index, los in enumerate(LENGTHS_OF_STAY)}
    totals: dict[tuple[str, int, str, int], int] = defaultdict(int)
    names: dict[str, str] = {}

    for year in years:
        with open(DATA_DIR / f"hospitalizacje_{year}.csv", encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle, delimiter=";"):
                facility = facility_index.get(row["NIP_PODMIOTU"].strip())
                if facility is None:
                    continue
                product = catalog.get(row["KOD_PRODUKTU_JEDNOSTKOWEGO"].strip())
                if product is None or not product[0].startswith("E"):
                    continue
                code, name = product
                names[code] = name
                quarter = f"{row['ROK']}-Q{(int(row['MIESIAC']) - 1) // 3 + 1}"
                raw = row["LICZBA_HOSPITALIZACJI"].strip()
                count = 1 if raw == "<5" else int(raw)
                los = los_index[row["PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"].strip()]
                totals[(quarter, facility, code, los)] += count

    facts = [[quarter, facility, code, los, count] for (quarter, facility, code, los), count in sorted(totals.items())]
    payload = {
        "facilities": FACILITIES,
        "lengthsOfStay": LENGTHS_OF_STAY,
        "codes": dict(sorted(names.items())),
        "facts": facts,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUTPUT, "wt", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    print(f"Zapisano {OUTPUT.relative_to(ROOT)}: {len(facts)} wierszy, {len(names)} kodów E.")


if __name__ == "__main__":
    main()
