#!/usr/bin/env python3
"""Build yearly JGP valuation tables from the official NFZ catalogs (Annex 1a, "Katalog grup").

Source: the "Katalog grup" sheet of Annex 1a to the NFZ President's orders on hospital treatment
("leczenie szpitalne oraz leczenie szpitalne – świadczenia wysokospecjalistyczne"). Each order that
changes the catalog is saved as one file in data/wyceny/zrodla/ named
    <YYYY-MM-DD>_<order>.xlsx      e.g. 2019-07-01_77-2019-DSOZ.xlsx
where the date is when the catalog version starts to apply. The files come from nfz.gov.pl (orders
up to January 2022) and from the NFZ Baza Aktów Własnych (baw.nfz.gov.pl, later orders).

Output: data/wyceny/wyceny_jgp_<rok>.csv, one row per product and catalog version in force during
that year, with the number of months the version applied in that year (miesiace). A version starting
mid-month counts from the next full month. Columns read by the <5 calibration:
    rok, obowiazuje_od, zarzadzenie, miesiace, kod_produktu, kod_grupy,
    pkt_hospitalizacja, pkt_planowa, pkt_jeden_dzien, pkt_ponizej_3_dni,
    pkt_0_dni, pkt_1_dzien, pkt_2_dni, dni_finansowane, pkt_osobodzien

Usage:
  python3 scripts/build_valuation_history.py --years 2019-2024
"""
from __future__ import annotations

import argparse
import re
import warnings
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data" / "wyceny" / "zrodla"
OUT_DIR = ROOT / "data" / "wyceny"
SHEET_PATTERN = re.compile(r"katalog grup", re.I)
PRODUCT = re.compile(r"^5\.51\.01\.\d{7}$")

# Kolumna wyjściowa → wzorzec nagłówka (wiersz nagłówka i wiersz pod nim są łączone). Kolejność ma znaczenie:
# pierwsza pasująca reguła wygrywa.
COLUMNS = [
    ("kod_grupy", r"^kod grupy"),
    ("kod_produktu", r"^kod produktu"),
    ("pkt_planowa", r"warto\S+ punktowa\s*-\s*hospitalizacja planowa"),
    ("pkt_jeden_dzien", r"leczenie jednego dnia"),
    ("dni_finansowane", r"liczba dni pobytu"),
    ("pkt_ponizej_3_dni", r"<\s*3\s*dni"),
    ("pkt_0_dni", r"dzie\S+ przyj\S+ = dzie\S+ wypisu"),
    ("pkt_1_dzien", r"1-dniowej"),
    ("pkt_2_dni", r"2-dniowej"),
    ("pkt_osobodzien", r"osobodnia ponad"),
    ("pkt_hospitalizacja", r"warto\S+ punktowa\s*-\s*hospitalizacja"),
]
NUMERIC = [name for name, _ in COLUMNS if name.startswith(("pkt_", "dni_"))]


def find_sheet(path: Path) -> tuple[pd.DataFrame, int]:
    """Arkusz katalogu i numer wiersza nagłówka (wiersz z „Kod produktu”)."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        book = pd.ExcelFile(path)
        name = next((s for s in book.sheet_names if SHEET_PATTERN.search(s)), book.sheet_names[0])
        raw = book.parse(name, header=None, dtype=str)
    for i in range(min(len(raw), 30)):
        if raw.iloc[i].fillna("").str.strip().str.match(r"(?i)^kod produktu").any():
            return raw, i
    raise SystemExit(f"{path.name}: brak wiersza nagłówka z „Kod produktu”")


def read_catalog(path: Path) -> pd.DataFrame:
    raw, header = find_sheet(path)
    top = raw.iloc[header].fillna("")
    below = raw.iloc[header + 1].fillna("") if header + 1 < len(raw) else top * 0
    labels = [" ".join(f"{a} {b}".split()).lower() for a, b in zip(top, below)]
    picked: dict[str, int] = {}
    for col, label in enumerate(labels):
        for name, pattern in COLUMNS:
            if name not in picked and re.search(pattern, label):
                picked[name] = col
                break
    missing = {"kod_produktu", "pkt_hospitalizacja"} - picked.keys()
    if missing:
        raise SystemExit(f"{path.name}: brak kolumn {sorted(missing)}; nagłówki: {labels}")
    body = raw.iloc[header + 1 :]
    out = pd.DataFrame({name: body.iloc[:, col].values for name, col in picked.items()})
    out["kod_produktu"] = out["kod_produktu"].fillna("").str.strip()
    out = out[out["kod_produktu"].str.match(PRODUCT)].copy()
    for name in NUMERIC:
        if name in out:
            out[name] = pd.to_numeric(out[name].str.replace(",", ".").str.replace(r"\s", "", regex=True), errors="coerce")
    if "kod_grupy" in out:
        out["kod_grupy"] = out["kod_grupy"].fillna("").str.strip()
    return out.drop_duplicates("kod_produktu")


def versions() -> list[tuple[date, str, Path]]:
    items = []
    for path in sorted(SOURCE_DIR.glob("*.xls*")):
        m = re.match(r"(\d{4}-\d{2}-\d{2})_(.+)\.xlsx?$", path.name)
        if not m:
            raise SystemExit(f"{path.name}: nazwa pliku musi mieć postać RRRR-MM-DD_<zarządzenie>.xlsx")
        items.append((date.fromisoformat(m.group(1)), m.group(2).replace("-", "/", 2), path))
    return sorted(items)


def month_index(d: date) -> int:
    """Pierwszy pełny miesiąc obowiązywania (wersja od 2. dnia miesiąca liczy się od następnego miesiąca)."""
    return d.year * 12 + (d.month - 1) + (0 if d.day == 1 else 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2019-2024", help="zakres lat, np. 2019-2024")
    args = parser.parse_args()
    first, last = (int(y) for y in args.years.split("-"))
    found = versions()
    if not found:
        raise SystemExit(f"Brak plików katalogu w {SOURCE_DIR}")
    starts = [month_index(d) for d, _, _ in found]
    for year in range(first, last + 1):
        frames = []
        for i, (since, order, path) in enumerate(found):
            begin = max(starts[i], year * 12)
            end = min(starts[i + 1] if i + 1 < len(found) else 10**9, year * 12 + 12)
            months = end - begin
            if months <= 0:
                continue
            table = read_catalog(path)
            table.insert(0, "miesiace", months)
            table.insert(0, "zarzadzenie", order)
            table.insert(0, "obowiazuje_od", since.isoformat())
            table.insert(0, "rok", year)
            frames.append(table)
        if not frames:
            print(f"{year}: brak wersji katalogu")
            continue
        result = pd.concat(frames, ignore_index=True)
        cols = ["rok", "obowiazuje_od", "zarzadzenie", "miesiace", "kod_produktu", "kod_grupy"] + NUMERIC
        result = result.reindex(columns=cols)
        path = OUT_DIR / f"wyceny_jgp_{year}.csv"
        result.to_csv(path, index=False)
        summary = result.groupby(["obowiazuje_od", "zarzadzenie"]).agg(miesiace=("miesiace", "first"), produkty=("kod_produktu", "size"))
        print(f"{year}: {path.relative_to(ROOT)}\n{summary.to_string()}")


if __name__ == "__main__":
    main()
