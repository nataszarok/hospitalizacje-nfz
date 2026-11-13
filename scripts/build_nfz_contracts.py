#!/usr/bin/env python3
"""Build NFZ contracts of hospitals with a card (Finanse tab): build-data/hospitals/contracts.json.gz.

Source: API NFZ „Umowy” through scripts/nfz_contracts.py (cache data/nfz_umowy/; --fetch downloads again).
For every hospital with a card (build-data/hospitals/index.json) and every year 2017–2025: the agreements
(service type, e.g. 03 leczenie szpitalne, 02 poradnie, 05 rehabilitacja; amount) and their plan positions
(product code and name, units, price in zł for the year). No classification here: the card groups the positions
(ryczałt PSZ, za wykonanie, SOR, programy lekowe, poradnie…) — the rules belong next to the view that shows them.

Output (build only, not in dist/; columns as tuples, names once in a dictionary):
  {"version": 1, "hospitals": {"OW|NIP": {
      "years": [...],
      "agreements": [[year index, service type, service name, amount zł, agreement code], ...],
      "products": [[product code, product name], ...],
      "plans": [[agreement index, product index, units, price zł], ...]}}}

Usage:
  python3 scripts/build_nfz_contracts.py [--fetch] [--workers 4]
Missing years are downloaded in parallel (one hospital per worker; each hospital has its own cache file, so a run can be
stopped and resumed). Hospitals the API did not answer for are listed at the end and left out of the output.
"""
from __future__ import annotations

import argparse
import gzip
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from nfz_contracts import PLAN_CODE, PLAN_NAME, PLAN_PRICE, PLAN_UNITS, YEARS, contracts, page_keys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build-data" / "hospitals" / "contracts.json.gz"


def compact(by_year: dict[str, list[dict]]) -> dict:
    years = [year for year in YEARS if by_year.get(year)]
    agreements: list[list] = []
    products: dict[tuple[str, str], int] = {}
    plans: list[list] = []
    for y, year in enumerate(years):
        for agreement in by_year[year]:
            agreements.append([y, agreement["type"], agreement["name"], round(agreement["amount"] or 0, 2), agreement.get("code") or ""])
            for plan in agreement["plans"]:
                product = (plan[PLAN_CODE], (plan[PLAN_NAME] or "").strip())
                index = products.setdefault(product, len(products))
                plans.append([len(agreements) - 1, index, plan[PLAN_UNITS] or 0, round(plan[PLAN_PRICE] or 0, 2)])
    return {"years": years, "agreements": agreements, "products": [list(product) for product in products], "plans": plans}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fetch", action="store_true", help="pobierz umowy z API NFZ ponownie (zamiast cache)")
    parser.add_argument("--workers", type=int, default=4, help="liczba szpitali pobieranych naraz")
    args = parser.parse_args()
    keys = page_keys()
    hospitals: dict[str, dict] = {}
    failed: list[str] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(contracts, key, args.fetch): key for key in keys}
        for done, future in enumerate(as_completed(futures), start=1):
            key = futures[future]
            try:
                hospitals[key] = compact(future.result())
            except Exception as error:  # noqa: BLE001 — jeden szpital nie przerywa całego pobierania
                failed.append(key)
                print(f"{key}: błąd API ({error})", flush=True)
            if done % 25 == 0 or done == len(keys):
                print(f"Umowy: {done}/{len(keys)} szpitali", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as handle:
        json.dump({"version": 1, "hospitals": dict(sorted(hospitals.items()))}, handle, ensure_ascii=False, separators=(",", ":"))
    print(f"Zapisano {OUT.relative_to(ROOT)}: {len(hospitals)} szpitali" + (f"; bez umów (uruchom ponownie): {', '.join(sorted(failed))}" if failed else ""))

if __name__ == "__main__":
    main()
