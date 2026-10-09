#!/usr/bin/env python3
"""Build the compact RPWDL payload used by the hospital Summary view.

The large rpwdl_facility_profiles_all.json.gz stays an offline/source artifact.
This script keeps only data required by the Summary UI and aggregates details
that the browser previously recomputed from facilities[].

Default input:
  data/rpwdl_facility_profiles_all.json.gz
Default output:
  public/data/rpwdl_summary_profiles.json.gz
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


BED_COL = "Liczba łóżek ogółem"
DIALYSIS_COL = "Liczba stanowisk dializacyjnych"
DAY_PLACES_COL = "Liczba miejsc pobytu dziennego"


def _open_json(path: Path) -> dict[str, Any]:
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def _write_json_gz(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))


def _norm(value: Any) -> str:
    text = "" if value is None else str(value).lower().replace("ł", "l")
    text = "".join(
        c for c in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(c)
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _int(value: Any) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def _compact_address(address: dict[str, Any] | None) -> dict[str, str]:
    if not address:
        return {}
    return {
        key: str(address[key])
        for key in ("city", "street", "building")
        if address.get(key)
    }


def _registry_cells(record: dict[str, Any]) -> Iterable[tuple[dict[str, Any] | None, dict[str, Any]]]:
    for location in record.get("registry_facilities", []) or []:
        for cell in location.get("cells", []) or []:
            yield location, cell
    for cell in record.get("registry_unassigned_cells", []) or []:
        yield None, cell


def _cell_search_text(cell: dict[str, Any]) -> str:
    parts = [
        cell.get("name"),
        cell.get("specialty"),
        cell.get("unit_name"),
        cell.get("zoz_name"),
    ]
    for service in cell.get("services", []) or []:
        parts.extend((service.get("function"), service.get("field")))
    return _norm(" ".join(str(x or "") for x in parts))


def _aggregate_core(record: dict[str, Any]) -> dict[str, Any]:
    facilities = record.get("facilities", []) or []
    aggregate = record.get("aggregate", {}) or {}

    fields_by_code: dict[str, str] = {}
    ward_map: dict[str, dict[str, Any]] = {}

    for facility in facilities:
        for code in facility.get("hospital_x_codes_core", []) or []:
            fields_by_code.setdefault(str(code), str(code))

        medical_fields = facility.get("hospital_medical_fields_core", []) or []
        for field in medical_fields:
            code = field.get("x")
            if code:
                fields_by_code[str(code)] = str(field.get("name") or code)

        raw_types = (facility.get("core_capacity") or {}).get("raw_types") or {}
        for code, raw in raw_types.items():
            code = str(code)
            entry = ward_map.setdefault(
                code,
                {"code": code, "names": set(), "beds": 0, "fields": set()},
            )
            entry["beds"] += _int(raw.get("beds"))
            entry["names"].update(
                str(name) for name in (raw.get("names") or []) if name
            )
            for field in medical_fields:
                if field.get("name") and code in (field.get("source_viii") or []):
                    entry["fields"].add(str(field["name"]))

    fields = [name for _, name in sorted(fields_by_code.items())]
    wards = []
    for code, entry in sorted(ward_map.items()):
        wards.append({
            "code": code,
            "name": " / ".join(sorted(entry["names"])) or f"Oddział {code}",
            "beds": entry["beds"],
            "fields": sorted(entry["fields"]),
        })

    return {
        "ward_count": _int(aggregate.get("core_type_count_raw")),
        "beds": _int(aggregate.get("core_beds_total")),
        "field_count": len(fields),
        "fields": fields,
        "wards": wards,
    }


def _aggregate_model_special(record: dict[str, Any]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for facility in record.get("facilities", []) or []:
        for key, capability in (facility.get("special_capabilities") or {}).items():
            if not capability or not capability.get("present"):
                continue
            target = out.setdefault(key, {"count": 0, "beds": 0, "stations": 0})
            count = _int(capability.get("cells_count"))
            target["count"] += count if count else 1
            target["beds"] += _int(capability.get("beds"))
            target["stations"] += _int(capability.get("dialysis_stations"))
    return out


def _build_record(record: dict[str, Any]) -> dict[str, Any]:
    facilities = record.get("facilities", []) or []
    registry_facilities = record.get("registry_facilities", []) or []
    registry_aggregate = record.get("registry_aggregate", {}) or {}
    registry_capacity = registry_aggregate.get("capacity", {}) or {}
    category_counts = registry_aggregate.get("category_counts", {}) or {}
    category_beds = registry_aggregate.get("category_beds", {}) or {}

    primary_address: dict[str, str] = {}
    for facility in facilities:
        if facility.get("primary_address"):
            primary_address = _compact_address(facility.get("primary_address"))
            break

    # Full AOS profile comes from registry, not only from the model hospital site.
    outpatient_fields: set[str] = set()
    outpatient_cells = 0
    outpatient_location_ids: set[str] = set()

    zrm_cells: set[str] = set()
    zrm_locations: set[str] = set()
    poz_cells: set[str] = set()
    poz_locations: set[str] = set()
    npl_cells: set[str] = set()
    npl_locations: set[str] = set()

    # Some capacities (for example day-treatment places) must be summed only
    # inside the relevant registry category, not across the whole provider.
    category_day_places: Counter[str] = Counter()

    for location, cell in _registry_cells(record):
        category = str(cell.get("category") or "")
        location_id = None
        if location:
            location_id = str(
                location.get("registry_facility_id")
                or location.get("site_key")
                or ""
            ) or None

        if category == "outpatient_1xxx":
            outpatient_cells += 1
            if location_id:
                outpatient_location_ids.add(location_id)
            for service in cell.get("services", []) or []:
                if service.get("field"):
                    outpatient_fields.add(str(service["field"]))

        category_day_places[category] += _int(
            (cell.get("capacity") or {}).get(DAY_PLACES_COL)
        )

        text = _cell_search_text(cell)
        cell_id = str(cell.get("cell_id") or "")
        viii = str(cell.get("viii") or "")

        # Deliberately high-precision text rules. We do not infer POZ from the
        # word "podstawowy" alone because it also occurs in ZRM names.
        if "zespol ratownictwa medycznego" in text or (
            viii == "3112" and "ratownictw" in text
        ):
            zrm_cells.add(cell_id)
            if location_id:
                zrm_locations.add(location_id)

        if (
            "podstawowej opieki zdrowotnej" in text
            or "podstawowa opieka zdrowotna" in text
        ):
            poz_cells.add(cell_id)
            if location_id:
                poz_locations.add(location_id)

        if "nocnej i swiatecznej opieki" in text or "nocna i swiateczna opieka" in text:
            npl_cells.add(cell_id)
            if location_id:
                npl_locations.add(location_id)

    # Backward-safe fallback when a source record has no registry AOS service names.
    if not outpatient_fields:
        for facility in facilities:
            for field in facility.get("outpatient_medical_fields", []) or []:
                if field.get("name"):
                    outpatient_fields.add(str(field["name"]))

    # Count physical locations by clinically useful type.
    category_locations: Counter[str] = Counter()
    hospital_locations = 0
    hospital_location_beds = 0
    outpatient_locations = 0
    long_term_locations = 0
    spa_locations = 0
    locations_with_beds = 0

    for location in registry_facilities:
        counts = location.get("category_counts", {}) or {}
        total_location_beds = _int((location.get("capacity") or {}).get(BED_COL))
        if total_location_beds:
            locations_with_beds += 1

        for category, count in counts.items():
            if _int(count):
                category_locations[str(category)] += 1

        if _int(counts.get("hospital_4xxx")):
            hospital_locations += 1
            hospital_location_beds += total_location_beds
        if _int(counts.get("outpatient_1xxx")):
            outpatient_locations += 1
        if _int(counts.get("long_term_care")):
            long_term_locations += 1
        if (
            _int(counts.get("spa_hospital_or_rehabilitation"))
            or _int(counts.get("spa_sanatorium_or_rehabilitation"))
        ):
            spa_locations += 1

    special = _aggregate_model_special(record)
    capabilities: dict[str, dict[str, int]] = {}

    def put(
        key: str,
        *,
        count: int = 0,
        beds: int = 0,
        stations: int = 0,
        locations: int = 0,
        day_places: int = 0,
    ) -> None:
        if not any((count, beds, stations, locations, day_places)):
            return
        value: dict[str, int] = {}
        if count:
            value["count"] = int(count)
        if beds:
            value["beds"] = int(beds)
        if stations:
            value["stations"] = int(stations)
        if day_places:
            value["day_places"] = int(day_places)
        capabilities[key] = value

    put(
        "sor",
        count=_int(category_counts.get("emergency_department"))
        or _int((special.get("emergency_department") or {}).get("count")),
        beds=_int(category_beds.get("emergency_department")),
        locations=_int(category_locations.get("emergency_department")),
    )
    put(
        "admission",
        count=_int(category_counts.get("admission_room"))
        or _int((special.get("admission_room") or {}).get("count")),
        beds=_int(category_beds.get("admission_room")),
        locations=_int(category_locations.get("admission_room")),
    )
    put(
        "icu",
        count=_int((special.get("icu") or {}).get("count")),
        beds=_int((special.get("icu") or {}).get("beds")),
    )
    put(
        "stroke",
        count=_int((special.get("stroke_unit") or {}).get("count")),
        beds=_int((special.get("stroke_unit") or {}).get("beds")),
    )
    put(
        "ccu",
        count=_int((special.get("cardiac_intensive_monitoring") or {}).get("count")),
        beds=_int((special.get("cardiac_intensive_monitoring") or {}).get("beds")),
    )
    put(
        "operating",
        count=_int(category_counts.get("operating_block"))
        or _int((special.get("operating_block") or {}).get("count")),
        locations=_int(category_locations.get("operating_block")),
    )
    put(
        "delivery",
        count=_int(category_counts.get("delivery_room"))
        or _int((special.get("delivery_room") or {}).get("count")),
        locations=_int(category_locations.get("delivery_room")),
    )
    put(
        "long_term",
        count=_int(category_counts.get("long_term_care")),
        beds=_int(category_beds.get("long_term_care")),
        locations=long_term_locations,
    )
    put(
        "palliative",
        count=_int(category_counts.get("palliative")),
        beds=_int(category_beds.get("palliative")),
        locations=_int(category_locations.get("palliative")),
    )
    put(
        "hospice",
        count=_int(category_counts.get("hospice_palliative")),
        beds=_int(category_beds.get("hospice_palliative")),
        locations=_int(category_locations.get("hospice_palliative")),
    )
    put(
        "rehab",
        count=_int(category_counts.get("rehabilitation")),
        beds=_int(category_beds.get("rehabilitation")),
        locations=_int(category_locations.get("rehabilitation")),
    )
    spa_cells = _int(category_counts.get("spa_hospital_or_rehabilitation")) + _int(
        category_counts.get("spa_sanatorium_or_rehabilitation")
    )
    spa_beds = _int(category_beds.get("spa_hospital_or_rehabilitation")) + _int(
        category_beds.get("spa_sanatorium_or_rehabilitation")
    )
    put("spa", count=spa_cells, beds=spa_beds, locations=spa_locations)
    put(
        "psychiatry",
        count=_int(category_counts.get("psychiatry_addiction")),
        beds=_int(category_beds.get("psychiatry_addiction")),
        locations=_int(category_locations.get("psychiatry_addiction")),
    )
    put(
        "dialysis",
        count=_int(category_counts.get("dialysis")),
        beds=_int(category_beds.get("dialysis")),
        stations=_int(registry_capacity.get(DIALYSIS_COL)),
        locations=_int(category_locations.get("dialysis")),
    )
    put(
        "day_treatment",
        count=_int(category_counts.get("day_treatment")),
        beds=_int(category_beds.get("day_treatment")),
        day_places=_int(category_day_places.get("day_treatment")),
        locations=_int(category_locations.get("day_treatment")),
    )
    put("zrm", count=len(zrm_cells), locations=len(zrm_locations))
    put("poz", count=len(poz_cells), locations=len(poz_locations))
    put("npl", count=len(npl_cells), locations=len(npl_locations))

    location_types: dict[str, dict[str, int]] = {
        "hospital": {
            "locations": hospital_locations,
            "beds": hospital_location_beds,
        },
        "outpatient": {
            "locations": outpatient_locations,
            "aos_cells": outpatient_cells,
        },
    }
    if long_term_locations or _int(category_counts.get("long_term_care")):
        location_types["long_term"] = {
            "locations": long_term_locations,
            "beds": _int(category_beds.get("long_term_care")),
        }
    if spa_locations or spa_cells:
        location_types["spa"] = {
            "locations": spa_locations,
            "beds": spa_beds,
        }
    return {
        "oz_nfz": str(record.get("oz_nfz") or "").zfill(2),
        "nip": str(record.get("nip") or ""),
        "source_city": record.get("source_city"),
        "primary_address": primary_address,
        "core": _aggregate_core(record),
        "outpatient": {
            "cell_count": outpatient_cells,
            "field_count": len(outpatient_fields),
            "fields": sorted(outpatient_fields),
            "location_count": outpatient_locations,
        },
        "registry": {
            "location_count": _int(registry_aggregate.get("registry_facility_count"))
            or len(registry_facilities),
            "city_count": len(registry_aggregate.get("cities", []) or []),
            "total_beds": _int(registry_capacity.get(BED_COL)),
            "location_types": location_types,
        },
        "capabilities": capabilities,
    }


def build_payload(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 2,
        "source_version": source.get("version"),
        "rpwdl_snapshot_date": source.get("rpwdl_snapshot_date"),
        "records": [_build_record(record) for record in source.get("records", [])],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="data/rpwdl_facility_profiles_all.json.gz",
        help="large offline/source RPWDL profile",
    )
    parser.add_argument(
        "--output",
        default="public/data/rpwdl_summary_profiles.json.gz",
        help="compact payload used by the Summary UI",
    )
    args = parser.parse_args()

    source_path = Path(args.input)
    output_path = Path(args.output)
    source = _open_json(source_path)
    payload = build_payload(source)
    _write_json_gz(output_path, payload)

    input_bytes = source_path.stat().st_size
    output_bytes = output_path.stat().st_size
    ratio = (output_bytes / input_bytes * 100.0) if input_bytes else 0.0
    print(
        f"Wrote {len(payload['records'])} records to {output_path} "
        f"({output_bytes / 1024:.1f} KiB gzip; {ratio:.1f}% of source gzip size)."
    )


if __name__ == "__main__":
    main()
