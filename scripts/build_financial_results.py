#!/usr/bin/env python3
"""Build a compact financial-results JSON.GZ for the hospital dashboard.

Input workbook structure expected by this project:
- Podmioty_NIP: curated 2025 values by NIP (canonical when present),
- Fallback_2024: 2024 fallback values and, for some entities, an older latest year.

A missing year/metric remains null.

Usage:
    python scripts/build_financial_results.py INPUT.xlsx public/data/financial_results.json.gz
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zipfile import ZipFile
import xml.etree.ElementTree as ET

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": DOC_REL_NS, "pr": PKG_REL_NS}


def normalize_nip(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def as_number(value: Any) -> float | int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
    try:
        text = str(value).strip().replace(" ", "").replace(",", ".")
        if not text:
            return None
        num = float(text)
        if not math.isfinite(num):
            return None
        return int(num) if num.is_integer() else num
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    num = as_number(value)
    return int(num) if num is not None else None


def value_present(*values: Any) -> bool:
    return any(as_number(v) is not None for v in values)


def precision_from_text(*parts: Any) -> str:
    text = " ".join(str(x or "") for x in parts).lower()
    if "zaokrągl" in text or "przybli" in text or "ok." in text:
        return "rounded"
    if "dokład" in text:
        return "exact"
    if "oficjal" in text:
        return "official"
    return "unspecified"


class SimpleXlsx:
    """Dependency-free XLSX reader for cached values needed by the converter."""

    def __init__(self, path: Path):
        self.path = path
        self.zip = ZipFile(path)
        self.shared_strings = self._load_shared_strings()
        self.sheet_paths = self._load_sheet_paths()

    def close(self) -> None:
        self.zip.close()

    def __enter__(self) -> "SimpleXlsx":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def _load_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self.zip.namelist():
            return []
        root = ET.fromstring(self.zip.read("xl/sharedStrings.xml"))
        out: list[str] = []
        for si in root.findall("m:si", NS):
            chunks = [t.text or "" for t in si.iter(f"{{{MAIN_NS}}}t")]
            out.append("".join(chunks))
        return out

    def _load_sheet_paths(self) -> dict[str, str]:
        workbook = ET.fromstring(self.zip.read("xl/workbook.xml"))
        rels = ET.fromstring(self.zip.read("xl/_rels/workbook.xml.rels"))
        rel_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        result: dict[str, str] = {}
        sheets = workbook.find("m:sheets", NS)
        if sheets is None:
            return result
        for sheet in sheets:
            name = sheet.attrib["name"]
            rel_id = sheet.attrib[f"{{{DOC_REL_NS}}}id"]
            target = rel_map[rel_id]
            result[name] = target.lstrip("/") if target.startswith("/") else "xl/" + target.lstrip("/")
        return result

    @staticmethod
    def _column(ref: str) -> str:
        m = re.match(r"([A-Z]+)", ref)
        return m.group(1) if m else ""

    def _cell_value(self, cell: ET.Element) -> Any:
        cell_type = cell.attrib.get("t")
        if cell_type == "inlineStr":
            node = cell.find(".//m:t", NS)
            return node.text if node is not None else ""
        value = cell.find("m:v", NS)
        if value is None:
            return None
        raw = value.text or ""
        if cell_type == "s":
            try:
                return self.shared_strings[int(raw)]
            except (ValueError, IndexError):
                return raw
        if cell_type == "b":
            return raw == "1"
        if cell_type in {"str", "e"}:
            return raw
        try:
            num = float(raw)
            return int(num) if num.is_integer() else num
        except ValueError:
            return raw

    def rows(self, sheet_name: str) -> Iterable[dict[str, Any]]:
        path = self.sheet_paths.get(sheet_name)
        if not path:
            raise KeyError(f"Workbook does not contain sheet: {sheet_name}")
        root = ET.fromstring(self.zip.read(path))
        for row in root.findall(".//m:sheetData/m:row", NS):
            record: dict[str, Any] = {}
            for cell in row.findall("m:c", NS):
                record[self._column(cell.attrib.get("r", ""))] = self._cell_value(cell)
            yield record


def make_year_record(
    year: int,
    revenue: Any = None,
    net_result: Any = None,
    assets: Any = None,
    status: str | None = None,
    source_service: str | None = None,
    source_url: str | None = None,
    notes: str | None = None,
    precision: str | None = None,
) -> dict[str, Any]:
    revenue_n = as_number(revenue)
    net_n = as_number(net_result)
    assets_n = as_number(assets)
    margin = (float(net_n) / float(revenue_n)) if net_n is not None and revenue_n not in (None, 0) else None
    return {
        "year": int(year),
        "revenue": revenue_n,
        "net_result": net_n,
        "net_margin": margin,
        "assets": assets_n,
        "has_values": value_present(revenue_n, costs_n, net_n, assets_n),
        "status": status or None,
        "precision": precision or precision_from_text(status, notes),
        "source_service": source_service or None,
        "source_url": source_url or None,
        "notes": notes or None,
    }


def source_quality(row: dict[str, Any]) -> float:
    status = str(row.get("L") or "").lower()
    notes = str(row.get("M") or "").lower()
    score = 0.0
    if as_number(row.get("H")) is not None:
        score += 8
    if as_number(row.get("F")) is not None:
        score += 4
    if as_number(row.get("G")) is not None:
        score += 4
    if as_number(row.get("E")) is not None:
        score += 1
    if "zweryfik" in status:
        score += 4
    if "oficjal" in status or "oficjal" in notes:
        score += 3
    if "dokład" in status or "dokład" in notes:
        score += 1
    if "brak potwierdzonej" in status or "brak publicznej kwoty" in status or "kwota do odczytu" in status:
        score -= 8
    return score


def close_enough(a: Any, b: Any) -> bool:
    x, y = as_number(a), as_number(b)
    if x is None or y is None:
        return False
    tolerance = max(2.0, 0.001 * max(abs(float(x)), abs(float(y)), 1.0))
    return abs(float(x) - float(y)) <= tolerance


def build_payload(input_path: Path) -> dict[str, Any]:
    entities: dict[str, dict[str, Any]] = {}
    source_2025: dict[str, list[dict[str, Any]]] = defaultdict(list)

    def entity(nip: str, name: str | None = None) -> dict[str, Any]:
        current = entities.setdefault(nip, {"nip": nip, "name": name or None, "years": {}})
        if name and not current.get("name"):
            current["name"] = name
        return current

    with SimpleXlsx(input_path) as book:
        for row in book.rows("Zrodla_KRS_RDF"):
            if row.get("A") == "NIP":
                continue
            nip = normalize_nip(row.get("A"))
            if len(nip) != 10:
                continue
            year = as_int(row.get("D"))
            if year == 2025:
                source_2025[nip].append(row)

        # Canonical 2025 table. Preserve records even when values are missing,
        # because the status is useful to distinguish "checked but unavailable".
        for row in book.rows("Podmioty_NIP"):
            if row.get("A") == "NIP":
                continue
            nip = normalize_nip(row.get("A"))
            if len(nip) != 10:
                continue
            name = str(row.get("B") or "").strip() or None
            e = entity(nip, name)

            candidates = source_2025.get(nip, [])
            canonical_rev = row.get("F")
            canonical_result = row.get("G")

            # Choose a source row for cost/provenance. Prefer verified rows that
            # agree with the canonical revenue/result where comparable.
            best = None
            best_score = -10_000.0
            for c in candidates:
                score = source_quality(c)
                if close_enough(c.get("F"), canonical_rev):
                    score += 3
                if close_enough(c.get("H"), canonical_result):
                    score += 5
                if as_number(c.get("G")) is not None:
                    score += 2
                if score > best_score:
                    best, best_score = c, score

            annual = make_year_record(
                2025,
                revenue=canonical_rev if as_number(canonical_rev) is not None else (best or {}).get("F"),
                net_result=canonical_result if as_number(canonical_result) is not None else (best or {}).get("H"),
                assets=row.get("I") if as_number(row.get("I")) is not None else (best or {}).get("E"),
                status=str(row.get("J") or (best or {}).get("L") or "") or None,
                source_service=str(row.get("K") or (best or {}).get("I") or "") or None,
                source_url=str(row.get("L") or (best or {}).get("J") or "") or None,
                notes=str((best or {}).get("M") or "") or None,
                precision=precision_from_text(row.get("J"), (best or {}).get("L"), (best or {}).get("M")),
            )
            e["years"]["2025"] = annual

        # Include valid 2025 source rows that are not present in canonical table
        # (e.g. newly verified records added to the source sheet).
        for nip, candidates in source_2025.items():
            e = entity(nip)
            existing = e["years"].get("2025")
            if existing and existing.get("net_result") is not None:
                continue
            best = max(candidates, key=source_quality)
            if not value_present(best.get("E"), best.get("F"), best.get("G"), best.get("H")) and not best.get("L"):
                continue
            e["name"] = e.get("name") or (str(best.get("B") or "").strip() or None)
            source_record = make_year_record(
                2025,
                revenue=best.get("F"),
                net_result=best.get("H"),
                assets=best.get("E"),
                status=str(best.get("L") or "") or None,
                source_service=str(best.get("I") or "") or None,
                source_url=str(best.get("J") or "") or None,
                notes=str(best.get("M") or "") or None,
                precision=precision_from_text(best.get("L"), best.get("M")),
            )
            if not existing or source_quality(best) > 0:
                e["years"]["2025"] = source_record

        # Fallback 2024 and, where explicitly stored, the latest older year.
        for row in book.rows("Fallback_2024"):
            if row.get("A") == "NIP":
                continue
            nip = normalize_nip(row.get("A"))
            if len(nip) != 10:
                continue
            name = str(row.get("B") or "").strip() or None
            e = entity(nip, name)

            if any(row.get(col) is not None for col in ("D", "E", "F", "G", "H", "I")):
                e["years"]["2024"] = make_year_record(
                    2024,
                    revenue=row.get("D"),
                    net_result=row.get("E"),
                    assets=row.get("F"),
                    status=str(row.get("G") or "") or None,
                    source_service="Fallback_2024",
                    source_url=str(row.get("I") or "") or None,
                    notes=str(row.get("H") or "") or None,
                    precision=precision_from_text(row.get("G"), row.get("H")),
                )

            older_year = as_int(row.get("J"))
            if older_year and older_year != 2024:
                e["years"][str(older_year)] = make_year_record(
                    older_year,
                    revenue=row.get("K"),
                    net_result=row.get("L"),
                    assets=row.get("M"),
                    status=f"najnowszy dostępny rok: {older_year}",
                    source_service="Fallback_2024",
                    source_url=str(row.get("I") or "") or None,
                    notes=str(row.get("H") or "") or None,
                    precision=precision_from_text(row.get("H")),
                )

    records = []
    for nip in sorted(entities):
        e = entities[nip]
        annual = sorted(e["years"].values(), key=lambda x: x["year"], reverse=True)
        years_with_result = [x["year"] for x in annual if x.get("net_result") is not None]
        years_with_values = [x["year"] for x in annual if x.get("has_values")]
        records.append({
            "nip": nip,
            "name": e.get("name"),
            "latest_result_year": max(years_with_result) if years_with_result else None,
            "latest_values_year": max(years_with_values) if years_with_values else None,
            "years": annual,
        })

    by_year = defaultdict(int)
    with_result_by_year = defaultdict(int)
    for rec in records:
        for y in rec["years"]:
            by_year[str(y["year"])] += 1
            if y.get("net_result") is not None:
                with_result_by_year[str(y["year"])] += 1

    return {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "currency": "PLN",
        "entity_level": "NIP",
        "preferred_year": 2025,
        "notes": [
            "Financial data are assigned to the legal entity identified by NIP, not to an individual building/facility.",
            "Missing values remain null. 2024/older values are never relabeled as 2025.",
        ],
        "stats": {
            "entities": len(records),
            "records_by_year": dict(sorted(by_year.items(), reverse=True)),
            "net_result_by_year": dict(sorted(with_result_by_year.items(), reverse=True)),
        },
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_xlsx", type=Path)
    parser.add_argument("output_json_gz", type=Path)
    parser.add_argument("--pretty-json", type=Path, help="Optional uncompressed JSON for inspection")
    args = parser.parse_args()

    payload = build_payload(args.input_xlsx)
    args.output_json_gz.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with args.output_json_gz.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as fh:
            fh.write(encoded)

    if args.pretty_json:
        args.pretty_json.parent.mkdir(parents=True, exist_ok=True)
        args.pretty_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))
    print(f"Wrote {args.output_json_gz} ({args.output_json_gz.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
