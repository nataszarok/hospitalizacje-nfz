#!/usr/bin/env python3
"""Build JGP group profiles from the NFZ JGP statistics API: build-data/jgp_profiles.json.gz.

Source: API "Statystyki NFZ - Świadczenia" (https://api.nfz.gov.pl/app-stat-api-jgp, v1.1), per group:
  - "Dane ogólne" (basic-data): patients, hospitalizations, median length of stay;
  - "Rozpoznania ICD 10" (icd10-diseases): most frequent main diagnoses, or the directional list when the group has no other;
  - "Procedury ICD 9 - Kody listy kierunkowej" (icd9-procedures): procedures that qualify a stay to the group.
The API has data up to 2024. Each group gets its latest year in the API (2024, or the last year
of a withdrawn group). Raw responses are cached in data/nfz_jgp_stats/profile/<KOD>.json; without
--fetch the script only reads the cache (groups without a cache file are skipped).

Output (read only by the build: group descriptions on /jgp/[kod]):
  {"version": 1, "source": ..., "fields": [...], "icd10": {code: name}, "icd9": {code: name},
   "groups": {"E10": [year, patients, hospitalizations, median_days, [[icd10, pct], ...], [[icd9, pct], ...], icd10_directional]}}
(icd10_directional = 1 when the group has only the directional list of diagnoses, not all main diagnoses).
Percent = share of the group's hospitalizations with the code (a stay can have several qualifying
procedures, so procedure shares can sum to more than 100).

Usage:
  python3 scripts/build_jgp_profiles.py --fetch            # download missing groups, then build
  python3 scripts/build_jgp_profiles.py --fetch --refresh  # download all groups again
  python3 scripts/build_jgp_profiles.py                    # build from the cache only
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from build_hospitalizations import ROOT, write_json_gz

API = "https://api.nfz.gov.pl/app-stat-api-jgp"
# Bez nagłówka User-Agent CDN NFZ zwraca stronę HTML zamiast JSON.
USER_AGENT = "funduszdanych-build/1.0 (+https://funduszdanych.pl)"
API_YEARS = list(range(2024, 2016, -1))
# Typ tabeli w indeksie API, nagłówki w kolejności wyboru i zasób API → klucz w pliku z odpowiedziami.
# Rozpoznania: część grup ma tabelę wszystkich rozpoznań, część tylko listę kierunkową (kwalifikującą do grupy);
# tabel „Kody dodatkowe listy …” i „Procedury ICD 9” (wszystkie procedury, także badania) nie używamy.
TABLES = {
    "general": ("general-data", ["Dane ogólne"], "basic-data"),
    "icd10": ("icd-10-diseases", ["Rozpoznania ICD 10", "Rozpoznania ICD 10 - Kody listy kierunkowej"], "icd10-diseases"),
    "icd9": ("icd-9-procedures", ["Procedury ICD 9 - Kody listy kierunkowej"], "icd9-procedures"),
}
TOP = 10
SOURCE = "NFZ, API statystyk JGP (app-stat-api-jgp, v1.1): dane ogólne, rozpoznania ICD-10, procedury ICD-9 z listy kierunkowej"


def get(path: str, params: dict, delay: float) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json", "api-version": "1.1"})
    request = urllib.request.Request(f"{API}/{path}?{query}", headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(5):
        time.sleep(delay * (1 + attempt * 3))
        start = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read()
            if time.monotonic() - start > 5:
                print(f"  wolne zapytanie ({time.monotonic() - start:.0f} s): {path}", file=sys.stderr, flush=True)
            return json.loads(body)
        # OSError obejmuje też socket.timeout (w Pythonie 3.9 nie jest to TimeoutError).
        except (OSError, json.JSONDecodeError) as error:
            print(f"  ponowienie {attempt + 1} po {time.monotonic() - start:.0f} s: {path}: {error}", file=sys.stderr, flush=True)
            last = error
    raise RuntimeError(f"{path}: {last}")


def squash(text: str) -> str:
    return " ".join(text.split())


def benefit_names(data_dir: Path) -> dict[str, list[str]]:
    """Kod grupy → nazwy ze słownika API (nazwa w zapytaniu musi być identyczna jak w /benefits)."""
    names: dict[str, list[str]] = {}
    for item in json.loads((data_dir / "jgp_benefits_nfz.json").read_text(encoding="utf-8")):
        names.setdefault(item["name"].split(" ")[0], []).append(item["name"])
    return names


def fetch_group(code: str, names: list[str], delay: float) -> dict | None:
    """Najnowszy rok grupy w API: indeks tabel, potem trzy tabele."""
    for year in API_YEARS:
        for name in names:
            index = get("index-of-tables", {"catalog": "1a", "name": name, "year": year}, delay).get("data")
            # Indeks bywa pusty albo ma `years: null` / `tables: null`, gdy grupy nie było w danym roku.
            tables = [table for block in ((index or {}).get("attributes") or {}).get("years") or [] for table in block.get("tables") or []]
            if not tables:
                continue
            result = {"code": code, "name": name, "year": year, "product": index["attributes"]["product-code"]}
            for key, (kind, headers, path) in TABLES.items():
                found = [(headers.index(squash(t["attributes"]["header"])), t) for t in tables if t["type"] == kind and squash(t["attributes"]["header"]) in headers]
                table = min(found, key=lambda item: item[0])[1] if found else None
                result[key] = get(f"{path}/{table['id']}", {"limit": 25}, delay)["data"]["attributes"]["data"] if table else None
                result[f"{key}_header"] = squash(table["attributes"]["header"]) if table else None
            return result
    return None


def pct(value) -> float:
    return round(float(value or 0), 1)


def compact(raw: dict, icd10: dict[str, str], icd9: dict[str, str]) -> list:
    general = (raw.get("general") or [{}])[0]
    diseases = sorted(raw.get("icd10") or [], key=lambda row: -(row.get("percentage") or 0))[:TOP]
    procedures = sorted(raw.get("icd9") or [], key=lambda row: -(row.get("percentage") or 0))[:TOP]
    for row in diseases:
        icd10.setdefault(row["disease-code"], squash(row["disease-name"]))
    for row in procedures:
        icd9.setdefault(row["procedure-code"], squash(row["procedure-name"]))
    return [
        str(raw["year"]),
        general.get("number-of-patients"),
        general.get("number-of-hospitalizations"),
        general.get("duration-of-hospitalization-mediana"),
        [[row["disease-code"], pct(row["percentage"])] for row in diseases],
        [[row["procedure-code"], pct(row["percentage"])] for row in procedures],
        # 1 = rozpoznania z listy kierunkowej grupy, 0 = wszystkie rozpoznania główne.
        1 if (raw.get("icd10_header") or "").endswith("listy kierunkowej") else 0,
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fetch", action="store_true", help="pobierz z API grupy bez pliku w cache")
    parser.add_argument("--refresh", action="store_true", help="z --fetch: pobierz ponownie wszystkie grupy")
    parser.add_argument("--only", help="lista kodów grup po przecinku (np. E10,H52)")
    parser.add_argument("--delay", type=float, default=0.3, help="przerwa między zapytaniami (s)")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--output", type=Path, default=ROOT / "build-data" / "jgp_profiles.json.gz")
    args = parser.parse_args()

    groups = json.loads((ROOT / "build-data" / "jgp" / "index.json").read_text(encoding="utf-8"))["groups"]
    if args.only:
        wanted = set(args.only.split(","))
        groups = [code for code in groups if code in wanted]
    cache = args.data_dir / "nfz_jgp_stats" / "profile"
    cache.mkdir(parents=True, exist_ok=True)
    names = benefit_names(args.data_dir)

    if args.fetch:
        todo = [code for code in groups if args.refresh or not (cache / f"{code}.json").exists()]
        for i, code in enumerate(todo, 1):
            raw = fetch_group(code, names.get(code, []), args.delay) if code in names else None
            # Brak grupy w API też zapisujemy, żeby kolejne uruchomienie jej nie odpytywało.
            (cache / f"{code}.json").write_text(json.dumps(raw or {"code": code, "missing": True}, ensure_ascii=False), encoding="utf-8")
            print(f"[{i}/{len(todo)}] {code}: {raw['year'] if raw else 'brak w API'}", file=sys.stderr, flush=True)

    icd10: dict[str, str] = {}
    icd9: dict[str, str] = {}
    out: dict[str, list] = {}
    missing = []
    for code in groups:
        path = cache / f"{code}.json"
        raw = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        if not raw or raw.get("missing"):
            missing.append(code)
            continue
        out[code] = compact(raw, icd10, icd9)
    write_json_gz(args.output, {
        "version": 1,
        "source": SOURCE,
        "fields": ["rok", "pacjenci", "hospitalizacje", "mediana_dni", "icd10_pct", "icd9_kierunkowe_pct", "icd10_lista_kierunkowa"],
        "icd10": dict(sorted(icd10.items())),
        "icd9": dict(sorted(icd9.items())),
        "groups": out,
    })
    print(f"{args.output}: {len(out)} grup, bez danych API: {len(missing)} ({', '.join(missing[:20])}{'…' if len(missing) > 20 else ''})")


if __name__ == "__main__":
    main()
