#!/usr/bin/env python3
"""Build static hospitalization data (one file per year + trends) for the browser.

Reads the raw NFZ exports (one CSV per year) and writes:
  public/data/hospitalizations/index.json      list of years, latest year, default product
  public/data/hospitalizations/<year>.json.gz  full detail for one year (same shape as the
                                               former dashboard.json.gz; layer 2)
  public/data/hospitalizations/trends.json.gz  small aggregates for every year (layer 1):
                                               JGP x year x month and JGP x year x NFZ branch

Values "<5" are estimated per year in file order with a fixed seed (method "sim":
draw 1-4 with weights exp(-x); method "min": 1), exactly like the former db_build
pipeline, so the 2025 output matches the previous dashboard.json.gz.

JGP product names come from data/kody_produktu_jgp.csv (current catalog). Codes that
no longer exist there (e.g. groups removed after 2024) are taken from the NFZ JGP
statistics dictionary cached in data/jgp_benefits_nfz.json (--fetch-nfz-catalog
downloads it from api.nfz.gov.pl). A code missing in both sources stops the build.

Provider names: data_exports/supabase/facilities.csv, then
data/nfz_swiadczeniodawcy_2025.csv, then data/szpitale_uzupelnienie.csv (by NIP).
Providers missing everywhere get a placeholder name and are listed in the report;
add them to data/szpitale_uzupelnienie.csv.

Usage:
  python3 scripts/build_hospitalizations.py --years 2024,2025
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import subprocess
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SEED = 42
CHUNK_SIZE = 200_000
DEATH_DISCHARGE_CODE = "9"
DEFAULT_PRODUCT_CODE = "5.51.01.0005010"  # E10
NFZ_BENEFITS_URL = (
    "https://api.nfz.gov.pl/app-stat-api-jgp/benefits"
    "?catalog=1a&format=json&api-version=1.1&limit=25&page={page}"
)

RAW_COLUMNS = [
    "ROK", "MIESIAC", "OW_NFZ", "NIP_PODMIOTU", "KOD_PRODUKTU_KONTRAKTOWEGO",
    "KOD_PRODUKTU_JEDNOSTKOWEGO", "KOD_TRYBU_PRZYJECIA", "KOD_TRYBU_WYPISU",
    "PLEC_PACJENTA", "GRUPA_WIEKOWA_PACJENTA", "PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI",
    "LICZBA_HOSPITALIZACJI",
]
FACT_KEYS = ["ow", "nip", "product", "duration", "admission"]
VALUE_COLS = ["h_sim", "h_min", "d_sim", "d_min"]


def admission_group(code: str) -> str:
    """Grupa trybu przyjęcia w trendach: p = planowe (6), u = nagłe (2, 3), o = pozostałe."""
    if code == "6":
        return "p"
    if code in ("2", "3"):
        return "u"
    return "o"


def normalize_duration(value: str) -> str:
    # Starsze eksporty mają „wiecej” bez polskiego znaku albo w cp1250.
    return re.sub(r"wi\S*cej", "więcej", value.strip())


def normalize_nip(series: pd.Series) -> pd.Series:
    return series.astype("string").str.replace(r"\D", "", regex=True)


def read_year(path: Path, year: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, int]:
    """Zwraca fakty (szczegóły), trend miesięczny i trend regionalny dla jednego roku."""
    rng = np.random.default_rng(SEED)
    values = np.array([1, 2, 3, 4])
    weights = np.exp(-values)
    p = weights / weights.sum()

    facts: list[pd.DataFrame] = []
    monthly: list[pd.DataFrame] = []
    regional: list[pd.DataFrame] = []
    rows = 0
    for chunk in pd.read_csv(path, sep=";", dtype=str, chunksize=CHUNK_SIZE, keep_default_na=False):
        chunk = chunk[RAW_COLUMNS]
        years = set(chunk["ROK"].str.strip())
        if years != {year}:
            raise SystemExit(f"{path.name}: oczekiwano roku {year}, znaleziono {sorted(years)}")
        raw = chunk["LICZBA_HOSPITALIZACJI"].str.strip()
        suppressed = raw.eq("<5").to_numpy()
        h_sim = pd.to_numeric(raw, errors="coerce").to_numpy(dtype="float64")
        h_min = h_sim.copy()
        if suppressed.any():
            h_sim[suppressed] = rng.choice(values, size=int(suppressed.sum()), p=p)
            h_min[suppressed] = 1
        h_sim = np.nan_to_num(h_sim)
        h_min = np.nan_to_num(h_min)
        death = chunk["KOD_TRYBU_WYPISU"].str.strip().eq(DEATH_DISCHARGE_CODE).to_numpy()
        frame = pd.DataFrame({
            "month": pd.to_numeric(chunk["MIESIAC"].str.strip()).astype("int64"),
            "ow": chunk["OW_NFZ"].str.strip().str.zfill(2),
            "nip": normalize_nip(chunk["NIP_PODMIOTU"]),
            "product": chunk["KOD_PRODUKTU_JEDNOSTKOWEGO"].str.strip(),
            "duration": chunk["PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"].map(normalize_duration),
            "admission": chunk["KOD_TRYBU_PRZYJECIA"].str.strip(),
            "h_sim": h_sim, "h_min": h_min,
            "d_sim": np.where(death, h_sim, 0.0), "d_min": np.where(death, h_min, 0.0),
        })
        frame["group"] = frame["admission"].map(admission_group)
        facts.append(frame.groupby(FACT_KEYS, sort=False)[VALUE_COLS].sum().reset_index())
        monthly.append(frame.groupby(["month", "product", "group"], sort=False)[VALUE_COLS].sum().reset_index())
        regional.append(frame.groupby(["ow", "product", "group"], sort=False)[VALUE_COLS].sum().reset_index())
        rows += len(chunk)

    def combine(parts: list[pd.DataFrame], keys: list[str]) -> pd.DataFrame:
        out = pd.concat(parts).groupby(keys, sort=True)[VALUE_COLS].sum().reset_index()
        out[VALUE_COLS] = out[VALUE_COLS].round().astype("int64")
        return out

    return (
        combine(facts, FACT_KEYS),
        combine(monthly, ["month", "product", "group"]),
        combine(regional, ["ow", "product", "group"]),
        rows,
    )


def fetch_nfz_catalog(path: Path) -> None:
    """Pobiera słownik świadczeń JGP (katalog 1a) z API statystyk NFZ."""
    entries: list[dict[str, str]] = []
    page = 1
    while True:
        url = NFZ_BENEFITS_URL.format(page=page)
        for attempt in range(6):
            out = subprocess.run(["curl", "-s", "-m", "60", url], capture_output=True, text=True).stdout
            try:
                payload = json.loads(out)
                break
            except json.JSONDecodeError:
                time.sleep(2 + attempt * 2)
        else:
            raise SystemExit(f"Nie udało się pobrać {url}")
        entries += payload.get("data") or []
        if not payload["links"]["next"]:
            break
        page += 1
        time.sleep(0.3)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"NFZ catalog: {len(entries)} codes -> {path}")


def load_product_catalog(local: Path, nfz: Path) -> tuple[dict[str, tuple[str, str]], dict[str, tuple[str, str]]]:
    current: dict[str, tuple[str, str]] = {}
    with local.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            code = (row.get("KOD_PRODUKTU_JEDNOSTKOWEGO") or "").strip()
            if code:
                current[code] = ((row.get("KOD_JGP") or "").strip(), (row.get("NAZWA") or "").strip())
    historic: dict[str, tuple[str, str]] = {}
    if nfz.exists():
        for entry in json.loads(nfz.read_text(encoding="utf-8")):
            # Nazwa w słowniku NFZ zaczyna się od kodu JGP, np. „F04 DIAGNOSTYCZNE…”.
            jgp, _, name = entry["name"].strip().partition(" ")
            historic[entry["code"].strip()] = (jgp, re.sub(r"\s+", " ", name).strip())
    return current, historic


def load_facility_names(exports: Path, data: Path) -> tuple[dict[str, tuple[str, str]], dict[str, tuple[str, str]], dict[str, tuple[str, str]]]:
    curated: dict[str, tuple[str, str]] = {}
    path = exports / "facilities.csv"
    if path.exists():
        with path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                curated[f"{row['ow_nfz']}|{row['nip']}"] = (row["provider_name"], row.get("city") or "")
    nfz: dict[str, tuple[str, str]] = {}
    path = data / "nfz_swiadczeniodawcy_2025.csv"
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                nip = re.sub(r"\D", "", row["nip"])
                key = f"{row['oddzial_nfz'].strip().zfill(2)}|{nip}"
                nfz.setdefault(key,(row["swiadczeniodawca"].strip(), row["miejscowosc"].strip()))
    supplement: dict[str, tuple[str, str]] = {}
    path = data / "szpitale_uzupelnienie.csv"
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                supplement.setdefault(re.sub(r"\D", "", row["NIP"]), (row["Świadczeniodawca"].strip(), row["Miejscowość"].strip().upper()))
    return curated, nfz, supplement


def read_reference(exports: Path) -> tuple[list[list[str]], list[list[Any]]]:
    with (exports / "nfz_regions.csv").open(encoding="utf-8", newline="") as fh:
        regions = sorted(csv.DictReader(fh), key=lambda r: int(r["sort_order"]))
    with (exports / "population_voivodeship.csv").open(encoding="utf-8", newline="") as fh:
        populations = list(csv.DictReader(fh))
    return (
        [[r["ow_nfz"], r["voivodeship"]] for r in regions],
        [[r["ow_nfz"], int(float(r["population"]))] for r in populations],
    )


def write_json_gz(path: Path, payload: dict[str, Any]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime=0: ten sam wynik daje identyczny plik (czysty diff w git).
    with path.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as fh:
        fh.write(data)
    return path.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2024,2025", help="lata oddzielone przecinkami")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--exports-dir", type=Path, default=ROOT / "data_exports" / "supabase")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "public" / "data" / "hospitalizations")
    parser.add_argument("--catalog", type=Path, default=None, help="domyślnie data/kody_produktu_jgp.csv")
    parser.add_argument("--nfz-catalog", type=Path, default=None, help="domyślnie data/jgp_benefits_nfz.json")
    parser.add_argument("--fetch-nfz-catalog", action="store_true", help="pobierz słownik JGP z API NFZ")
    args = parser.parse_args()

    years = sorted({y.strip() for y in args.years.split(",") if y.strip()})
    catalog_path = args.catalog or args.data_dir / "kody_produktu_jgp.csv"
    nfz_catalog_path = args.nfz_catalog or args.data_dir / "jgp_benefits_nfz.json"
    if args.fetch_nfz_catalog or not nfz_catalog_path.exists():
        fetch_nfz_catalog(nfz_catalog_path)

    current, historic = load_product_catalog(catalog_path, nfz_catalog_path)
    curated, nfz_names, supplement = load_facility_names(args.exports_dir, args.data_dir)
    regions, populations = read_reference(args.exports_dir)

    monthly_rows: list[list[Any]] = []
    regional_rows: list[list[Any]] = []
    product_years: dict[str, list[str]] = defaultdict(list)
    product_info: dict[str, tuple[str, str]] = {}
    report: list[str] = []

    for year in years:
        source = args.data_dir / f"hospitalizacje_{year}.csv"
        facts, monthly, regional, raw_rows = read_year(source, year)

        codes = sorted(facts["product"].unique())
        products = []
        missing = []
        for code in codes:
            info = current.get(code) or historic.get(code)
            if not info:
                missing.append(code)
                continue
            if code not in current:
                report.append(f"{year}: {code} {info[0]} spoza bieżącego katalogu (słownik NFZ)")
            product_info.setdefault(code, info)
            product_years[code].append(year)
            products.append([code, info[0] or None, info[1] or None])
        if missing:
            raise SystemExit(f"{year}: brak nazw dla kodów JGP {missing}. Uruchom z --fetch-nfz-catalog.")

        facility_keys = sorted(set(facts["ow"] + "|" + facts["nip"]))
        facilities = []
        for key in facility_keys:
            ow, nip = key.split("|")
            name, city = curated.get(key) or nfz_names.get(key) or supplement.get(nip) or ("", "")
            if not name:
                hosp = int(facts.loc[(facts["ow"] == ow) & (facts["nip"] == nip), "h_min"].sum())
                report.append(f"{year}: brak nazwy świadczeniodawcy {key} ({hosp} hospitalizacji, metoda min)")
                name = f"Świadczeniodawca NIP {nip}"
            facilities.append([ow, nip, name, city])

        dataset = {
            "version": 1,
            "analysisYear": year,
            "defaultProductCode": DEFAULT_PRODUCT_CODE,
            "products": products,
            "regions": regions,
            "facilities": facilities,
            "populations": populations,
            "facts": facts[FACT_KEYS + VALUE_COLS].values.tolist(),
        }
        size = write_json_gz(args.output_dir / f"{year}.json.gz", dataset)
        print(f"{year}: {raw_rows:,} source rows -> {len(facts):,} facts, {len(products)} products, "
              f"{len(facilities)} providers, {size / 1024 / 1024:.2f} MiB")

        monthly_rows += [[year, *r] for r in monthly[["month", "product", "group"] + VALUE_COLS].values.tolist()]
        regional_rows += [[year, *r] for r in regional[["ow", "product", "group"] + VALUE_COLS].values.tolist()]

    # Trendy: produkty ze wszystkich lat, wiersze odwołują się do indeksu produktu.
    codes = sorted(product_info)
    index = {code: i for i, code in enumerate(codes)}
    trends = {
        "version": 1,
        "years": years,
        "products": [[code, product_info[code][0] or None, product_info[code][1] or None, product_years[code]] for code in codes],
        "monthly": [[y, m, index[p], g, *v] for y, m, p, g, *v in monthly_rows],
        "regional": [[y, ow, index[p], g, *v] for y, ow, p, g, *v in regional_rows],
    }
    size = write_json_gz(args.output_dir / "trends.json.gz", trends)
    print(f"trends: {len(trends['monthly']):,} monthly + {len(trends['regional']):,} regional rows, {size / 1024:.0f} KiB")

    index_payload = {"version": 1, "years": years, "latestYear": years[-1], "defaultProductCode": DEFAULT_PRODUCT_CODE}
    (args.output_dir / "index.json").write_text(json.dumps(index_payload, ensure_ascii=False) + "\n", encoding="utf-8")

    if report:
        print("\nUwagi:")
        for line in report:
            print(f"  - {line}")


if __name__ == "__main__":
    main()
