#!/usr/bin/env python3
"""Build ryczałt vs. za wykonanie split for hospital cards: build-data/hospitals/payment.json.gz.

For every hospital with a card (build-data/hospitals/index.json from build_hospital_index.py):
  - the NFZ contract plan (API NFZ „Umowy”, scripts/nfz_contracts.py) says which scopes (zakres, e.g. 03.4450.260.02)
    have their own amount: those are paid per stay („za wykonanie”); scopes without an own amount are inside the PSZ
    lump sum (ryczałt). A plan position has dates: a scope is „za wykonanie” only in months covered by a position with
    a price (2017: per stay until September, ryczałt since the PSZ network started in October);
  - the hospitalization files (data/hospitalizacje_<rok>.csv, column KOD_PRODUKTU_KONTRAKTOWEGO) give hospitalizations
    per scope and month for 2017–2025 (shared iter_frames, method min: <5 = 1) — the card shows ward shares from them;
  - data/zestawienie_swiadczen_2019_2026.csv gives JGP settlements in zł per scope (2019+), for the Finanse tab — only
    groups with a group page (build-data/jgp/index.json), like the card's „Kwota NFZ”; e.g. Z01 (kompleksowa diagnostyka
    onkologiczna) has a JGP code but no hospitalizations and no group page.
The card links a RPWDL ward to scopes by the ward code in the scope code (03.<4450>.260.02 -> 4450).

Output (build only, not in dist/):
  {"version": 3, "hospitals": {"OW|NIP": {"years": [...], "scopes": [[scope code, scope name], ...],
                                          "hosp": [[year index, scope index, za wykonanie 0/1, hospitalizations], ...],
                                          "value": [[year index, scope index, za wykonanie 0/1, zł], ...],
                                          "codes": [JGP code, ...],
                                          "jgp": [[year index, scope index, za wykonanie 0/1, code index, zł], ...]}}}
  „jgp” splits „value” by JGP group (Finanse tab: wards, JGP sections and groups paid in ryczałt or per stay).

Usage:
  python3 scripts/build_hospital_payment.py [--fetch]
"""
from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

import pandas as pd

from build_hospitalizations import iter_frames, source_path
from nfz_contracts import LUMP_SUM_PRODUCT, PLAN_CODE, PLAN_FROM, PLAN_NAME, PLAN_PRICE, PLAN_TO, YEARS, contracts, page_keys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "build-data" / "hospitals" / "payment.json.gz"
SETTLEMENTS_FILE = "zestawienie_swiadczen_2019_2026.csv"
PROVIDERS_FILE = "nfz_swiadczeniodawcy_2025.csv"
PROVIDER_CODES_SUPPLEMENT = "kody_swiadczeniodawcow_uzupelnienie.csv"
JGP_PRODUCT_PREFIX = "5.51.01"
GROUPS_INDEX = ROOT / "build-data" / "jgp" / "index.json"


def provider_keys(frame: pd.DataFrame, keys: list[str]) -> pd.Series:
    """Hospital key „OW|NIP” of every settlement row (None outside the given hospitals), as in build_jgp_pages.py:
    NIP from the provider file 2025, then the supplement (column LATA limits a code to the listed years)."""
    providers = pd.read_csv(DATA / PROVIDERS_FILE, dtype=str, encoding="utf-8-sig")
    nip_by_code = dict(zip(providers["oddzial_nfz"].str.zfill(2) + "|" + providers["kod"].str.strip(), providers["nip"].str.strip()))
    ow = frame["Oddzial_wojewodzki_NFZ"].str.zfill(2)
    code = ow + "|" + frame["Kod_swiadczeniodawcy"].str.strip()
    nip = code.map(nip_by_code)
    supplement = DATA / PROVIDER_CODES_SUPPLEMENT
    if supplement.exists():
        for row in pd.read_csv(supplement, dtype=str, encoding="utf-8-sig").fillna("").itertuples(index=False):
            years = [year.strip() for year in row.LATA.split(",") if year.strip()]
            mask = (code == f"{row.OW_NFZ.zfill(2)}|{row.KOD_SWIADCZENIODAWCY.strip()}") & (frame["Rok"].isin(years) if years else True)
            nip[mask] = row.NIP.strip()
    key = ow + "|" + nip
    return key.where(key.isin(set(keys)))


def paid_months(agreements: list[dict]) -> dict[str, set[int]]:
    """Scope -> months (1–12) covered by a plan position with an own amount (paid per stay); no dates = the whole year."""
    out: dict[str, set[int]] = {}
    for agreement in agreements:
        for plan in agreement["plans"]:
            if not (plan[PLAN_PRICE] or 0) > 0 or plan[PLAN_CODE] == LUMP_SUM_PRODUCT:
                continue
            start = int(plan[PLAN_FROM][5:7]) if len(plan[PLAN_FROM]) >= 7 else 1
            end = int(plan[PLAN_TO][5:7]) if len(plan[PLAN_TO]) >= 7 else 12
            out.setdefault(plan[PLAN_CODE], set()).update(range(start, end + 1))
    return out


def hospitalizations(keys: list[str]) -> dict[str, dict]:
    """(hospital, year) -> hospitalizations per (scope, month), method min, from all year files."""
    wanted = set(keys)
    out: dict[str, dict] = {}
    for year in YEARS:
        parts = []
        for frame, _ in iter_frames(source_path(DATA, year), year):
            frame = frame[(frame["ow"] + "|" + frame["nip"]).isin(wanted)]
            if len(frame):
                parts.append(frame.assign(key=frame["ow"] + "|" + frame["nip"]).groupby(["key", "scope", "month"])["h_min"].sum())
        if parts:
            out[year] = pd.concat(parts).groupby(level=[0, 1, 2]).sum()
        print(f"Hospitalizacje {year}: {sum(len(part) for part in parts)} wierszy szpitali z kartą")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fetch", action="store_true", help="pobierz plany umów z API NFZ ponownie (zamiast cache)")
    args = parser.parse_args()
    keys = page_keys()
    frame = pd.read_csv(DATA / SETTLEMENTS_FILE, sep=";", dtype=str, usecols=[
        "Rok", "Oddzial_wojewodzki_NFZ", "Kod_swiadczeniodawcy", "Kod_zakresu", "Nazwa_zakresu", "Kod_produktu_jednostkowego", "Nazwa_produktu_jednostkowego", "Wartosc_jednostek_rozliczonych",
    ])
    # Te same grupy co w plikach grup (build_jgp_pages.py): kod JGP to pierwsze słowo nazwy produktu.
    groups = set(json.loads(GROUPS_INDEX.read_text(encoding="utf-8"))["groups"])
    frame["key"] = provider_keys(frame, keys)
    frame = frame[frame["key"].notna() & frame["Kod_produktu_jednostkowego"].str.startswith(JGP_PRODUCT_PREFIX)
                  & frame["Nazwa_produktu_jednostkowego"].str.split().str[0].isin(groups)].copy()
    # Ostatni rok w pliku jest niepełny (dane w trakcie roku), jak w build_jgp_pages.py.
    frame = frame[frame["Rok"] < frame["Rok"].max()] if len(frame) else frame
    frame["value"] = pd.to_numeric(frame["Wartosc_jednostek_rozliczonych"].str.replace(",", ".", regex=False), errors="coerce").fillna(0)
    hosp_by_year = hospitalizations(keys)
    hospitals: dict[str, dict] = {}
    for key in keys:
        plans = contracts(key, args.fetch)
        part = frame[frame["key"] == key]
        values = part.groupby(["Rok", "Kod_zakresu"])["value"].sum()
        by_group = part.assign(jgp=part["Nazwa_produktu_jednostkowego"].str.split().str[0]).groupby(["Rok", "Kod_zakresu", "jgp"])["value"].sum()
        names = part.drop_duplicates("Kod_zakresu").set_index("Kod_zakresu")["Nazwa_zakresu"].str.strip().to_dict()
        # Nazwy zakresów spoza zestawienia (lata przed 2019 r.) z planu umowy.
        for agreements in plans.values():
            for agreement in agreements:
                for plan in agreement["plans"]:
                    names.setdefault(plan[PLAN_CODE], (plan[PLAN_NAME] or "").strip())
        hosp_rows: dict[tuple[str, str, int], float] = {}
        for year, sums in hosp_by_year.items():
            months = paid_months(plans.get(year, []))
            for (hospital, scope, month), count in sums.items():
                if hospital != key:
                    continue
                paid = int(month in months.get(scope, set()))
                hosp_rows[(year, scope, paid)] = hosp_rows.get((year, scope, paid), 0) + count
        years = [year for year in YEARS if any(row[0] == year for row in hosp_rows) or year in set(values.index.get_level_values(0))]
        scopes = sorted({scope for _, scope, _ in hosp_rows} | set(values.index.get_level_values(1)))
        for scope in scopes:
            names.setdefault(scope, "")
        hosp = sorted([years.index(year), scopes.index(scope), paid, int(round(count))] for (year, scope, paid), count in hosp_rows.items() if round(count))
        value = []
        for (year, scope), amount in values.items():
            if round(amount):
                # Rozliczenia roczne: zakres płatny osobno, jeśli w planie roku ma kwotę (w którymkolwiek miesiącu).
                value.append([years.index(year), scopes.index(scope), int(scope in paid_months(plans.get(year, []))), int(round(amount))])
        codes = sorted({code for _, _, code in by_group.index})
        code_index = {code: i for i, code in enumerate(codes)}
        jgp = []
        for (year, scope, code), amount in by_group.items():
            if round(amount):
                jgp.append([years.index(year), scopes.index(scope), int(scope in paid_months(plans.get(year, []))), code_index[code], int(round(amount))])
        hospitals[key] = {"years": years, "scopes": [[scope, names[scope]] for scope in scopes], "hosp": hosp, "value": sorted(value), "codes": codes, "jgp": sorted(jgp)}
        for y, year in enumerate(years):
            total = sum(row[3] for row in hosp if row[0] == y)
            paid = sum(row[3] for row in hosp if row[0] == y and row[2])
            print(f"{key} {year}: {total:,} hospitalizacji, za wykonanie {paid / max(total, 1):.0%}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as handle:
        json.dump({"version": 3, "hospitals": hospitals}, handle, ensure_ascii=False, separators=(",", ":"))
    print(f"Zapisano {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
