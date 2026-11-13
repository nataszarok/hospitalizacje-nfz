#!/usr/bin/env python3
"""Build standard ward names for hospital cards: build-data/hospitals/ward-names.json.

Source: RPWDL register export data/rpwdl/komorki.csv (columns kodResortVIII and „Specjalność komórki”).
The 8th part of the ministry code (kod resortowy, e.g. 4000) has one official name („Oddział chorób wewnętrznych”).
Hospital cards show this name instead of the register cell names: the register joins several cells with the same code
(„Oddział Chorób Wewnętrznych / Oddział Kliniczny Chorób Wewnętrznych, Nadciśnienia…”), which is long and not comparable
between hospitals. Only codes of wards in public/data/rpwdl_summary_profiles.json.gz are written; „NULL” names are skipped,
„(kod wycofany)” is removed; with several names per code the most frequent one wins.

Output: {"version": 1, "names": {"4000": "Oddział chorób wewnętrznych", ...}}

Usage:
  python3 scripts/build_ward_names.py
"""
from __future__ import annotations

import csv
import gzip
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CELLS = ROOT / "data" / "rpwdl" / "komorki.csv"
PROFILES = ROOT / "public" / "data" / "rpwdl_summary_profiles.json.gz"
OUT = ROOT / "build-data" / "hospitals" / "ward-names.json"


def main() -> None:
    profiles = json.load(gzip.open(PROFILES))["records"]
    wanted = {ward["code"] for record in profiles for ward in ((record.get("core") or {}).get("wards") or [])}
    counts: dict[str, Counter] = defaultdict(Counter)
    with CELLS.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            code, name = row["kodResortVIII"].strip(), row["Specjalność komórki"].strip()
            if code in wanted and name and name != "NULL":
                counts[code][re.sub(r"\s*\(kod wycofany\)\s*$", "", name)] += 1
    names = {code: counter.most_common(1)[0][0] for code, counter in sorted(counts.items())}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "names": names}, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    missing = sorted(wanted - set(names))
    print(f"Nazwy oddziałów: {len(names)} kodów z {len(wanted)} -> {OUT.relative_to(ROOT)}" + (f"; bez nazwy w RPWDL: {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
