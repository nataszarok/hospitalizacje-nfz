#!/usr/bin/env python3
"""Dane artykułu „H55. Historia jednego kodu” (/artykuly/historia-h55).

Zapisuje build-data/articles/h55.json.gz (czyta tylko build, nie trafia do dist/):
  - hospitalizacje H55 świadczeniodawca × miesiąc 2017–2025, metoda „min” („<5” = 1, jak w aplikacji; wspólne iter_frames
    z build_hospitalizations.py); format kolumnowy:
    {"providers": ["OW|NIP", ...], "rows": {"provider": [...], "month": [...], "hospitalizations": [...]}},
    miesiąc = indeks roku × 12 + miesiąc − 1 (lata w "years");
  - udział procedury ICD-9 03.96 (termolezja) w hospitalizacjach H55 z API statystyk JGP NFZ
    (app-stat-api-jgp v1.1, tabela „Procedury ICD 9 - Kody listy kierunkowej”), lata 2017–2024:
    [[rok, hospitalizacje grupy, hospitalizacje z 03.96, udział %], ...].

  - wycena grupy HK14 (od 2026 r. termolezja 03.96) z katalogu grup — załącznik 1a do zarządzenia Prezesa NFZ
    (tekst ujednolicony 46/2026/DSOZ, data/wyceny/zrodla/; zarządzenie 32/2026/DSOZ ustaliło te wartości dla świadczeń
    od 1 stycznia 2026 r.);
  - poradnie neurochirurgiczne (RPWDL, eksport z września 2026 r., z datami otwarcia komórek) i umowy AOS NFZ
    w zakresie neurochirurgii (cache API „Umowy”, data/nfz_umowy/) dla lat 2023–2025;
  - udział pobytów w zakresach „jednego dnia” i pobytów 0-dniowych według świadczeniodawcy (otwarte dane, od 2023 r.);
  - kwoty rozliczone przez NFZ i liczba punktów: H55 w latach 2019–2025 i HK14 w 2026 r. (zestawienie świadczeń NFZ,
    data/zestawienie_swiadczen_2019_2026.csv): przeciętna wartość punktu = zł / punkty.

Odpowiedzi API są w data/nfz_jgp_stats/h55_lata/<rok>.json (poza repozytorium). --fetch pobiera je ponownie.

Użycie:
  python3 scripts/articles/build_h55_article.py [--data-dir data] [--fetch]
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

# Skrypty artykułów są w scripts/articles/; wspólne moduły danych (build_hospitalizations, calibrate_below5…) w scripts/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build_hospitalizations import ALL_YEARS, ROOT, iter_frames, source_path, write_json_gz
from build_jgp_profiles import benefit_names, get, squash

PRODUCT = "5.51.01.0008055"  # H55 w katalogu JGP
GROUP = "H55"
PROCEDURE = "03.96"
API_YEARS = range(2017, 2025)
PROCEDURE_TABLE = "Procedury ICD 9 - Kody listy kierunkowej"
OUT = ROOT / "build-data" / "articles" / "h55.json.gz"
# Wartości „<5”: najpierw metoda konserwatywna (min, „<5” = 1), potem kalibracja do sum API (calibrate_below5.py, cal v4).
METHOD = "cal"
VALUE = "h_min"
CALIBRATION_FROM = 2019   # pierwszy rok zestawienia świadczeń; lata wcześniejsze — proporcja placówki z tego roku


def monthly(data_dir: Path, years: list[str]) -> tuple[list[str], dict[str, list[int]], dict[tuple[str, int], list[float]]]:
    """Hospitalizacje H55 (metoda min, „<5” = 1, jak w aplikacji) według świadczeniodawcy i miesiąca. Dodatkowo dla lat od ONE_DAY_FROM:
    świadczeniodawca × rok → [hospitalizacje, w zakresach „jednego dnia” (kod zakresu …032…), pobyty 0 dni]."""
    totals: dict[tuple[str, int], float] = defaultdict(float)
    one_day: dict[tuple[str, int], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    for y, year in enumerate(years):
        for frame, _ in iter_frames(source_path(data_dir, year), year):
            frame = frame[frame["product"] == PRODUCT]
            if frame.empty:
                continue
            for (ow, nip, month), value in frame.groupby(["ow", "nip", "month"])[VALUE].sum().items():
                totals[(f"{ow}|{nip}", y * 12 + int(month) - 1)] += value
            if int(year) >= ONE_DAY_FROM:
                frame = frame.assign(jcd=frame["scope"].str.contains(r"\.032\.", regex=True), day0=frame["duration"].eq("0 dni"))
                for (ow, nip), part in frame.groupby(["ow", "nip"]):
                    row = one_day[(f"{ow}|{nip}", int(year))]
                    row[0] += part[VALUE].sum()
                    row[1] += part.loc[part["jcd"], VALUE].sum()
                    row[2] += part.loc[part["day0"], VALUE].sum()
        print(f"  {year}: gotowe", flush=True)
    providers = sorted({key for key, _ in totals})
    index = {key: i for i, key in enumerate(providers)}
    rows = sorted((index[key], month, int(round(value))) for (key, month), value in totals.items() if round(value) > 0)
    return providers, {
        "provider": [r[0] for r in rows],
        "month": [r[1] for r in rows],
        "hospitalizations": [r[2] for r in rows],
    }, one_day


# Poradnie i oddziały z RPWDL (kod resortowy, część VIII) i zakresy umów AOS NFZ (kod zakresu zaczyna się od 02.<kod>).
CLINIC_CODES = {"neurochirurgia": ("1570", "1571"), "leczenie_bolu": ("1222", "1223")}
WARD_CODES = ("4570", "4571")  # oddział neurochirurgiczny
CLINIC_YEARS = (2023, 2024, 2025)
CONTRACT_YEARS = (2022, 2023, 2024, 2025)
ONE_DAY_FROM = 2023


def clinics(data_dir: Path, providers: list[str]) -> dict:
    """Czy świadczeniodawca (NIP) miał w danym roku poradnię neurochirurgiczną, poradnię leczenia bólu lub oddział neurochirurgii
    w RPWDL (komórka działała choć jeden dzień roku; eksport z września 2026 r. ma daty otwarcia i zamknięcia komórek)
    i czy miał z NFZ umowę AOS w zakresie neurochirurgii (cache API „Umowy”, tylko szpitale z kartą; brak pliku = null)."""
    import csv

    rpwdl = data_dir / "rpwdl"
    nip_of: dict[str, str] = {}
    with open(rpwdl / "podmioty.csv", encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            nip_of[row["ID Księgi"]] = "".join(ch for ch in row["NIP"] if ch.isdigit())
    kinds = {code: kind for kind, codes in CLINIC_CODES.items() for code in codes} | {code: "oddzial" for code in WARD_CODES}
    cells: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    with open(rpwdl / "komorki.csv", encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            kind = kinds.get(row["kodResortVIII"])
            if kind:
                end = row["Data zakończenia działalności komórki"]
                cells[nip_of.get(row["ID Księgi"], "")].append((kind, row["Data rozpoczęcia działalności komórki"], "" if end == "NULL" else end))

    def active(nip: str, kind: str, year: int) -> int:
        return int(any(k == kind and start <= f"{year}-12-31" and (not end or end >= f"{year}-01-01") for k, start, end in cells.get(nip, [])))

    def plans(key: str, year: int) -> list | None:
        path = data_dir / "nfz_umowy" / f"{key.replace('|', '_')}.json"
        if not path.exists():
            return None
        return [plan for item in json.loads(path.read_text()).get("years", {}).get(str(year), []) for plan in item.get("plans", [])]

    def contract(key: str, year: int) -> int | None:
        rows = plans(key, year)
        if rows is None:
            return None
        return int(any(plan[0].startswith(tuple(f"02.{code}" for code in CLINIC_CODES["neurochirurgia"])) and (plan[3] or 0) > 0 for plan in rows))

    def plan_pln(key: str, year: int, kind: str) -> int | None:
        """Kwota w planie umów AOS (zł) w zakresach poradni danego rodzaju; AOS jest nielimitowana, więc plan po aneksach ≈ wykonanie."""
        rows = plans(key, year)
        if rows is None:
            return None
        return round(sum(plan[3] or 0 for plan in rows if plan[0].startswith(tuple(f"02.{code}" for code in CLINIC_CODES[kind]))))

    rows = []
    for key in providers:
        nip = key.split("|")[1]
        starts = [start for kind, start, _ in cells.get(nip, []) if kind == "neurochirurgia"]
        rows.append([
            key,
            [active(nip, "neurochirurgia", year) for year in CLINIC_YEARS],
            [contract(key, year) for year in CLINIC_YEARS],
            [active(nip, "leczenie_bolu", year) for year in CLINIC_YEARS],
            [active(nip, "oddzial", year) for year in CLINIC_YEARS],
            min(starts)[:7] if starts else None,
            [plan_pln(key, year, "leczenie_bolu") for year in CONTRACT_YEARS],
        ])
    info = (rpwdl / "Info.txt").read_text(encoding="utf-8", errors="replace").strip() if (rpwdl / "Info.txt").exists() else ""
    return {
        "years": list(CLINIC_YEARS),
        "source": info,
        "fields": ["swiadczeniodawca", "poradnia_neurochirurgiczna_w_latach", "umowa_aos_neurochirurgia_w_latach", "poradnia_leczenia_bolu_w_latach", "oddzial_neurochirurgii_w_latach", "pierwsza_poradnia_od", "umowa_aos_leczenie_bolu_zl_w_latach_umow"],
        "contractYears": list(CONTRACT_YEARS),
        "rows": rows,
    }


# Tabele API dla pobytów: zakresy umów (w tym „zespół chirurgii jednego dnia”) i długość pobytu w dniach.
STAY_TABLES = {"hospitalization-by-service": "service", "histograms": "histogram"}


def fetch_year(year: int, name: str, delay: float) -> dict | None:
    index = get("index-of-tables", {"catalog": "1a", "name": name, "year": year}, delay).get("data")
    tables = [t for block in ((index or {}).get("attributes") or {}).get("years") or [] for t in block.get("tables") or []]
    if not tables:
        return None
    out = {"year": year, "name": name, "tables": {}}
    paths = {"general-data": "basic-data", "icd-9-procedures": "icd9-procedures"}
    for table in tables:
        if table["type"] in paths:
            header = squash(table["attributes"]["header"])
            out["tables"][header] = get(f"{paths[table['type']]}/{table['id']}", {"limit": 25}, delay)["data"]["attributes"]["data"]
    out.update(fetch_stay_tables(tables, delay))
    return out


def fetch_stay_tables(tables: list[dict], delay: float) -> dict[str, list]:
    """Zakresy umów i długość pobytu: wszystkie strony tabeli (API zwraca najwyżej 25 wierszy na stronę)."""
    out: dict[str, list] = {}
    for table in tables:
        short = STAY_TABLES.get(table["type"])
        if not short or short in out:
            continue
        path = table["links"]["related"].split("/app-stat-api-jgp/", 1)[1].split("?", 1)[0]
        rows, page = [], 1
        while True:
            data = get(path, {"limit": 25, "page": page}, delay)
            rows += data["data"]["attributes"]["data"] or []
            if not (data.get("links") or {}).get("next"):
                break
            page += 1
        out[short] = rows
    return out


def stays(raw: dict) -> list[int]:
    """[pobyty w zakresach „zespół chirurgii jednego dnia”, pobyty 0-dniowe, pobyty 1-dniowe] z tabel API."""
    one_day = sum(r["number-of-hospitalizations"] for r in raw["service"] if "JEDNEGO DNIA" in (r.get("contract-product-name") or "").upper())
    points = {p["x"]: p["y"] for p in raw["histogram"][0]["points"]} if raw["histogram"] else {}
    return [one_day, points.get(0, 0), points.get(1, 0)]


def procedure_shares(data_dir: Path, fetch: bool, delay: float) -> tuple[list[list], list[list]]:
    """Z API statystyk JGP: [rok, hospitalizacje H55, z 03.96, udział %] oraz [rok, hospitalizacje, w zakresach
    „jednego dnia”, 0 dni, 1 dzień]."""
    cache = data_dir / "nfz_jgp_stats" / "h55_lata"
    names = benefit_names(data_dir)[GROUP]
    shares, stay_rows = [], []
    for year in API_YEARS:
        path = cache / f"{year}.json"
        if fetch or not path.exists():
            raw = next((r for r in (fetch_year(year, name, delay) for name in names) if r), None)
            if raw is None:
                raise SystemExit(f"API nie ma grupy {GROUP} w roku {year}")
            cache.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
        raw = json.loads(path.read_text(encoding="utf-8"))
        # Starszy cache bez tabel pobytów: dopisujemy je bez pobierania reszty.
        if "service" not in raw or "histogram" not in raw:
            index = get("index-of-tables", {"catalog": "1a", "name": raw["name"], "year": year}, delay).get("data")
            tables = [t for block in index["attributes"]["years"] for t in block["tables"]]
            raw.update(fetch_stay_tables(tables, delay))
            path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
        general = raw["tables"]["Dane ogólne"][0]
        row = next(r for r in raw["tables"][PROCEDURE_TABLE] if r["procedure-code"] == PROCEDURE)
        shares.append([year, general["number-of-hospitalizations"], row["number-of-hospitalizations"], row["percentage"]])
        stay_rows.append([year, general["number-of-hospitalizations"], *stays(raw)])
    return shares, stay_rows


HK14_PRODUCT = "5.51.01.0008220"
CATALOG_2026 = "wyceny/zrodla/2026-09-24_46-2026-DSOZ_ujednolicony_zal1a.xlsx"
CATALOG_2026_SOURCE = "Załącznik 1a do zarządzenia nr 46/2026/DSOZ Prezesa NFZ (tekst ujednolicony z 23.09.2026)"
SETTLEMENTS = "zestawienie_swiadczen_2019_2026.csv"
# Kolumny katalogu grup (pozycja w wierszu): punkty za hospitalizację, planową, leczenie jednego dnia,
# pobyt z przyjęciem i wypisem tego samego dnia, pobyt 1-dniowy i 2-dniowy.
CATALOG_COLUMNS = {"hospitalizacja": 4, "planowa": 5, "jeden_dzien": 6, "zero_dni": 8, "jeden_dzien_pobytu": 9, "dwa_dni_pobytu": 10}


def catalog_points(path: Path, code: str) -> dict[str, int]:
    """Punkty grupy z katalogu grup (załącznik 1a): wiersz z kodem grupy w kolumnie B."""
    import openpyxl

    sheet = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [row for row in sheet.iter_rows(values_only=True) if len(row) > 10 and row[1] == code]
    if not rows:
        raise SystemExit(f"{path.name}: brak grupy {code}")
    values = {key: rows[0][i] for key, i in CATALOG_COLUMNS.items()}
    if any(len({row[i] for row in rows}) > 1 for i in CATALOG_COLUMNS.values()):
        raise SystemExit(f"{path.name}: różne wyceny grupy {code} w kilku wierszach")
    return {key: int(value) for key, value in values.items() if value not in (None, "")}


def settled(data_dir: Path) -> list[list]:
    """[rok, kod grupy, zł, punkty] dla H55 (2019–2025) i HK14 (2026) z zestawienia świadczeń NFZ."""
    import pandas as pd

    frame = pd.read_csv(data_dir / SETTLEMENTS, sep=";", dtype=str, usecols=["Rok", "Kod_produktu_jednostkowego", "Wartosc_jednostek_rozliczonych", "Liczba_jednostek_rozliczonych"])
    frame = frame[frame["Kod_produktu_jednostkowego"].isin([PRODUCT, HK14_PRODUCT])]
    for column in ["Wartosc_jednostek_rozliczonych", "Liczba_jednostek_rozliczonych"]:
        frame[column] = pd.to_numeric(frame[column].str.replace(",", "."), errors="coerce").fillna(0)
    out = []
    for (year, product), part in frame.groupby(["Rok", "Kod_produktu_jednostkowego"]):
        out.append([int(year), GROUP if product == PRODUCT else "HK14", round(part["Wartosc_jednostek_rozliczonych"].sum()), round(part["Liczba_jednostek_rozliczonych"].sum())])
    return sorted(out)


ONE_DAY_POINTS = 3362  # H55, „leczenie jednego dnia” (wycena bez zmian od 2020 r.)


def estimate_by_provider(data_dir: Path, api: dict[int, int]) -> dict:
    """Szacunek hospitalizacji H55 w roku bez danych API (2025): dla każdego świadczeniodawcy punkty z zakresów „jednego dnia”
    (kod zakresu …032…) ÷ 3362 pkt plus punkty z pozostałych zakresów ÷ k, co najmniej liczba pacjentów świadczeniodawcy;
    suma wszystkich. k (przeciętne punkty na pobyt w zwykłej hospitalizacji) kalibrujemy tak, żeby metoda dała liczbę z API
    w ostatnim roku API. Test: k z roku wcześniej zastosowane do ostatniego roku API (błąd w %)."""
    import pandas as pd

    frame = pd.read_csv(data_dir / SETTLEMENTS, sep=";", dtype=str, usecols=["Rok", "Kod_swiadczeniodawcy", "Kod_zakresu", "Kod_produktu_jednostkowego", "Liczba_pacjentow", "Liczba_jednostek_rozliczonych"])
    frame = frame[frame["Kod_produktu_jednostkowego"] == PRODUCT].copy()
    for column in ["Liczba_pacjentow", "Liczba_jednostek_rozliczonych"]:
        frame[column] = pd.to_numeric(frame[column].str.replace(",", "."), errors="coerce").fillna(0)
    frame["jcd"] = frame["Kod_zakresu"].str.contains(r"\.032\.", regex=True)

    def total(year: int, k: float) -> float:
        rows = frame[frame["Rok"] == str(year)]
        stays = rows["Liczba_jednostek_rozliczonych"] / rows["jcd"].map({True: ONE_DAY_POINTS, False: k})
        by_provider = rows.assign(stays=stays).groupby("Kod_swiadczeniodawcy").agg(stays=("stays", "sum"), patients=("Liczba_pacjentow", "sum"))
        return float(by_provider.max(axis=1).sum())

    def calibrate(year: int) -> float:
        low, high = 3000.0, 5000.0
        for _ in range(60):
            mid = (low + high) / 2
            low, high = (mid, high) if total(year, mid) > api[year] else (low, mid)
        return (low + high) / 2

    years = sorted(api)
    reference, previous = years[-1], years[-2]
    target = max(int(y) for y in frame["Rok"].unique())
    k = calibrate(reference)
    backtest = total(reference, calibrate(previous))
    return {
        "year": target,
        "hospitalizations": round(total(target, k)),
        "providers": int(frame[frame["Rok"] == str(target)]["Kod_swiadczeniodawcy"].nunique()),
        "pointsPerStay": round(k),
        "referenceYear": reference,
        "backtest": {"year": reference, "estimate": round(backtest), "api": api[reference], "errorPct": round(abs(backtest - api[reference]) / api[reference] * 100, 2)},
    }


# Termolezja: pacjenci według świadczeniodawcy, rozpoznania ICD-10 i procedury ICD-9 (NFZ, „Zestawienie 2: liczba pacjentów
# wg ICD-10 i ICD-9”, wszystkie rodzaje świadczeń). 03.96 — termolezja stawów kręgosłupa (szpital, H55); 04.25 — termolezja
# nerwów obwodowych (tak rozlicza się termolezję w AOS, grupa Z13). Plik nie rozdziela rodzaju świadczeń.
THERMOLYSIS_SOURCES = {2024: "Zestawienie_2_l_pacj_ICD10_ICD9_2024.csv", 2025: "Zestawienie_2_l_pacj_ICD10_ICD9_2025kwI_IV.csv"}
THERMOLYSIS_CODES = ("03.96", "04.25")
THERMOLYSIS_CACHE = "nfz_icd9"


def thermolysis_rows(data_dir: Path, year: int, source: str) -> list[dict]:
    """Wiersze 03.96 i 04.25 z pliku zestawienia (ok. 6 GB): filtr po tekście linii, potem csv; wynik w cache data/nfz_icd9/."""
    import csv

    cache = data_dir / THERMOLYSIS_CACHE / f"termolezja_{year}.csv"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        needles = tuple(f'"{code}"'.encode() for code in THERMOLYSIS_CODES)
        with open(data_dir / "ICD10" / source, "rb") as handle, open(cache, "wb") as out:
            out.write(handle.readline())
            for line in handle:
                if any(needle in line for needle in needles):
                    out.write(line)
    with open(cache, encoding="utf-8", newline="") as handle:
        return [row for row in csv.DictReader(handle, delimiter=";") if row["KOD_PROCEDURY"] in THERMOLYSIS_CODES]


def thermolysis(data_dir: Path) -> dict | None:
    """Pacjenci z termolezją 03.96 i 04.25 według świadczeniodawcy (OW|NIP) i roku; „<5” jak w hospitalizacjach: metoda sim
    (losowanie 1–4 z wagami e^-x, seed 42) i min (1). Kod świadczeniodawcy → NIP: nfz_swiadczeniodawcy_2025.csv i uzupełnienie."""
    import numpy as np
    import pandas as pd

    sources = {year: name for year, name in THERMOLYSIS_SOURCES.items() if (data_dir / "ICD10" / name).exists() or (data_dir / THERMOLYSIS_CACHE / f"termolezja_{year}.csv").exists()}
    if not sources:
        print("Uwaga: brak plików zestawienia ICD-10/ICD-9 — artykuł bez danych o termolezji w AOS.")
        return None
    providers = pd.read_csv(data_dir / "nfz_swiadczeniodawcy_2025.csv", dtype=str, encoding="utf-8-sig")
    nip_by_code = dict(zip(providers["oddzial_nfz"].str.zfill(2) + "|" + providers["kod"].str.strip(), providers["nip"].str.strip()))
    supplement_path = data_dir / "kody_swiadczeniodawcow_uzupelnienie.csv"
    supplement = pd.read_csv(supplement_path, dtype=str, encoding="utf-8-sig").fillna("") if supplement_path.exists() else pd.DataFrame()
    rng = np.random.default_rng(42)
    values = np.array([1, 2, 3, 4])
    weights = np.exp(-values)
    p = weights / weights.sum()
    totals: dict[tuple[str, int, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    national: dict[tuple[int, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    providers_by: dict[tuple[int, str], set] = defaultdict(set)
    diagnoses: dict[tuple[int, str, str], float] = defaultdict(float)
    unmapped: dict[int, float] = defaultdict(float)
    for year, source in sorted(sources.items()):
        overrides = {f"{r.OW_NFZ.zfill(2)}|{r.KOD_SWIADCZENIODAWCY.strip()}": r.NIP.strip() for r in supplement.itertuples(index=False)
                     if not r.LATA.strip() or str(year) in [y.strip() for y in r.LATA.split(",")]} if len(supplement) else {}
        for row in thermolysis_rows(data_dir, year, source):
            raw = row["LICZBA_PACJENTOW"].strip()
            sim, low = (float(rng.choice(values, p=p)), 1.0) if raw == "<5" else (float(raw), float(raw))
            code = f"{row['OW'].strip().zfill(2)}|{row['KOD_SWIADCZENIODAWCY'].strip()}"
            proc = row["KOD_PROCEDURY"]
            national[(year, proc)][0] += sim
            national[(year, proc)][1] += low
            providers_by[(year, proc)].add(code)
            diagnoses[(year, proc, row["ROZPOZNANIE_WG_ICD10"].strip()[:3])] += sim
            nip = overrides.get(code) or nip_by_code.get(code)
            if not nip:
                unmapped[year] += sim
                continue
            key = f"{code.split('|')[0]}|{nip}"
            totals[(key, year, proc)][0] += sim
            totals[(key, year, proc)][1] += low
        print(f"  termolezja {year}: {sum(v[0] for (y, _), v in national.items() if y == year):.0f} pacjentów (sim), bez NIP {unmapped[year]:.0f}", flush=True)
    top: list[list] = []
    for (year, proc) in sorted(national):
        ranked = sorted(((icd, v) for (y, pr, icd), v in diagnoses.items() if y == year and pr == proc), key=lambda item: -item[1])
        top += [[year, proc, icd, round(v)] for icd, v in ranked[:4]]
    return {
        "source": "NFZ, Zestawienie 2: liczba pacjentów według rozpoznania ICD-10 i procedury ICD-9, według świadczeniodawcy (" + ", ".join(f"{y}: {n}" for y, n in sorted(sources.items())) + ")",
        "fields": ["swiadczeniodawca", "rok", "procedura", "pacjenci_sim", "pacjenci_min"],
        "rows": [[key, year, proc, round(v[0]), round(v[1])] for (key, year, proc), v in sorted(totals.items())],
        "national": [[year, proc, round(v[0]), round(v[1]), len(providers_by[(year, proc)])] for (year, proc), v in sorted(national.items())],
        "diagnoses": top,
        "unmapped": {str(year): round(value) for year, value in unmapped.items()},
    }


def calibration(data_dir: Path, years: list[str], estimate: dict | None) -> dict[str, dict[str, tuple[int, int]]]:
    """Kalibracja „<5” dla H55 (metoda cal v4, scripts/calibrate_below5.py): świadczeniodawca × rok → (pobyty cal, pobyty min).

    Lata z API statystyk JGP: suma grupy = API. Brakujące tabele API dla H55 pobiera fetch_jgp_stats.fetch do
    data/nfz_jgp_stats/tabele/<rok>/. Rok bez API (szacunek `estimate`): zakresy, histogram dni i iloraz pobytów do pacjentów
    z ostatniego roku API, suma = szacunek z punktów. Wycena: plik roku albo ostatni dostępny (H55: 3955 pkt od 2020 r.)."""
    import calibrate_below5 as cb
    import fetch_jgp_stats

    items = json.loads((data_dir / "jgp_benefits_nfz.json").read_text(encoding="utf-8"))
    item = next(entry for entry in items if entry["code"] == PRODUCT)
    result: dict[str, dict[str, tuple[int, int]]] = {}
    last_api = None
    for year in [y for y in years if int(y) >= CALIBRATION_FROM]:
        tables = data_dir / "nfz_jgp_stats" / "tabele" / year
        if int(year) in API_YEARS:
            tables.mkdir(parents=True, exist_ok=True)
            fetch_jgp_stats.fetch(item, year, tables)
            a = cb.read_api(data_dir, year).get(PRODUCT)
        else:
            a = None
        if a is None:
            if not (estimate and int(year) == estimate["year"] and last_api):
                continue
            scale = estimate["hospitalizations"] / last_api["N"]
            a = dict(N=estimate["hospitalizations"], P=round(last_api["P"] * scale), Z={z: round(n * scale) for z, n in last_api["Z"].items()},
                     H=last_api["H"], D=round(last_api["D"] * scale))
        else:
            last_api = a
        valuation_years = sorted(int(f.stem.rsplit("_", 1)[1]) for f in (data_dir / "wyceny").glob("wyceny_jgp_*.csv"))
        valuation_year = str(max([v for v in valuation_years if v <= int(year)] or valuation_years[:1]))
        hosp = cb.read_hospital_cells(source_path(data_dir, year), year)
        settlements, names = cb.read_settlements(data_dir, year)
        cells, report = cb.calibrate_group(PRODUCT, hosp[hosp.pj == PRODUCT].drop(columns="pj"), a, cb.read_valuations(data_dir, valuation_year).loc[PRODUCT],
                                           settlements[settlements.pj == PRODUCT].drop(columns="pj"), names)
        cells["key"] = cells.ow + "|" + cells.nip
        by_key = cells.groupby("key")[["N", "lo"]].sum()
        result[year] = {key: (int(row.N), int(row.lo)) for key, row in by_key.iterrows()}
        print(f"  kalibracja {year}: {report.get('N_cal')} pobytów (cel {a['N']})", flush=True)
    return result


def apply_calibration(providers: list[str], rows: dict[str, list[int]], years: list[str], factors: dict[str, dict[str, tuple[int, int]]]) -> dict[str, list[int]]:
    """Miesiące metody min przeskalowane do wyniku kalibracji placówki w roku (największe reszty: suma roku = wynik cal).
    Lata przed CALIBRATION_FROM: proporcja placówki z pierwszego roku kalibracji, a bez niej — proporcja kraju."""
    first = str(CALIBRATION_FROM)
    base = factors.get(first, {})
    national = sum(n for n, _ in base.values()) / max(1, sum(lo for _, lo in base.values())) if base else 1.0
    cells: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    for i, (provider, month, value) in enumerate(zip(rows["provider"], rows["month"], rows["hospitalizations"])):
        cells[(provider, month // 12)].append((i, value))
    out = list(rows["hospitalizations"])
    for (provider, y), items in cells.items():
        year, key = years[y], providers[provider]
        low = sum(value for _, value in items)
        if year in factors:
            target = factors[year].get(key, (low, low))[0]
        else:
            n, lo = base.get(key, (0, 0))
            target = round(low * (n / lo if lo else national))
        raw = [(i, value * target / low) for i, value in items]
        floors = {i: int(v) for i, v in raw}
        rest = target - sum(floors.values())
        for i, v in sorted(raw, key=lambda item: -(item[1] - int(item[1])))[:max(0, rest)]:
            floors[i] += 1
        for i, v in floors.items():
            out[i] = v
    return {**rows, "hospitalizations": out}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--fetch", action="store_true", help="pobierz ponownie tabele API statystyk JGP")
    parser.add_argument("--delay", type=float, default=0.3, help="przerwa między zapytaniami API (s)")
    args = parser.parse_args()

    years = ALL_YEARS.split(",")
    shares, stay_rows = procedure_shares(args.data_dir, args.fetch, args.delay)
    hk14 = catalog_points(args.data_dir / CATALOG_2026, "HK14")
    settlements = settled(args.data_dir)
    estimate = estimate_by_provider(args.data_dir, {year: hospitalizations for year, hospitalizations, *_ in shares})
    print(f"  szacunek {estimate['year']}: {estimate['hospitalizations']} (test {estimate['backtest']})", flush=True)
    providers, rows, one_day = monthly(args.data_dir, years)
    rows = apply_calibration(providers, rows, years, calibration(args.data_dir, years, estimate))
    clinic_info = clinics(args.data_dir, providers)
    thermolysis_info = thermolysis(args.data_dir)
    payload = {
        "version": 1,
        "jgp": GROUP,
        "product": PRODUCT,
        "years": years,
        "method": METHOD,
        "providers": providers,
        "rows": rows,
        "procedure": {
            "code": PROCEDURE,
            "source": "NFZ, API statystyk JGP (app-stat-api-jgp, v1.1), tabela „Procedury ICD 9 - Kody listy kierunkowej”",
            "fields": ["rok", "hospitalizacje_grupy", "hospitalizacje_z_procedura", "udzial_pct"],
            "years": shares,
        },
        "stays": {
            "source": "NFZ, API statystyk JGP: tabele „Pobyty w zakresach umów” i „Długość pobytu”",
            "fields": ["rok", "hospitalizacje", "zakres_jednego_dnia", "pobyt_0_dni", "pobyt_1_dzien"],
            "rows": stay_rows,
        },
        "estimate": estimate,
        "valuation2026": {"group": "HK14", "year": 2026, "source": CATALOG_2026_SOURCE, "points": hk14},
        "settled": {"fields": ["rok", "grupa", "zl", "punkty"], "rows": settlements},
        "clinics": clinic_info,
        "thermolysis": thermolysis_info,
        "oneDay": {
            "fields": ["swiadczeniodawca", "rok", "hospitalizacje", "zakres_jednego_dnia", "pobyt_0_dni"],
            "rows": [[key, year, round(v[0]), round(v[1]), round(v[2])] for (key, year), v in sorted(one_day.items()) if round(v[0]) > 0],
        },
    }
    size = write_json_gz(OUT, payload)
    total = sum(rows["hospitalizations"])
    print(f"zapisano {OUT.relative_to(ROOT)} ({size / 1024:.0f} KB): {len(providers)} świadczeniodawców, {total} hospitalizacji")


if __name__ == "__main__":
    main()
