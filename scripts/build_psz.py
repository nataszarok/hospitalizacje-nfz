#!/usr/bin/env python3
"""Build the hospital network list (PSZ) for the browser: public/data/psz.json.gz.

Source: data/PSZ_Polska_<rok>_z_NIP.xlsx, sheet "PSZ Polska" (NFZ lists of the hospital network,
"system podstawowego szpitalnego zabezpieczenia", with the NIP of each provider).
One row per NIP; when a NIP has several facilities, the first level in LEVELS order is kept.
  {"version": 1, "listDate": "2026-07-22", "levels": [...], "rows": [["6151794076", 0], ...]}

Usage:
  python3 scripts/build_psz.py
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import openpyxl

from build_hospitalizations import ROOT, write_json_gz

SHEET = "PSZ Polska"
LEVELS = ["I stopnia", "II stopnia", "III stopnia", "onkologiczny / pulmonologiczny", "pediatryczny", "ogólnopolski"]


def iso_date(value) -> str | None:
    """Data wykazu jako RRRR-MM-DD (arkusz ma daty w formatach RRRR-MM-DD i DD.MM.RRRR)."""
    text = str(value or "").strip()[:10]
    if match := re.fullmatch(r"(\d{2})\.(\d{2})\.(\d{4})", text):
        return f"{match[3]}-{match[2]}-{match[1]}"
    return text if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text) else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, default=ROOT / "data" / "PSZ_Polska_2026_z_NIP.xlsx")
    parser.add_argument("--output", type=Path, default=ROOT / "public" / "data" / "psz.json.gz")
    args = parser.parse_args()

    sheet = openpyxl.load_workbook(args.input, read_only=True)[SHEET]
    rows = sheet.iter_rows(values_only=True)
    header = list(next(rows))
    nip_col, level_col, date_col = header.index("NIP"), header.index("Poziom PSZ"), header.index("Data wykazu")
    levels: dict[str, int] = {}
    dates: set[str] = set()
    for row in rows:
        nip = re.sub(r"\D", "", str(row[nip_col] or ""))
        level = str(row[level_col] or "").strip()
        if len(nip) != 10 or level not in LEVELS:
            raise SystemExit(f"Invalid PSZ row: NIP={row[nip_col]!r}, level={row[level_col]!r}")
        levels[nip] = min(levels.get(nip, len(LEVELS)), LEVELS.index(level))
        if date := iso_date(row[date_col]):
            dates.add(date)
    payload = {"version": 1, "listDate": max(dates) if dates else None, "levels": LEVELS, "rows": sorted([nip, level] for nip, level in levels.items())}
    write_json_gz(args.output, payload)
    print(f"PSZ: {len(levels)} providers (NIP) -> {args.output}")


if __name__ == "__main__":
    main()
