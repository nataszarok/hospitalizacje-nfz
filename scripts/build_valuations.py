#!/usr/bin/env python3
"""Build the JGP valuation catalog for the browser: public/data/wyceny_jgp_<rok>.json.gz.

Source: data/wyceny_jgp_<rok>.xlsx, sheet "Katalog grup" (NFZ JGP catalog: points per group).
Only the columns read by the UI are kept; rows are tuples in the order of "fields":
  {"version": 2, "year": "2025", "source": ..., "fields": [...], "rows": [[...], ...]}
Group names are not stored (the UI takes them from the hospitalization data).

Usage:
  python3 scripts/build_valuations.py --year 2025
"""
from __future__ import annotations

import argparse
from pathlib import Path

import openpyxl

from build_hospitalizations import ROOT, write_json_gz

SHEET = "Katalog grup"
# Kolumna w arkuszu → pole w pliku (kolejność = kolejność w krotce).
COLUMNS = [
    ("Kod grupy", "kod_jgp"),
    ("Kod produktu", "kod_produktu"),
    ("Wartość punktowa - hospitalizacja", "pkt_hospitalizacja"),
    ("Wartość punktowa - hospitalizacja planowa", "pkt_hospitalizacja_planowa"),
    ('Wartość punktowa - "leczenie jednego dnia"', "pkt_jeden_dzien"),
    ("Liczba dni pobytu finansowana grupą - typ umowy hospitalizacja", "dni_finansowane_grupa"),
    ("Wartość punktowa hospitalizacji dzień przyjęcia = dzień wypisu - typ umowy hospitalizacja/hospitalizacja planowa", "pkt_przyjecie_wypis_ten_sam_dzien"),
    ("Wartość punktowa hospitalizacji 1-dniowej - typ umowy hospitalizacja/hospitalizacja planowa", "pkt_hospitalizacja_1_dniowa"),
    ("Wartość punktowa hospitalizacji 2-dniowej - typ umowy hospitalizacja/hospitalizacja planowa", "pkt_hospitalizacja_2_dniowa"),
    ("Wartość punktowa osobodnia ponad ryczałt finansowany grupą - typ umowy hospitalizacja", "pkt_osobodzien_ponad_ryczalt"),
]


def number(value):
    if value is None or value == "":
        return None
    value = float(value)
    return int(value) if value.is_integer() else value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", default="2025")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "public" / "data")
    args = parser.parse_args()

    source = args.data_dir / f"wyceny_jgp_{args.year}.xlsx"
    sheet = openpyxl.load_workbook(source, read_only=True, data_only=True)[SHEET]
    rows_iter = sheet.iter_rows(values_only=True)
    header = [str(cell).strip() if cell is not None else "" for cell in next(rows_iter)]
    try:
        positions = [header.index(column) for column, _ in COLUMNS]
    except ValueError as error:
        raise SystemExit(f"{source.name}: brak kolumny {error}") from error

    rows = []
    for raw in rows_iter:
        code = raw[positions[0]]
        if not code:
            continue
        rows.append([str(code).strip(), str(raw[positions[1]]).strip(), *[number(raw[i]) for i in positions[2:]]])
    codes = [row[0] for row in rows]
    if len(codes) != len(set(codes)):
        raise SystemExit(f"{source.name}: powtórzone kody grup")

    payload = {
        "version": 2,
        "year": args.year,
        "source": f"{source.name} / {SHEET}",
        "fields": [field for _, field in COLUMNS],
        "rows": rows,
    }
    size = write_json_gz(args.output_dir / f"wyceny_jgp_{args.year}.json.gz", payload)
    print(f"wyceny {args.year}: {len(rows)} grup, {size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
