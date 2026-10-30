#!/usr/bin/env python3
"""Build per-group data for JGP group pages (/jgp/[kod]).

For every group listed in src/lib/jgpPageCodes.json writes public/data/jgp/<KOD>.json.gz:
  monthly   provider x month x admission group (p/u/o), the same "<5" estimation as
            scripts/build_hospitalizations.py (same seed and file order), all years
  valuePln  NFZ settlements for the group in PLN by year: national total and per provider
            (OW + NIP), from data/zestawienie_swiadczen_2019_2026.csv; omitted when the
            file is missing. The last year in the file is treated as incomplete and skipped.

Provider codes in the settlements file are NFZ provider codes; they are mapped to NIP with
data/nfz_swiadczeniodawcy_2025.csv (OW + code -> NIP).

Run after build_hospitalizations.py (product codes come from trends.json.gz):
  python3 scripts/build_jgp_pages.py --years 2024,2025
"""
from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

from build_hospitalizations import ROOT, VALUE_COLS, iter_frames, write_json_gz

SETTLEMENTS_FILE = "zestawienie_swiadczen_2019_2026.csv"
PROVIDERS_FILE = "nfz_swiadczeniodawcy_2025.csv"


def product_codes_by_group(trends_path: Path, groups: list[str]) -> dict[str, set[str]]:
    with gzip.open(trends_path, "rt", encoding="utf-8") as fh:
        trends = json.load(fh)
    out: dict[str, set[str]] = {group: set() for group in groups}
    for code, jgp, *_ in trends["products"]:
        if jgp in out:
            out[jgp].add(code)
    for group, codes in out.items():
        if not codes:
            raise SystemExit(f"{group}: brak produktów w trends.json.gz")
    return out


def read_monthly(data_dir: Path, years: list[str], product_to_group: dict[str, str]) -> dict[str, list[list]]:
    rows: dict[str, list[list]] = defaultdict(list)
    for year in years:
        parts = []
        for frame, _ in iter_frames(data_dir / f"hospitalizacje_{year}.csv", year):
            frame = frame[frame["product"].isin(product_to_group)]
            if len(frame):
                frame = frame.assign(jgp=frame["product"].map(product_to_group))
                parts.append(frame.groupby(["jgp", "month", "ow", "nip", "group"], sort=False)[VALUE_COLS].sum().reset_index())
        if not parts:
            continue
        out = pd.concat(parts).groupby(["jgp", "month", "ow", "nip", "group"], sort=True)[VALUE_COLS].sum().reset_index()
        out[VALUE_COLS] = out[VALUE_COLS].round().astype("int64")
        for jgp, month, ow, nip, group, *values in out.itertuples(index=False):
            rows[jgp].append([year, int(month), ow, nip, group, *[int(v) for v in values]])
    return rows


def read_settlements(data_dir: Path, groups: set[str]) -> dict[str, dict]:
    path = data_dir / SETTLEMENTS_FILE
    if not path.exists():
        print(f"Uwaga: brak {path.name} — pliki grup bez kwot rozliczeń.")
        return {}
    providers = pd.read_csv(data_dir / PROVIDERS_FILE, dtype=str, encoding="utf-8-sig")
    nip_by_code = dict(zip(providers["oddzial_nfz"].str.zfill(2) + "|" + providers["kod"].str.strip(), providers["nip"].str.strip()))
    frame = pd.read_csv(path, sep=";", dtype=str, usecols=[
        "Rok", "Oddzial_wojewodzki_NFZ", "Kod_swiadczeniodawcy", "Nazwa_produktu_jednostkowego", "Wartosc_jednostek_rozliczonych",
    ])
    frame["jgp"] = frame["Nazwa_produktu_jednostkowego"].str.split().str[0]
    frame = frame[frame["jgp"].isin(groups)].copy()
    frame["value"] = pd.to_numeric(frame["Wartosc_jednostek_rozliczonych"].str.replace(",", ".", regex=False), errors="coerce").fillna(0)
    frame["ow"] = frame["Oddzial_wojewodzki_NFZ"].str.zfill(2)
    frame["nip"] = (frame["ow"] + "|" + frame["Kod_swiadczeniodawcy"].str.strip()).map(nip_by_code)
    # Ostatni rok w pliku jest niepełny (dane w trakcie roku).
    last_year = frame["Rok"].max()
    frame = frame[frame["Rok"] < last_year]
    unmapped = frame.loc[frame["nip"].isna(), "value"].sum()
    if unmapped:
        print(f"Uwaga: {unmapped:,.0f} zł rozliczeń bez NIP (brak w {PROVIDERS_FILE}).")
    out: dict[str, dict] = {}
    for jgp, part in frame.groupby("jgp"):
        national = part.groupby("Rok")["value"].sum().round().astype("int64")
        by_provider = part.dropna(subset=["nip"]).groupby(["Rok", "ow", "nip"])["value"].sum().round().astype("int64").reset_index()
        out[jgp] = {
            "national": {year: int(value) for year, value in national.items()},
            "providers": [[year, ow, nip, int(value)] for year, ow, nip, value in by_provider.itertuples(index=False)],
        }
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2024,2025", help="lata oddzielone przecinkami")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--codes-file", type=Path, default=ROOT / "src" / "lib" / "jgpPageCodes.json")
    parser.add_argument("--trends", type=Path, default=ROOT / "public" / "data" / "hospitalizations" / "trends.json.gz")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "public" / "data" / "jgp")
    args = parser.parse_args()

    years = sorted({y.strip() for y in args.years.split(",") if y.strip()})
    groups = json.loads(args.codes_file.read_text(encoding="utf-8"))
    codes = product_codes_by_group(args.trends, groups)
    product_to_group = {code: group for group, group_codes in codes.items() for code in group_codes}

    monthly = read_monthly(args.data_dir, years, product_to_group)
    settlements = read_settlements(args.data_dir, set(groups))
    for group in groups:
        payload = {"version": 1, "jgp": group, "years": years, "monthly": monthly.get(group, [])}
        if group in settlements:
            payload["valuePln"] = settlements[group]
        size = write_json_gz(args.output_dir / f"{group}.json.gz", payload)
        total = sum(row[6] for row in payload["monthly"] if row[0] == years[-1])
        value = settlements.get(group, {}).get("national", {})
        print(f"{group}: {len(payload['monthly']):,} monthly rows, {years[-1]}: {total:,} hosp. (min), "
              f"PLN years: {', '.join(sorted(value)) or '—'}, {size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
