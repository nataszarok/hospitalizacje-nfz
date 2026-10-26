#!/usr/bin/env python3
"""Build the compact peer-pairs payload used by the hospital Comparison view.

The full peer_pairs_ab.json.gz (model output with all scoring columns) stays an
offline/source artifact. This script keeps only the columns read by the UI
(HospitalSimilarityTab, HospitalComparisonShared) and shortens numeric values.

Default input:
  data/peer_pairs_ab.json.gz
Default output:
  public/data/peer_pairs_ab.json.gz
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
from pathlib import Path
from typing import Any


# Kolumny czytane przez UI. Nowe pole czytane z PeerPair lub nowy wpis
# w PAIR_DISTANCE_MODEL musi trafić także tutaj.
FIELDS: tuple[str, ...] = (
    # Identyfikacja pary i klasa modelu
    "a", "b", "peer_grade_pred", "distance_score",
    # Wolumen i zgony według metody estymacji <5
    "hospitalizations_sim_a", "hospitalizations_sim_b",
    "hospitalizations_min_a", "hospitalizations_min_b",
    "deaths_sim_a", "deaths_sim_b", "deaths_min_a", "deaths_min_b",
    # Struktura placówek
    "core_types_a", "core_types_b", "core_beds_a", "core_beds_b",
    "core_x_supported_count_a", "core_x_supported_count_b",
    "clinics_a", "clinics_b", "jgp_gt10_a", "jgp_gt10_b",
    # Podobieństwa pokazywane w panelu pary
    "core_types_shared", "jgp_shared",
    "core_type_set_similarity", "jgp_shared_volume_similarity", "jgp_set_similarity",
    "bed_cosine_similarity", "bed_weighted_jaccard_similarity",
    # Składowe dystansu (PAIR_DISTANCE_MODEL)
    "d_jgp_shared_volume", "d_jgp_shared_hospitalizations", "d_jgp_set",
    "d_jgp_breadth", "d_hospitalizations", "d_core_beds",
    "d_zrm_share", "d_urgent_other_share", "d_core_x_supported_set",
    "d_core_family_bed_weighted_jaccard", "d_core_inpatient_beds",
    "d_core_day_treatment_x_set", "d_core_day_treatment_capacity_share",
    "d_outpatient_x_set", "d_jgp_family_weighted_jaccard",
)


def _open_json(path: Path) -> dict[str, Any]:
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def _write_json_gz(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))


def _compact_number(value: Any, digits: int) -> Any:
    if not isinstance(value, float):
        return value
    if not math.isfinite(value):
        return None
    if value.is_integer():
        return int(value)
    # Cyfry znaczące, nie miejsca po przecinku: część dystansów ma skalę rzędu 1e-6.
    return float(f"{value:.{digits}g}")


def build_payload(source: dict[str, Any], grades: set[str], digits: int) -> dict[str, Any]:
    rows = source.get("rows") or []
    missing = [f for f in FIELDS if rows and f not in rows[0]]
    if missing:
        raise SystemExit(f"Input is missing required columns: {', '.join(missing)}")

    compact_rows = [
        {f: _compact_number(row.get(f), digits) for f in FIELDS}
        for row in rows
        if row.get("peer_grade_pred") in grades
    ]
    return {
        "version": source.get("version"),
        "source": source.get("source"),
        "grades": [g for g in source.get("grades", []) if g in grades] or sorted(grades),
        "estimation_fields": source.get("estimation_fields"),
        "rows": compact_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="data/peer_pairs_ab.json.gz",
        help="full offline/source peer-pairs model output",
    )
    parser.add_argument(
        "--output",
        default="public/data/peer_pairs_ab.json.gz",
        help="compact payload used by the Comparison UI",
    )
    parser.add_argument(
        "--grades",
        default="A,B",
        help="comma-separated peer grades to keep",
    )
    parser.add_argument(
        "--digits",
        type=int,
        default=6,
        help="significant digits kept for float values",
    )
    args = parser.parse_args()

    source_path = Path(args.input)
    output_path = Path(args.output)
    if source_path.resolve() == output_path.resolve():
        raise SystemExit("Input and output must be different files.")
    grades = {g.strip() for g in args.grades.split(",") if g.strip()}

    source = _open_json(source_path)
    payload = build_payload(source, grades, args.digits)
    _write_json_gz(output_path, payload)

    input_bytes = source_path.stat().st_size
    output_bytes = output_path.stat().st_size
    ratio = (output_bytes / input_bytes * 100.0) if input_bytes else 0.0
    print(
        f"Wrote {len(payload['rows'])} pairs ({len(FIELDS)} columns) to {output_path} "
        f"({output_bytes / 1024:.1f} KiB gzip; {ratio:.1f}% of source gzip size)."
    )


if __name__ == "__main__":
    main()
