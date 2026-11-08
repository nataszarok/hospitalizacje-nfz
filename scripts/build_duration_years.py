#!/usr/bin/env python3
"""Build yearly hospitalizations by length of stay: public/data/hospitalizations/durations/.

Input: the year files written by build_hospitalizations.py. The monthly trends (trends.json.gz) have no
length-of-stay split, so the explorer view „W czasie” with a length-of-stay filter shows years from these
files instead. Split by the first letter of the JGP code (section), like facilities/.

Output (columns; `durations` as in the year files, OW NFZ as text):
  durations/<litera>.json.gz:
    {"version": 1, "years": [...], "durations": [...], "products": [kod produktu, ...],
     "rows": {"product": [...], "year": [...], "ow": [...], "duration": [...],
              "hMin": [...], "hSim": [...], "dMin": [...], "dSim": [...], "uMin": [...], "uSim": [...]}}
  u* = przyjęcia nagłe (tryb 2 i 3).

Usage:
  python3 scripts/build_duration_years.py
"""
from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz

URGENT = {"2", "3"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", type=Path, default=ROOT / "public" / "data" / "hospitalizations")
    args = parser.parse_args()

    years = json.loads((args.dir / "index.json").read_text(encoding="utf-8"))["years"]
    totals: dict[tuple[str, int, str, str], list[int]] = defaultdict(lambda: [0] * 6)
    section_of: dict[str, str] = {}
    durations: list[str] = []
    for year_index, year in enumerate(years):
        data = json.load(gzip.open(args.dir / f"{year}.json.gz"))
        facilities, products, facts = data["facilities"], data["products"], data["facts"]
        durations = durations or data["durations"]
        if data["durations"] != durations:
            raise SystemExit(f"{year}: inne przedziały długości pobytu {data['durations']}")
        for code, jgp, *_ in products:
            if jgp:
                section_of[code] = jgp[0].upper()
        columns = zip(facts["facility"], facts["product"], facts["duration"], facts["admission"], facts["hMin"], facts["hSim"], facts["dMin"], facts["dSim"])
        for facility, product, duration, admission, h_min, h_sim, d_min, d_sim in columns:
            total = totals[(products[product][0], year_index, facilities[facility][0], durations[duration])]
            urgent = data["admissions"][admission] in URGENT
            for i, value in enumerate((h_min, h_sim, d_min, d_sim, h_min if urgent else 0, h_sim if urgent else 0)):
                total[i] += value

    sections: dict[str, list[str]] = defaultdict(list)
    for product in sorted({product for product, *_ in totals}):
        sections[section_of.get(product, "_")].append(product)
    out = args.dir / "durations"
    out.mkdir(exist_ok=True)
    for stale in out.glob("*.json.gz"):
        stale.unlink()
    fields = ["hMin", "hSim", "dMin", "dSim", "uMin", "uSim"]
    size = 0
    for letter, codes in sorted(sections.items()):
        index = {code: i for i, code in enumerate(codes)}
        rows: dict[str, list] = {key: [] for key in ["product", "year", "ow", "duration", *fields]}
        for (product, year_index, ow, duration), values in sorted(totals.items()):
            if product not in index:
                continue
            rows["product"].append(index[product])
            rows["year"].append(year_index)
            rows["ow"].append(ow)
            rows["duration"].append(durations.index(duration))
            for key, value in zip(fields, values):
                rows[key].append(value)
        size += write_json_gz(out / f"{letter}.json.gz", {"version": 1, "years": years, "durations": durations, "products": codes, "rows": rows})
    print(f"durations: {len(sections)} sekcji, przedziały {durations}, razem {size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
