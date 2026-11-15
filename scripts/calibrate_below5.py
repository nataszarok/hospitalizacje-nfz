#!/usr/bin/env python3
"""Calibrate the "<5" values of the NFZ hospitalization file (method "cal", version v4).

The hospitalization file hides counts below 5: a row "<5" means 1-4 stays. Method "cal" estimates,
for every cell (NFZ branch + NIP + contract range + JGP product), how many stays and deaths the "<5"
rows hold, so that the national totals per JGP group match the NFZ JGP statistics API.

Inputs (data/, not in the repository):
  hospitalizacje_<rok>.csv               rows of the hospitalization file
  zestawienie_swiadczen_2019_2026.csv    points and patients per provider x contract range x product
  wyceny/wyceny_jgp_<rok>.csv            JGP valuations in force that year (scripts/build_valuation_history.py)
  nfz_jgp_stats/tabele/<rok>/<PRODUKT>.json     API: stays, patients, stays per contract range, deaths, LOS histogram
                                         (scripts/fetch_jgp_stats.py)
Used by scripts/build_hospitalizations.py: for every year with the inputs above it calibrates the cells and writes
columns hCal/dCal next to min and sim (summary in public/data/hospitalizations/index.json, key "calibration").
Run alone, this script only prints the report (groups vs API) for the given years.

Method (details: docs/kalibracja/kalibracja-schemat-decyzji.html, sections 2-7, tab v4):
  1. cell bounds from the file: lo = explicit stays + "<5" rows, hi = explicit + 4 x "<5" rows;
     patients "<5" in the settlements cap the cell at floor(4 x settlement rows x stays/patients) (hi2);
  2. U = mean points of one stay from the length of stay of the cell rows, with extra-day points
     (osobodni) averaged over the API histogram of days;
  3. method A (stays/patients < 1.05): explicit patients x ratio, otherwise points / U in the window
     0.97-1.32 nearest the range median; method B: points / (U x c) with c chosen per contract range so
     that the range matches the API (bisection);
  4. fitting to the API per contract range and for the whole group never goes below max(lo, explicit
     patients); only when the group cannot hold its patients within the API total it goes down to lo;
  5. extra deaths (API minus deaths already known) go to cells with "<5" death rows; extra stays that the
     cell's "<5" rows without death cannot hold (max 3 extra per row) are deaths in any case.

Usage:
  python3 scripts/calibrate_below5.py --years 2022,2023,2024     # report only
"""
from __future__ import annotations

import argparse
import glob
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from build_hospitalizations import ROOT, load_provider_codes, normalize_duration, normalize_nip, read_source_chunks, source_path

SETTLEMENTS_FILE = "zestawienie_swiadczen_2019_2026.csv"
KEY = ["ow", "nip", "kk"]
METHOD_A_RATIO = 1.05            # iloraz pobytów do pacjentów, poniżej którego liczymy z pacjentów
WINDOW = (0.97, 1.32)            # okno punkty ÷ (U × n) w metodzie A dla pacjentów „<5”
LOS_DAYS = {"0 dni": (0, 0), "1-2 dni": (1, 2), "3-5 dni": (3, 5), "6 i więcej dni": (6, 10**6)}
VALUATION_COLS = ["pkt_hospitalizacja", "pkt_ponizej_3_dni", "pkt_0_dni", "pkt_1_dzien", "pkt_2_dni"]
norm = lambda s: re.sub(r"\s+", " ", str(s)).strip().upper()


# ---------- dane wejściowe ----------

def read_hospital_cells(path: Path, year: str) -> pd.DataFrame:
    """Plik hospitalizacji zsumowany do komórki × długość pobytu × zgon: k = pobyty jawne, sup = wiersze „<5”."""
    parts = []
    for chunk in read_source_chunks(path, year):
        s = lambda c: chunk[c].str.strip()
        raw = s("LICZBA_HOSPITALIZACJI")
        frame = pd.DataFrame({
            "ow": s("OW_NFZ").str.zfill(2), "nip": normalize_nip(chunk["NIP_PODMIOTU"]), "kk": s("KOD_PRODUKTU_KONTRAKTOWEGO"),
            "pj": s("KOD_PRODUKTU_JEDNOSTKOWEGO"), "los": chunk["PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"].map(normalize_duration),
            "death": s("KOD_TRYBU_WYPISU").eq("9"), "sup": raw.eq("<5").astype(int), "k": pd.to_numeric(raw, errors="coerce").fillna(0).astype(int),
        })
        parts.append(frame.groupby(["ow", "nip", "kk", "pj", "los", "death"])[["k", "sup"]].sum())
    return pd.concat(parts).groupby(level=list(range(6))).sum().reset_index()


_SETTLEMENTS: dict[Path, pd.DataFrame] = {}


def settlement_rows(data_dir: Path) -> pd.DataFrame:
    """Cały plik zestawienia (czytany raz na proces; build liczy kilka lat po kolei)."""
    path = data_dir / SETTLEMENTS_FILE
    if path not in _SETTLEMENTS:
        _SETTLEMENTS[path] = pd.read_csv(path, sep=";", dtype=str, keep_default_na=False)
    return _SETTLEMENTS[path]


def inputs_available(data_dir: Path, year: str) -> bool:
    """Czy rok ma wszystkie dane do kalibracji: tabele API, wyceny i wiersze zestawienia."""
    tables = data_dir / "nfz_jgp_stats" / "tabele" / year
    if not (tables.is_dir() and any(tables.glob("*.json")) and (data_dir / "wyceny" / f"wyceny_jgp_{year}.csv").exists()
            and (data_dir / SETTLEMENTS_FILE).exists()):
        return False
    return bool((settlement_rows(data_dir).Rok.str.strip() == year).any())


def read_settlements(data_dir: Path, year: str) -> tuple[pd.DataFrame, dict[str, str]]:
    """Zestawienie świadczeń roku: punkty, pacjenci (NaN = „<5”) i liczba wierszy na komórkę; nazwy zakresów."""
    z = settlement_rows(data_dir)
    z = z[z.Rok.str.strip() == year].copy()
    z["ow"] = z.Oddzial_wojewodzki_NFZ.str.zfill(2)
    z["nip"] = (z.ow + "|" + z.Kod_swiadczeniodawcy.str.strip()).map(load_provider_codes(data_dir, year))
    z["kk"] = z.Kod_zakresu.str.strip(); z["pj"] = z.Kod_produktu_jednostkowego.str.strip()
    z["pts"] = pd.to_numeric(z.Liczba_jednostek_rozliczonych.str.replace(",", "."), errors="coerce")
    z["pat"] = pd.to_numeric(z.Liczba_pacjentow, errors="coerce")
    names = z.drop_duplicates("kk").set_index("kk").Nazwa_zakresu.map(norm).to_dict()
    cells = z.groupby(KEY + ["pj"]).agg(rows=("pts", "size"), pts=("pts", "sum"), pat=("pat", "sum"),
                                        patsup=("pat", lambda s: s.isna().sum())).reset_index()
    return cells, names


def read_valuations(data_dir: Path, year: str) -> pd.DataFrame:
    """Wycena produktu w roku: średnia wersji katalogu ważona liczbą miesięcy obowiązywania."""
    w = pd.read_csv(data_dir / "wyceny" / f"wyceny_jgp_{year}.csv", dtype={"kod_produktu": str})
    def wavg(d: pd.DataFrame) -> pd.Series:
        months = d.miesiace.sum(); out = {}
        for c in VALUATION_COLS:
            if d[c].notna().any(): out[c] = (d[c].fillna(d.pkt_hospitalizacja) * d.miesiace).sum() / months
        for c in ["dni_finansowane", "pkt_osobodzien"]:
            m = d[c].notna()
            if m.any(): out[c] = (d.loc[m, c] * d.loc[m, "miesiace"]).sum() / d.loc[m, "miesiace"].sum()
        return pd.Series(out)
    return w.groupby("kod_produktu").apply(wavg)


def read_api(data_dir: Path, year: str) -> dict[str, dict]:
    api = {}
    for fn in glob.glob(str(data_dir / "nfz_jgp_stats" / "tabele" / year / "*.json")):
        j = json.load(open(fn, encoding="utf-8"))
        if not (j.get("available") and j.get("general")): continue
        g = [r for r in j["general"] if r.get("branch") is None]
        if not g: continue
        ranges: dict[str, int] = {}
        for s in j.get("service") or []:
            if s.get("branch") is None:
                ranges[norm(s["contract-product-name"])] = ranges.get(norm(s["contract-product-name"]), 0) + s["number-of-hospitalizations"]
        hist: dict[int, int] = {}
        for h in j.get("histogram") or []:
            if h.get("branch") is None and h.get("contract-product-code") is None:
                for p in h["points"]: hist[int(p["x"])] = hist.get(int(p["x"]), 0) + p["y"]
        api[j["code"]] = dict(N=g[0]["number-of-hospitalizations"], P=g[0]["number-of-patients"], Z=ranges, H=hist,
                              D=sum(r["number-of-hospitalizations"] for r in (j.get("discharge") or []) if r["type-of-discharge-code"] == 9))
    return api


# ---------- pomocnicze ----------

def stay_points(v: pd.Series, hist: dict[int, int], los: pd.Series) -> np.ndarray:
    """Średnie punkty jednego pobytu w wierszu według długości pobytu.

    Bez histogramu: wycena 0 dni, średnia 1 i 2 dni albo ryczałt (jak v2). Z histogramem dni API: średnia
    wycena dni z przedziału, a ponad dni finansowane ryczałtem doliczamy osobodnie.
    """
    base = v.pkt_hospitalizacja
    unit = np.full(len(los), base)
    p3 = v.get("pkt_ponizej_3_dni")
    if p3 is not None and pd.notna(p3): unit = np.where(los.isin(["0 dni", "1-2 dni"]), p3, unit)
    p0 = v.get("pkt_0_dni")
    if p0 is not None and pd.notna(p0): unit = np.where(los.eq("0 dni"), p0, unit)
    p1, p2 = v.get("pkt_1_dzien"), v.get("pkt_2_dni")
    if p1 is not None and p2 is not None and pd.notna(p1) and pd.notna(p2): unit = np.where(los.eq("1-2 dni"), (p1 + p2) / 2, unit)
    if not hist: return unit
    p3 = p3 if p3 is not None and pd.notna(p3) else base
    fin, extra = v.get("dni_finansowane"), v.get("pkt_osobodzien")
    def day(d: int) -> float:
        if d < 3:
            own = [p0, p1, p2][d]
            return own if own is not None and pd.notna(own) else p3
        return base + (extra * max(0, d - fin) if fin is not None and extra is not None and pd.notna(fin) and pd.notna(extra) else 0)
    mean = {}
    for label, (a, b) in LOS_DAYS.items():
        days = [(d, c) for d, c in hist.items() if a <= d <= b and c > 0]
        if days: mean[label] = sum(day(d) * c for d, c in days) / sum(c for _, c in days)
    return np.array([mean.get(l, u) for l, u in zip(los, unit)])


def fit_bounded(start, lo, lb, hi, target) -> np.ndarray:
    """Liczby całkowite w [lb, hi] o sumie target; nadwyżka ponad lo skalowana proporcjonalnie, reszty po kolei.

    Gdy target < suma lb, zwraca lb (o zejściu niżej decyduje wywołujący).
    """
    start, lo, lb = (np.asarray(x, float) for x in (start, lo, lb)); hi = np.maximum(np.asarray(hi, float), lb)
    if target <= lb.sum(): return lb.astype(int)
    if target >= hi.sum(): return hi.astype(int)
    E = start - lo
    if E.sum() == 0: E = hi - lo
    E = E + 1e-9 * (hi - lo)   # komórki bez nadwyżki też rosną, gdy inne są już na hi
    g = lambda k: np.clip(lo + E * k, lb, hi)
    a, z = 0.0, 1.0
    while g(z).sum() < target: z *= 2
    for _ in range(80):
        m = (a + z) / 2
        if g(m).sum() < target: a = m
        else: z = m
    v = g(z); base = np.floor(v); rest = int(round(target - base.sum()))
    if rest > 0:
        for i in np.argsort(-(v - base)):
            if rest <= 0: break
            if base[i] < hi[i]: base[i] += 1; rest -= 1
    elif rest < 0:
        for i in np.argsort(v - base):
            if rest >= 0: break
            if base[i] > lb[i]: base[i] -= 1; rest += 1
    return base.astype(int)


def fit_excess(start, lo, hi, target) -> np.ndarray:
    """Jak fit_bounded z lb = lo (metoda v2); ostatni krok, gdy grupa nie mieści pacjentów w sumie z API."""
    start, lo, hi = (np.asarray(x, float) for x in (start, lo, hi))
    tE = target - lo.sum(); cap = hi - lo; E = start - lo
    if tE <= 0: return lo.astype(int)
    if tE >= cap.sum(): return hi.astype(int)
    if E.sum() == 0: E = cap.copy()
    sh = np.minimum(E * tE / E.sum(), cap); base = np.floor(sh); rest = int(round(tE - base.sum()))
    order = np.argsort(-(sh - base))
    while rest > 0:
        moved = False
        for i in order:
            if rest <= 0: break
            if base[i] < cap[i]: base[i] += 1; rest -= 1; moved = True
        if not moved: break
    return (lo + base).astype(int)


def bisect(f, target: float) -> float:
    """Najmniejszy współczynnik c (0,05–20), przy którym suma f(c) nie przekracza target (f maleje z c)."""
    a, z = 0.05, 20.0
    for _ in range(60):
        m = (a + z) / 2
        if f(m).sum() > target: a = m
        else: z = m
    return z


# ---------- kalibracja jednej grupy ----------

def min_cells(x: pd.DataFrame) -> pd.DataFrame:
    """Komórki bez kalibracji (brak API, wyceny albo zestawienia): metoda min, 1 pobyt na wiersz „<5”."""
    x = x.assign(n0=x.k + x.sup)
    c = x.groupby(KEY).agg(N=("n0", "sum")).reset_index()
    d = x[x.death].groupby(KEY).n0.sum().rename("D")
    c = c.merge(d, on=KEY, how="left").fillna({"D": 0})
    return c.assign(lo=c.N)


def calibrate_group(pj: str, x: pd.DataFrame, a: dict, v: pd.Series, settlements: pd.DataFrame | None, names: dict[str, str]):
    """Zwraca (komórki z N i D, raport grupy)."""
    ratio = a["N"] / a["P"] if a["P"] else 1.0
    x = x.assign(unit=stay_points(v, a["H"], x.los))
    x = x.assign(n0=x.k + x.sup, wn=x.unit * (x.k + x.sup))
    c = x.groupby(KEY).agg(k=("k", "sum"), sup=("sup", "sum"), wn=("wn", "sum"), n0=("n0", "sum")).reset_index()
    c["U"] = c.wn / c.n0; c["lo"] = c.k + c.sup; c["hi"] = c.k + 4 * c.sup; c["zak"] = c.kk.map(names).fillna("?")
    if settlements is None:
        return min_cells(x), {"status": "brak zestawienia"}
    c = c.merge(settlements, on=KEY, how="outer", indicator=True)
    unm = c[c._merge == "left_only"]; b = c[c._merge == "both"].copy().reset_index(drop=True)
    if len(b) == 0:
        return min_cells(x), {"status": "brak par"}
    kn = ((b.patsup == 0) & (b.pat >= 5)).values; fp = np.where(kn, b.pat, 0)
    cap = np.where(b.patsup > 0, np.maximum(np.floor(4 * b.rows * ratio), b.lo), b.hi)
    b["hi2"] = np.minimum(b.hi, cap).astype(int); b["lo"] = b.lo.astype(int)
    LB = np.maximum(b.lo.values, np.minimum(fp, b.hi.values)).astype(int)
    b["zg"] = np.where(b.zak.isin(a["Z"].keys()), b.zak, "__reszta__")
    unm_zg = np.where(unm.zak.isin(a["Z"].keys()), unm.zak, "__reszta__")
    tgt = {z: a["Z"][z] for z in b.zg.unique() if z != "__reszta__"}
    if "__reszta__" in set(b.zg): tgt["__reszta__"] = a["N"] - sum(a["Z"].values())
    for z in tgt: tgt[z] -= int(unm.lo[unm_zg == z].sum())
    groups = b.groupby("zg").groups

    if ratio < METHOD_A_RATIO:
        method = "A"
        q = (b.pts / (b.U * b.pat * ratio))[kn]; cz = q.groupby(b.kk[kn]).median(); gmed = float(np.nanmedian(q)) if len(q) else 1.0
        coef = b.kk.map(cz).fillna(gmed).values; N0 = np.empty(len(b), dtype=np.int64)
        for i in range(len(b)):
            lo, hi = int(b.lo[i]), int(b.hi2[i])
            if kn[i]: N0[i] = min(max(int(np.floor(b.pat[i] * ratio)), lo), int(b.hi[i])); continue
            ns = np.arange(lo, hi + 1); qq = b.pts[i] / (b.U[i] * ns); ok = (qq >= WINDOW[0]) & (qq <= WINDOW[1])
            N0[i] = ns[ok][np.argmin(np.abs(qq[ok] - coef[i]))] if ok.any() else int(np.clip(np.floor(b.pts[i] / (b.U[i] * coef[i])), lo, hi))
        N = N0.copy()
        for z, idx in groups.items():
            idx = np.asarray(idx); N[idx] = fit_bounded(N0[idx], b.lo.values[idx], LB[idx], np.maximum(b.hi2.values[idx], N0[idx]), tgt[z])
    else:
        method = "B"
        N = np.zeros(len(b), dtype=np.int64)
        for z, idx in groups.items():
            idx = np.asarray(idx); bb = b.iloc[idx]; fpz = fp[idx]
            f = lambda cf: np.clip(np.maximum(np.floor(bb.pts / (bb.U * cf)), fpz), bb.lo, bb.hi2)
            N[idx] = f(bisect(f, tgt[z])).astype(np.int64)
            N[idx] = fit_bounded(N[idx], bb.lo.values, LB[idx], np.maximum(bb.hi2.values, N[idx]), tgt[z])
    # Domknięcie grupy: brak z jednego zakresu biorą komórki innych zakresów z zapasem ponad pacjentów.
    total = a["N"] - int(unm.lo.sum())
    below_patients = False
    if N.sum() != total: N = fit_bounded(N, b.lo.values, LB, np.maximum(b.hi2.values, N), total)
    if N.sum() != total:   # grupa nie mieści pacjentów w sumie z API: schodzimy do lo
        N = fit_excess(N, b.lo.values, np.maximum(b.hi2.values, N), total); below_patients = True
    b["N"] = N; b["E"] = N - b.lo

    # Zgony: brakujące zgony do API dzielimy na komórki z wierszami „<5” ze zgonem (najwyżej 3 na wiersz).
    xd = x[x.death].groupby(KEY).agg(kd=("k", "sum"), md=("sup", "sum")).reset_index()
    b = b.merge(xd, on=KEY, how="left").fillna({"kd": 0, "md": 0})
    d_unm = int(x[x.death].merge(unm[KEY], on=KEY).n0.sum()) if len(unm) else 0
    X = a["D"] - int(b.kd.sum() + b.md.sum()) - d_unm
    capd = np.minimum(3 * b.md, b.E).astype(int); want = (b.md * np.where(b.sup > 0, b.E / b.sup.clip(lower=1), 0)).values
    # Zgony wymuszone: nadwyżka, której wiersze „<5” bez zgonu nie pomieszczą (najwyżej 3 dodatkowe na wiersz), to zgony.
    forced = np.maximum(b.E.values - 3 * (b.sup.values - b.md.values), 0).astype(int)
    alloc = forced.copy(); X -= int(forced.sum()); capd = capd - forced
    if X > 0 and want.sum() > 0:
        share = want / want.sum() * X; add = np.minimum(np.floor(share), capd).astype(int); alloc = alloc + add; rest = X - add.sum()
        for i in np.argsort(-(share - np.floor(share))):
            if rest <= 0: break
            if alloc[i] - forced[i] < capd[i]: alloc[i] += 1; rest -= 1
        if rest > 0:
            free = capd - (alloc - forced)
            for i in np.argsort(-free):
                if rest <= 0 or free[i] <= 0: break
                t = min(rest, free[i]); alloc[i] += t; rest -= t
    b["D"] = (b.kd + b.md + alloc).astype(int)
    xu = x[x.death].groupby(KEY).n0.sum().rename("D")
    unm = unm.drop(columns=[col for col in ["D"] if col in unm]).merge(xu, on=KEY, how="left").fillna({"D": 0})
    out = pd.concat([b[KEY + ["N", "D", "lo"]], unm[KEY + ["lo", "D"]].assign(N=unm.lo)], ignore_index=True)
    report = {"status": "ok", "metoda": method, "iloraz": round(ratio, 4), "N_api": a["N"], "N_cal": int(out.N.sum()),
              "D_api": a["D"], "D_cal": int(out.D.sum()), "ponizej_pacjentow": int((kn & (N < b.pat.values)).sum()),
              "grupa_ponizej_pacjentow": below_patients}
    return out, report


def calibrate_year(data_dir: Path, year: str, source: Path | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Komórki roku (lo = hMin, N = hCal, dMin, D = dCal, rows, rowsDeath) i raport grup."""
    hosp = read_hospital_cells(source or source_path(data_dir, year), year)
    settlements, names = read_settlements(data_dir, year)
    by_product = {pj: d.drop(columns="pj") for pj, d in settlements.groupby("pj")}
    valuations = read_valuations(data_dir, year)
    api = read_api(data_dir, year)
    cells, reports = [], []
    for pj, x in hosp.groupby("pj", sort=True):
        a = api.get(pj)
        if a is None or pj not in valuations.index:
            c = min_cells(x)
            cells.append(c.assign(pj=pj)); reports.append({"pj": pj, "status": "brak API" if a is None else "brak wyceny", "N_cal": int(c.N.sum())})
            continue
        out, rep = calibrate_group(pj, x, a, valuations.loc[pj], by_product.get(pj), names)
        cells.append(out.assign(pj=pj)); reports.append({"pj": pj, **rep})
    # Dane komórki z pliku do podziału wyniku na wiersze (build_hospitalizations.py): wiersze „<5” i zgony metodą min.
    base = hosp.assign(kd=np.where(hosp.death, hosp.k, 0), md=np.where(hosp.death, hosp.sup, 0)) \
        .groupby(KEY + ["pj"]).agg(rows=("sup", "sum"), rowsDeath=("md", "sum"), kd=("kd", "sum")).reset_index()
    cells = pd.concat(cells, ignore_index=True).merge(base, on=KEY + ["pj"], how="left", validate="one_to_one")
    cells["dMin"] = cells.kd + cells.rowsDeath
    return cells, pd.DataFrame(reports)


def summarize(cells: pd.DataFrame, report: pd.DataFrame, year: str) -> dict:
    """Podsumowanie roku do index.json (strona metody); sumy komórek tylko w grupach z API."""
    ok = report[report.status == "ok"]
    c = cells[cells.pj.isin(set(ok.pj))]
    as_int = lambda v: int(round(float(v)))
    return {
        "year": year, "method": "cal-v4", "cells": int(len(cells)), "groups": int(len(ok)),
        "groupsA": int((ok.metoda == "A").sum()), "groupsB": int((ok.metoda == "B").sum()),
        "groupsWithoutApi": int(len(report) - len(ok)),
        "staysMin": as_int(c.lo.sum()), "staysCal": as_int(c.N.sum()), "staysApi": as_int(ok.N_api.sum()),
        "deathsMin": as_int(c.dMin.sum()), "deathsCal": as_int(c.D.sum()), "deathsApi": as_int(ok.D_api.sum()),
        "groupsStaysEqualApi": int((ok.N_cal == ok.N_api).sum()), "groupsDeathsEqualApi": int((ok.D_cal == ok.D_api).sum()),
        "cellsBelowPatients": int(ok.ponizej_pacjentow.sum()), "groupsBelowPatients": int(ok.grupa_ponizej_pacjentow.astype(bool).sum()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2024", help="lata po przecinku")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    args = parser.parse_args()
    for year in [y.strip() for y in args.years.split(",") if y.strip()]:
        if not inputs_available(args.data_dir, year):
            print(f"{year}: brak danych do kalibracji (tabele API, wyceny albo zestawienie)"); continue
        cells, report = calibrate_year(args.data_dir, year)
        ok = report[report.status == "ok"]
        bad = ok[(ok.N_cal != ok.N_api) | (ok.D_cal != ok.D_api)]
        print(json.dumps(summarize(cells, report, year), ensure_ascii=False))
        if len(bad): print("  grupy różne od API:", bad[["pj", "N_api", "N_cal", "D_api", "D_cal"]].to_dict("records"))


if __name__ == "__main__":
    main()
