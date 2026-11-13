"""NFZ contracts from the public API „Umowy” (https://api.nfz.gov.pl/app-umw-api/, free, no key).

One module for every script that needs contract data (hospital cards: ryczałt / za wykonanie, the Finanse tab).

API, version 1.2:
  GET /agreements?year=Y&branch=OW&nip=NIP&limit=25&format=json   -> data.agreements[] (id, attributes), links.next
  GET /agreements/{id}?limit=25&format=json                        -> data.plans[] (attributes), links.next
Agreement attributes used: code, service-type (e.g. 03 leczenie szpitalne), service-name, amount, updated-at, provider-code.
Plan attributes used: product-code (kod zakresu or product, e.g. 03.4450.260.02, 03.0000.030.17 = ryczałt PSZ),
product-name, unit-count, price (zł for the year, after annexes), date-from, date-to.

Cache: data/nfz_umowy/<OW>_<NIP>.json (outside the repo, one file per API NIP) — {"version": 2, "fetched": {year: date}, "years": {year: [agreement]}}
with agreement = {"code", "type", "name", "amount", "updated", "provider", "plans": [[code, name, units, price, from, to], ...]}.
A year missing from the cache (or `refetch=True`) is downloaded again.
Some hospitals have their agreements in the API under another NIP than in the hospitalization files (old NIP, a new operator
of the same provider code): scripts/nfz_umowy_nip_uzupelnienie.csv (OW_NFZ, NIP, NIP_API) — the API is asked for NIP_API,
and the agreements of both NIPs are joined. The API sometimes returns an empty body when asked
too quickly: requests go through curl with retries and short pauses.
"""
from __future__ import annotations

import csv
import json
import subprocess
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "nfz_umowy"
PAGES_INDEX = ROOT / "build-data" / "hospitals" / "index.json"
NIP_SUPPLEMENT = Path(__file__).resolve().parent / "nfz_umowy_nip_uzupelnienie.csv"
API = "https://api.nfz.gov.pl/app-umw-api"
YEARS = [str(year) for year in range(2017, 2026)]
CACHE_VERSION = 2
# Produkt ryczałtu sieci szpitali (PSZ) w planie umowy „Leczenie szpitalne”.
LUMP_SUM_PRODUCT = "03.0000.030.17"
# Kolumny pozycji planu w cache i w plikach wynikowych.
PLAN_CODE, PLAN_NAME, PLAN_UNITS, PLAN_PRICE, PLAN_FROM, PLAN_TO = range(6)


def page_keys() -> list[str]:
    """Keys „OW|NIP” of hospitals with a card (build-data/hospitals/index.json from build_hospital_index.py)."""
    if not PAGES_INDEX.exists():
        raise SystemExit(f"Brak {PAGES_INDEX.relative_to(ROOT)} — uruchom scripts/build_hospital_index.py")
    return [key for key, _, _ in json.loads(PAGES_INDEX.read_text(encoding="utf-8"))["pages"]]


def get_json(url: str, attempts: int = 8) -> dict:
    """GET with retries: the API sometimes returns an empty body when asked too quickly."""
    for attempt in range(attempts):
        result = subprocess.run(["curl", "-s", "--max-time", "60", url], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            try:
                data = json.loads(result.stdout)
            except json.JSONDecodeError:
                data = None
            # Błąd API (np. przeciążenie) przychodzi jako {"errors": [...]}: ponawiamy jak pustą odpowiedź.
            # Rok bez umów to poprawna odpowiedź z `"data": null`.
            if isinstance(data, dict) and "data" in data:
                return data
        # Puste odpowiedzi to zwykle przeciążenie API: coraz dłuższa przerwa (do ok. 30 s).
        time.sleep(min(30, 2 * (attempt + 1) ** 1.5))
    raise RuntimeError(f"API NFZ nie odpowiada: {url}")


def fetch_year(ow: str, nip: str, year: str) -> list[dict]:
    """All agreements of a provider (OW + NIP) in a year, each with its plan positions."""
    agreements: list[dict] = []
    url: str | None = f"{API}/agreements?year={year}&branch={ow}&nip={nip}&limit=25&format=json&api-version=1.2"
    while url:
        page = get_json(url)
        for item in (page["data"] or {}).get("agreements") or []:
            attributes = item["attributes"]
            plans: list[list] = []
            detail: str | None = f"{API}/agreements/{item['id']}?limit=25&format=json&api-version=1.2"
            while detail:
                response = get_json(detail)
                for plan in (response["data"] or {}).get("plans") or []:
                    p = plan["attributes"]
                    plans.append([p["product-code"], p["product-name"], p.get("unit-count") or 0, p.get("price") or 0, (p.get("date-from") or "")[:10], (p.get("date-to") or "")[:10]])
                detail = response["links"].get("next")
                time.sleep(0.3)
            agreements.append({
                "code": attributes.get("code"), "type": attributes["service-type"], "name": attributes["service-name"],
                "amount": attributes.get("amount") or 0, "updated": (attributes.get("updated-at") or "")[:10], "provider": attributes.get("provider-code"),
                "plans": plans,
            })
        url = page["links"].get("next")
    return agreements


def api_nips(key: str) -> list[str]:
    """NIPs to ask the API for a hospital key „OW|NIP”: its own NIP and the ones from nfz_umowy_nip_uzupelnienie.csv."""
    ow, nip = key.split("|")
    extra = []
    if NIP_SUPPLEMENT.exists():
        with NIP_SUPPLEMENT.open(encoding="utf-8") as handle:
            extra = [row["NIP_API"].strip() for row in csv.DictReader(handle) if row["OW_NFZ"].zfill(2) == ow and row["NIP"].strip() == nip]
    return [nip, *extra]


def cached_years(ow: str, nip: str, refetch: bool, years: list[str]) -> dict[str, list[dict]]:
    """Agreements of one API NIP in one OW, year by year, from the cache file or the API."""
    path = CACHE / f"{ow}_{nip}.json"
    cached = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if cached.get("version") != CACHE_VERSION:
        cached = {"version": CACHE_VERSION, "fetched": {}, "years": {}}
    missing = [year for year in years if refetch or year not in cached["years"]]
    for year in missing:
        print(f"API NFZ: umowy {ow}|{nip} {year}")
        cached["years"][year] = fetch_year(ow, nip, year)
        cached["fetched"][year] = date.today().isoformat()
    if missing:
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(cached, ensure_ascii=False), encoding="utf-8")
    return {year: cached["years"][year] for year in years}


def contracts(key: str, refetch: bool = False, years: list[str] = YEARS) -> dict[str, list[dict]]:
    """Agreements with plans of a hospital („OW|NIP”) in every year: {year: [agreement]}, from the cache or the API."""
    ow = key.split("|")[0]
    out: dict[str, list[dict]] = {year: [] for year in years}
    for nip in api_nips(key):
        for year, agreements in cached_years(ow, nip, refetch, years).items():
            out[year].extend(agreements)
    return out


def priced_scopes(agreements: list[dict]) -> set[str]:
    """Scopes with an own amount in the plan = paid per stay; the lump-sum product is not one of them."""
    return {plan[PLAN_CODE] for agreement in agreements for plan in agreement["plans"] if (plan[PLAN_PRICE] or 0) > 0 and plan[PLAN_CODE] != LUMP_SUM_PRODUCT}
