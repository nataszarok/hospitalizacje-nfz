#!/usr/bin/env python3
"""Build the list of hospitals with a card (/szpitale/<NIP>-<OW>): build-data/hospitals/index.json.

Who gets a card:
  - every provider (OW NFZ + NIP) from the PSZ hospital network (public/data/psz.json.gz) that has hospitalizations
    in any year (public/data/hospitalizations/facilities/);
  - a fixed random sample of providers with very little data (all years together at most SMALL_MAX hospitalizations),
    to check how the card looks without data: seed SAMPLE_SEED, SAMPLE_SIZE providers ("sample");
  - a fixed random sample of mid-size providers outside the network, active in every year (hospitalizations in each year,
    all years together between the STEADY_RANGE percentiles of such providers): SAMPLE_SIZE providers ("steady").
One NIP can have hospitalizations in several OW NFZ: every pair gets its own card, the slug is "<NIP>-<OW>".

Output: {"version": 1, "pages": [["OW|NIP", "<NIP>-<OW>", "psz" | "sample" | "steady"], ...]} sorted by key.
Read by src/lib/hospitalPages.ts (links and generateStaticParams) and by scripts/nfz_contracts.py (page_keys).

Usage:
  python3 scripts/build_hospital_index.py
"""
from __future__ import annotations

import gzip
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACILITIES = ROOT / "public" / "data" / "hospitalizations" / "facilities"
PSZ = ROOT / "public" / "data" / "psz.json.gz"
OUT = ROOT / "build-data" / "hospitals" / "index.json"
SMALL_MAX = 50
SAMPLE_SIZE = 5
SAMPLE_SEED = 20261112
STEADY_RANGE = (0.4, 0.6)


def main() -> None:
    index = json.loads((FACILITIES / "index.json").read_text(encoding="utf-8"))
    totals = [0.0] * len(index["facilities"])
    active_years: list[set[int]] = [set() for _ in index["facilities"]]
    for path in sorted(FACILITIES.glob("*.json.gz")):
        rows = json.load(gzip.open(path))["rows"]
        for facility, year, value in zip(rows["facility"], rows["year"], rows["hMin"]):
            totals[facility] += value
            if value > 0:
                active_years[facility].add(year)
    psz = {nip for nip, _ in json.load(gzip.open(PSZ))["rows"]}
    keys = [(f"{ow}|{nip}", total) for (ow, nip, _, _), total in zip(index["facilities"], totals) if total > 0]
    every_year = {f"{ow}|{nip}" for (ow, nip, _, _), years in zip(index["facilities"], active_years) if len(years) == len(index["years"])}
    network = sorted(key for key, _ in keys if key.split("|")[1] in psz)
    small = sorted(key for key, total in keys if total <= SMALL_MAX and key.split("|")[1] not in psz)
    sample = sorted(random.Random(SAMPLE_SEED).sample(small, min(SAMPLE_SIZE, len(small))))
    # Średnie placówki spoza sieci aktywne w każdym roku: środek rozkładu sum wszystkich lat.
    steady_all = sorted(((total, key) for key, total in keys if key in every_year and key.split("|")[1] not in psz))
    low, high = (int(len(steady_all) * share) for share in STEADY_RANGE)
    middle = sorted(key for _, key in steady_all[low:high])
    steady = sorted(random.Random(SAMPLE_SEED).sample(middle, min(SAMPLE_SIZE, len(middle))))
    slug = lambda key: f"{key.split('|')[1]}-{key.split('|')[0]}"
    pages = sorted([[key, slug(key), "psz"] for key in network] + [[key, slug(key), "sample"] for key in sample] + [[key, slug(key), "steady"] for key in steady])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "pages": pages}, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"Karty szpitali: {len(network)} z sieci PSZ ({len(psz)} NIP w wykazie), {len(sample)} próbka z małą liczbą danych (≤ {SMALL_MAX} hosp.), {len(steady)} średnich spoza sieci aktywnych w każdym roku -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
