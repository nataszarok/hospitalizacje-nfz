#!/usr/bin/env python3
"""Build per-group data for JGP group pages (/jgp/[kod]) — one file per JGP group.

Writes build-data/jgp/index.json (list of groups with a page) and, for every JGP group in
trends.json.gz, build-data/jgp/<KOD>.json.gz in a compact format (version 3):
  providers  ["OW|NIP", ...] — row references point into this list
  rows       columns {provider, month, admission, hospitalizations, deaths}: provider index,
             month index (year index * 12 + month - 1), admission group (0 planned, 1 urgent,
             2 other), hospitalizations, deaths (one list per field; gzip compresses columns
             about twice as well as row tuples) — conservative
             estimation of "<5" (= 1), the method used by the pages; same file order and seed
             as scripts/build_hospitalizations.py (shared iter_frames)
  valuePln   NFZ settlements in PLN, from data/zestawienie_swiadczen_2019_2026.csv: national total
             by year ({year: zł}) and per provider by year ({year: [["OW|NIP", zł], ...]});
             omitted when the file is missing. The last year in the settlements file is
             incomplete and skipped.

The files are read only by the Next build (src/lib/staticDataServer.ts), which puts the card
data into the HTML of /jgp/[kod]; they live outside public/, so the export does not copy them
to dist/ and the site does not serve them.

Provider codes in the settlements file are NFZ provider codes; they are mapped to NIP with
data/nfz_swiadczeniodawcy_2025.csv (OW + code -> NIP), overridden by
data/kody_swiadczeniodawcow_uzupelnienie.csv (OW_NFZ, KOD_SWIADCZENIODAWCY, NIP, LATA, UWAGI): codes missing from
the 2025 file and codes whose NIP in the hospitalization files differs (LATA = years it applies to; empty = all).

Run after build_hospitalizations.py (product codes come from trends.json.gz):
  python3 scripts/build_jgp_pages.py --years 2024,2025

--settlements-only rewrites only valuePln in the existing group files (fast: no hospitalization CSVs).
"""
from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

from build_hospitalizations import ALL_YEARS, ROOT, VALUE_COLS, columns, iter_frames, source_path, write_json_gz

SETTLEMENTS_FILE = "zestawienie_swiadczen_2019_2026.csv"
PROVIDERS_FILE = "nfz_swiadczeniodawcy_2025.csv"
PROVIDER_CODES_SUPPLEMENT = "kody_swiadczeniodawcow_uzupelnienie.csv"


GROUP_INDEX = {"p": 0, "u": 1, "o": 2}


def product_codes_by_group(trends_path: Path) -> dict[str, set[str]]:
    """Wszystkie grupy JGP z trends.json.gz i ich kody produktów."""
    with gzip.open(trends_path, "rt", encoding="utf-8") as fh:
        trends = json.load(fh)
    out: dict[str, set[str]] = defaultdict(set)
    for code, jgp, *_ in trends["products"]:
        if jgp:
            out[jgp].add(code)
    return dict(sorted(out.items()))


def read_monthly(data_dir: Path, years: list[str], product_to_group: dict[str, str]) -> dict[str, list[list]]:
    rows: dict[str, list[list]] = defaultdict(list)
    for year in years:
        parts = []
        for frame, _ in iter_frames(source_path(data_dir, year), year):
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
    frame["key"] = frame["ow"] + "|" + frame["Kod_swiadczeniodawcy"].str.strip()
    frame["nip"] = frame["key"].map(nip_by_code)
    # Uzupełnienie kodów: kody spoza pliku 2025 i kody, przy których plik hospitalizacji ma inny NIP (w latach LATA).
    supplement_path = data_dir / PROVIDER_CODES_SUPPLEMENT
    if supplement_path.exists():
        supplement = pd.read_csv(supplement_path, dtype=str, encoding="utf-8-sig").fillna("")
        for row in supplement.itertuples(index=False):
            key = f"{row.OW_NFZ.zfill(2)}|{row.KOD_SWIADCZENIODAWCY.strip()}"
            years = [year.strip() for year in row.LATA.split(",") if year.strip()]
            mask = (frame["key"] == key) & (frame["Rok"].isin(years) if years else True)
            frame.loc[mask, "nip"] = row.NIP.strip()
    # Ostatni rok w pliku jest niepełny (dane w trakcie roku).
    last_year = frame["Rok"].max()
    frame = frame[frame["Rok"] < last_year]
    unmapped = frame.loc[frame["nip"].isna(), "value"].sum()
    if unmapped:
        print(f"Uwaga: {unmapped:,.0f} zł rozliczeń bez NIP (brak w {PROVIDERS_FILE} i {PROVIDER_CODES_SUPPLEMENT}).")
    out: dict[str, dict] = {}
    for jgp, part in frame.groupby("jgp"):
        national = part.groupby("Rok")["value"].sum().round().astype("int64")
        # Kwoty świadczeniodawców w każdym roku: ranking karty pokazuje rok wybrany przyciskiem roku.
        by_provider = part.dropna(subset=["nip"]).groupby(["Rok", "ow", "nip"])["value"].sum().round().astype("int64").reset_index()
        out[jgp] = {
            "national": {year: int(value) for year, value in national.items()},
            "providers": {
                year: [[f"{ow}|{nip}", int(value)] for _, ow, nip, value in rows.itertuples(index=False) if value]
                for year, rows in by_provider.groupby("Rok")
            },
        }
    return out


def compact(group: str, years: list[str], rows: list[list], settlements: dict | None) -> dict:
    """Plik grupy w formacie v3: lista świadczeniodawców i wiersze z indeksami zapisane kolumnami."""
    keys = sorted({f"{ow}|{nip}" for _, _, ow, nip, *_ in rows})
    index = {key: i for i, key in enumerate(keys)}
    year_index = {year: i for i, year in enumerate(years)}
    packed = [
        [index[f"{ow}|{nip}"], year_index[year] * 12 + month - 1, GROUP_INDEX[admission], h_min, d_min]
        for year, month, ow, nip, admission, _h_sim, h_min, _d_sim, d_min in rows
        if h_min or d_min
    ]
    payload = {"version": 3, "jgp": group, "years": years, "providers": keys,
               "rows": columns(packed, ["provider", "month", "admission", "hospitalizations", "deaths"])}
    if settlements:
        payload["valuePln"] = settlements
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default=ALL_YEARS, help="lata oddzielone przecinkami")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--trends", type=Path, default=ROOT / "public" / "data" / "hospitalizations" / "trends.json.gz")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "build-data" / "jgp")
    parser.add_argument("--settlements-only", action="store_true", help="podmień tylko valuePln w istniejących plikach grup")
    args = parser.parse_args()

    if args.settlements_only:
        files = sorted(args.output_dir.glob("*.json.gz"))
        settlements = read_settlements(args.data_dir, {path.name.removesuffix(".json.gz") for path in files})
        for path in files:
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
            payload.pop("valuePln", None)
            if payload["jgp"] in settlements:
                payload["valuePln"] = settlements[payload["jgp"]]
            write_json_gz(path, payload)
        print(f"jgp: rozliczenia podmienione w {len(files)} plikach")
        return

    years = sorted({y.strip() for y in args.years.split(",") if y.strip()})
    codes = product_codes_by_group(args.trends)
    product_to_group = {code: group for group, group_codes in codes.items() for code in group_codes}

    monthly = read_monthly(args.data_dir, years, product_to_group)
    settlements = read_settlements(args.data_dir, set(codes))
    # Stare pliki (np. grupy, które zniknęły z danych) usuwamy, żeby katalog odpowiadał indeksowi.
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for old in args.output_dir.glob("*.json.gz"):
        old.unlink()
    total = 0
    for group in codes:
        total += write_json_gz(args.output_dir / f"{group}.json.gz", compact(group, years, monthly.get(group, []), settlements.get(group)))
    index = {"version": 2, "years": years, "groups": list(codes)}
    (args.output_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False) + "\n", encoding="utf-8")
    largest = max((p.stat().st_size, p.name) for p in args.output_dir.glob("*.json.gz"))
    print(f"jgp: {len(codes)} grup, razem {total / 1024 / 1024:.2f} MiB, największy {largest[1]} {largest[0] / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
