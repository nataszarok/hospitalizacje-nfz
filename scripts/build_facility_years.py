#!/usr/bin/env python3
"""Build hospitalizations by provider (placówka) for all years: public/data/hospitalizations/facilities/.

Input: the year files written by build_hospitalizations.py (public/data/hospitalizations/<year>.json.gz).
The explorer map („Gdzie”, Miasta) draws one dot per provider for every year: the dot scale is shared by
all years and the year slider plays them in turn. The year files together are ~12 MB; these files keep
only product × provider × year sums (city sums are derived from them in the browser), split by the first
letter of the JGP code (section), so the browser downloads only the sections of the selected groups.

Output:
  facilities/index.json:
    {"version": 1, "years": [...],
     "facilities": [[OW NFZ, NIP, nazwa, MIASTO (wielkie litery)], ...],
     "active": [maska lat, ...]}   # bit i = placówka ma hospitalizacje (dowolne grupy) w roku years[i]
  facilities/<litera>.json.gz (columns; indices into `products`, index `facilities` and `years`):
    {"version": 1, "products": [kod produktu, ...],
     "rows": {"product": [...], "facility": [...], "year": [...], "hMin": [...], "hSim": [...]}}
  The browser knows a product's section from its JGP code (first letter); products without a code: "_".

Usage:
  python3 scripts/build_facility_years.py
"""
from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", type=Path, default=ROOT / "public" / "data" / "hospitalizations")
    args = parser.parse_args()

    years = json.loads((args.dir / "index.json").read_text(encoding="utf-8"))["years"]
    totals: dict[tuple[str, tuple[str, str], int], list[int]] = defaultdict(lambda: [0, 0])
    section_of: dict[str, str] = {}
    # Placówka = OW NFZ + NIP; nazwa i miasto z najnowszego roku, w którym występuje.
    info: dict[tuple[str, str], tuple[str, str]] = {}
    active: dict[tuple[str, str], int] = defaultdict(int)
    for year_index, year in enumerate(years):
        data = json.load(gzip.open(args.dir / f"{year}.json.gz"))
        facilities, products, facts = data["facilities"], data["products"], data["facts"]
        for code, jgp, *_ in products:
            if jgp:
                section_of[code] = jgp[0].upper()
        for ow, nip, name, city in facilities:
            info[(ow, nip)] = (name, city.strip().upper())
        for facility, product, h_min, h_sim in zip(facts["facility"], facts["product"], facts["hMin"], facts["hSim"]):
            ow, nip = facilities[facility][:2]
            total = totals[(products[product][0], (ow, nip), year_index)]
            total[0] += h_min
            total[1] += h_sim
            if h_min > 0:
                active[(ow, nip)] |= 1 << year_index

    keys = sorted(info)
    facility_index = {key: i for i, key in enumerate(keys)}
    sections: dict[str, list[str]] = defaultdict(list)
    for product in sorted({product for product, _, _ in totals}):
        sections[section_of.get(product, "_")].append(product)

    out = args.dir / "facilities"
    out.mkdir(exist_ok=True)
    for stale in out.glob("*.json.gz"):
        stale.unlink()
    rows_by_section: dict[str, dict[str, list[int]]] = {}
    product_index = {}
    for letter, codes in sections.items():
        product_index.update({code: (letter, i) for i, code in enumerate(codes)})
        rows_by_section[letter] = {"product": [], "facility": [], "year": [], "hMin": [], "hSim": []}
    for (product, key, year_index), (h_min, h_sim) in sorted(totals.items()):
        letter, i = product_index[product]
        rows = rows_by_section[letter]
        rows["product"].append(i)
        rows["facility"].append(facility_index[key])
        rows["year"].append(year_index)
        rows["hMin"].append(h_min)
        rows["hSim"].append(h_sim)
    size = 0
    for letter, codes in sorted(sections.items()):
        size += write_json_gz(out / f"{letter}.json.gz", {"version": 1, "products": codes, "rows": rows_by_section[letter]})

    index = {
        "version": 1,
        "years": years,
        "facilities": [[ow, nip, *info[(ow, nip)]] for ow, nip in keys],
        "active": [active[key] for key in keys],
    }
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"facilities: {len(sections)} sekcji, {len(keys)} placówek, razem {size / 1024:.0f} KiB, indeks {(out / 'index.json').stat().st_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
