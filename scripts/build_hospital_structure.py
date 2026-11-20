#!/usr/bin/env python3
"""Build hospital structure data for the card tab „Struktura”: build-data/hospitals/structure.json.gz.

For every hospital with a card (build-data/hospitals/index.json) the RPWDL register gives:
  - places with beds (wards, SOR, admission room, operating block, ZOL, hospice, spa…): building (physical address,
    addresses written differently are merged like `_physical_locations` in build_rpwdl_summary_profiles.py), facility
    name, category, ministry code (part VIII), register name, beds, ICU beds and medical fields (services[].field);
  - specialist clinics (category outpatient_1xxx): building, code, medical fields;
  - locations without beds: address, kinds of activity, facility names.
Official names of codes (wards and clinics) come from data/rpwdl/komorki.csv („Specjalność komórki”, the most frequent
name per code), the same source as build_ward_names.py.
scripts/rpwdl_nfz_kody.csv maps register codes to NFZ contract codes where NFZ uses another code (written as `nfzCodes`):
the card joins a ward with a contract scope by this code (src/lib/hospitalStructure.ts).

Output (gzip JSON, read only by the build, not served):
  {"version": 2, "names": {code: name}, "fields": [...], "sites": [...], "nfzCodes": {code: [nfzCode, variant]},
   "hospitals": {"OW|NIP": {"addr": [[street building, city]], "beds": [[addr, site, category, code, name, beds, icu, [field]]],
                            "clinics": [[addr, code, [field]]], "other": [[addr, kind, name, units]],
                            "sites": {addr: [site]}}}}
  other: places without beds outside specialist clinics (kind: poz, npl, zrm, dialysis, day, delivery, misc — other cells
  of a building with nothing else, e.g. a vaccination point; units: dialysis
  stations or day places, otherwise 0). sites: facility names of every building (also without beds).

Usage:
  python3 scripts/build_hospital_structure.py
"""
from __future__ import annotations

import csv
import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_rpwdl_summary_profiles import (  # noqa: E402
    BED_COL, DAY_PLACES_COL, DIALYSIS_COL, _address_key, _cell_search_text, _location_row, _physical_locations,
)

SOURCE = ROOT / "data" / "rpwdl_facility_profiles_all.json.gz"
CELLS = ROOT / "data" / "rpwdl" / "komorki.csv"
PAGES = ROOT / "build-data" / "hospitals" / "index.json"
CODES = ROOT / "scripts" / "rpwdl_nfz_kody.csv"
OUT = ROOT / "build-data" / "hospitals" / "structure.json.gz"
ICU_COL = "Liczba łóżek intensywnej terapii"


def other_kind(cell: dict) -> str | None:
    """Miejsce bez łóżek spoza poradni AOS (te same reguły co „Zaplecze” w build_rpwdl_summary_profiles.py):
    POZ, nocna i świąteczna opieka, zespół ratownictwa, dializy, leczenie jednego dnia, sala porodowa."""
    category = str(cell.get("category") or "")
    if category == "dialysis":
        return "dialysis"
    if category == "day_treatment":
        return "day"
    if category == "delivery_room":
        return "delivery"
    text = _cell_search_text(cell)
    if "nocnej i swiatecznej opieki" in text or "nocna i swiateczna opieka" in text:
        return "npl"
    if "zespol ratownictwa medycznego" in text or (str(cell.get("viii") or "") == "3112" and "ratownictw" in text):
        return "zrm"
    if "podstawowej opieki zdrowotnej" in text or "podstawowa opieka zdrowotna" in text:
        return "poz"
    return None


def site_name(cell: dict) -> str:
    """Pełna nazwa placówki z rejestru: jednostka (np. „Szpital w Kłodzku”), a bez niej zakład („Uniwersyteckie Centrum Kliniczne – Szpital”).
    „Opiekuńczo - Leczniczy” → „Opiekuńczo-Leczniczy” (przymiotnik złożony), inne „ - ” → półpauza."""
    name = re.sub(r"\s+", " ", str(cell.get("unit_name") or cell.get("zoz_name") or "").strip())
    name = re.sub(r"(\w*o) - (\w)", r"\1-\2", name)
    return name.replace(" - ", " – ").replace("Kudowie Zdroju", "Kudowie-Zdroju")


def street_label(address: dict) -> str:
    """„Smoluchowskiego 17”: ulica bez pełnego imienia patrona nie jest potrzebna; skracamy tylko „Aleja” → „Al.”."""
    street = " ".join(x for x in (address.get("street"), address.get("building")) if x)
    return re.sub(r"^Aleja ", "Al. ", street)


def code_names(wanted: set[str]) -> dict[str, str]:
    counts: dict[str, Counter] = defaultdict(Counter)
    with CELLS.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            code, name = row["kodResortVIII"].strip(), row["Specjalność komórki"].strip()
            if code in wanted and name and name != "NULL":
                counts[code][re.sub(r"\s*\(kod wycofany\)\s*$", "", name)] += 1
    return {code: counter.most_common(1)[0][0] for code, counter in sorted(counts.items())}


def main() -> None:
    pages = {key for key, *_ in json.loads(PAGES.read_text(encoding="utf-8"))["pages"]}
    source = json.load(gzip.open(SOURCE))
    records = source["records"] if isinstance(source, dict) else source
    fields: dict[str, int] = {}
    sites: dict[str, int] = {}
    index = lambda table, value: table.setdefault(value, len(table))  # noqa: E731
    hospitals: dict[str, dict] = {}
    codes: set[str] = set()
    fallback: dict[str, str] = {}
    for record in records:
        key = f"{str(record['oz_nfz']).zfill(2)}|{record['nip']}"
        if key not in pages:
            continue
        facilities = record.get("registry_facilities") or []
        groups = _physical_locations(facilities)
        group_of = {_address_key(g["address"]): i for i, g in enumerate(groups)}
        addr = [[street_label(g["address"]), g["address"].get("city", "")] for g in groups]
        beds, clinics, other, point_sites, unmatched = [], [], [], defaultdict(Counter), defaultdict(list)
        for location in facilities:
            a = group_of[_address_key(location.get("primary_address") or {})]
            for cell in location.get("cells") or []:
                code = str(cell.get("viii") or "")
                cell_fields = sorted({str(s["field"]) for s in cell.get("services") or [] if s.get("field")})
                name = site_name(cell)
                if name:
                    point_sites[a][name] += 1
                capacity = cell.get("capacity") or {}
                n = int(capacity.get(BED_COL) or 0)
                if n:
                    codes.add(code)
                    beds.append([a, index(sites, name), cell.get("category") or "", code, str(cell.get("name") or "").strip(), n,
                                 int(capacity.get(ICU_COL) or 0), [index(fields, f) for f in cell_fields]])
                elif cell.get("category") == "outpatient_1xxx":
                    codes.add(code)
                    if cell.get("specialty"):
                        fallback.setdefault(code, str(cell["specialty"]))
                    clinics.append([a, code, [index(fields, f) for f in cell_fields]])
                elif kind := other_kind(cell):
                    units = int(capacity.get(DIALYSIS_COL) or 0) if kind == "dialysis" else int(capacity.get(DAY_PLACES_COL) or 0) if kind == "day" else 0
                    other.append([a, kind, str(cell.get("name") or "").strip(), units])
                elif cell.get("name") and str(cell["name"]).strip() not in unmatched[a]:
                    unmatched[a].append(str(cell["name"]).strip())
        # Budynek bez łóżek, poradni i miejsc z listy rodzajów (np. punkt szczepień, punkt pobrań): najwyżej 2 nazwy komórek.
        used = {row[0] for row in beds} | {row[0] for row in clinics} | {row[0] for row in other}
        for a, names in unmatched.items():
            if a not in used:
                other.extend([a, "misc", name, 0] for name in names[:2])
        building_sites = {str(i): [index(sites, n) for n, _ in point_sites[i].most_common(2)] for i in range(len(groups)) if point_sites[i]}
        if beds or clinics:
            hospitals[key] = {"addr": addr, "beds": beds, "clinics": clinics, "other": other, "sites": building_sites}
    names = {**fallback, **code_names(codes)}
    nfz_codes = {r["KOD_RPWDL"]: [r["KOD_NFZ"], r["WARIANT_NFZ"]] for r in csv.DictReader(CODES.open(encoding="utf-8"))}
    payload = {
        "version": 2, "names": names, "fields": list(fields), "sites": list(sites), "nfzCodes": nfz_codes,
        "hospitals": hospitals,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    missing = sorted(codes - set(names))
    print(f"Struktura szpitali: {len(hospitals)} z {len(pages)} kart, {len(names)} nazw kodów -> {OUT.relative_to(ROOT)} "
          f"({OUT.stat().st_size / 1024:.0f} KiB)" + (f"; bez nazwy: {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
