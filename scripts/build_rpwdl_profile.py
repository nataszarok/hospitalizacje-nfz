#!/usr/bin/env python3
"""
Buduje public/data/rpwdl_profile.json.gz z eksportu RPWDL.

Założenia agregacji:
- tylko aktywne rekordy (bez daty zakończenia działalności),
- komórki są deduplikowane po znormalizowanej parze:
  (Nazwa komórki, Specjalność komórki),
- liczba komórek/oddziałów/poradni liczona jest po deduplikacji,
- łóżka są sumowane po deduplikowanych komórkach,
- OIT jest sumowane WYŁĄCZNIE z pola
  "Liczba łóżek intensywnej terapii".
  Jeżeli RPWDL podaje 0, wynik pozostaje 0 — bez inferencji z nazwy oddziału
  ani z pola "Liczba łóżek ogółem".
"""

import argparse, gzip, json, re, zipfile
from collections import defaultdict
import pandas as pd

def clean(v):
    if pd.isna(v): return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None

def n(v):
    try:
        if pd.isna(v) or str(v).strip() == "": return 0
        return int(float(str(v).replace(",", ".")))
    except Exception:
        return 0

def norm(v):
    s = (clean(v) or "").lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s

def active(df, end_col):
    return df[df[end_col].isna() | (df[end_col].astype(str).str.strip() == "")]

def dedup_cells(items):
    # Przy duplikacie zachowujemy rekord z większą liczbą łóżek.
    by_key = {}
    for x in items:
        key = (norm(x["nazwa"]), norm(x["specjalnosc"]))
        old = by_key.get(key)
        if old is None or x["lozka"] > old["lozka"]:
            by_key[key] = x
    return sorted(by_key.values(), key=lambda x: (x["nazwa"] or "").lower())

def is_ward(x):
    t = f'{x["nazwa"]} {x["specjalnosc"]}'.lower()
    return "oddział" in t or "pododdział" in t or "pododział" in t

def is_clinic(x):
    t = f'{x["nazwa"]} {x["specjalnosc"]}'.lower()
    return "poradni" in t

def is_icu(x):
    t = f'{x["nazwa"]} {x["specjalnosc"]}'.lower()
    return (
        "intensywnej terapii" in t
        or "intensywna terapia" in t
        or x.get("kod") == "4260"
    )

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source_zip", help="ZIP z katalogiem rpwdl/*.csv")
    ap.add_argument("-o", "--output", default="public/data/rpwdl_profile.json.gz")
    args = ap.parse_args()

    z = zipfile.ZipFile(args.source_zip)

    pod_cols = ["ID Księgi","NIP","REGON","Numer księgi rejestrowej","Nazwa",
                "Nazwa podmiotu","Miejscowość","Ulica","Budynek","Lokal",
                "Kod pocztowy","Telefon","Email","Strona WWW",
                "Forma organizacyjno-prawna opis","Nazwa podmiotu tworzącego"]
    pod = pd.read_csv(z.open("rpwdl/podmioty.csv"), sep=";", dtype=str,
                      usecols=pod_cols, low_memory=False)

    meta = {}
    for _, r in pod.iterrows():
        nip = clean(r["NIP"])
        kid = clean(r["ID Księgi"])
        if not nip or not kid: continue
        meta[kid] = {
            "nip": re.sub(r"\D", "", nip),
            "regon": clean(r["REGON"]),
            "nr_ksiegi": clean(r["Numer księgi rejestrowej"]),
            "nazwa_podmiotu": clean(r["Nazwa"]) or clean(r["Nazwa podmiotu"]),
            "miejscowosc": clean(r["Miejscowość"]),
            "adres": " ".join(x for x in [clean(r["Ulica"]), clean(r["Budynek"]), clean(r["Lokal"])] if x),
            "kod_pocztowy": clean(r["Kod pocztowy"]),
            "telefon": clean(r["Telefon"]),
            "email": clean(r["Email"]),
            "www": clean(r["Strona WWW"]),
            "forma": clean(r["Forma organizacyjno-prawna opis"]),
            "podmiot_tworzacy": clean(r["Nazwa podmiotu tworzącego"]),
        }

    # Aktywne zakłady / jednostki — deduplikowane po nazwie.
    zaklady = defaultdict(set)
    for ch in pd.read_csv(z.open("rpwdl/zaklady.csv"), sep=";", dtype=str,
                          usecols=["ID Księgi","Nazwa","Data zakończenia działalności"],
                          chunksize=50000, low_memory=False):
        ch = active(ch, "Data zakończenia działalności")
        for _, r in ch.iterrows():
            k = clean(r["ID Księgi"])
            if k in meta: zaklady[k].add(norm(r["Nazwa"]))

    jednostki = defaultdict(set)
    for ch in pd.read_csv(z.open("rpwdl/jednostki.csv"), sep=";", dtype=str,
                          usecols=["ID Księgi","Nazwa","Data zakończenia działalności JO"],
                          chunksize=50000, low_memory=False):
        ch = active(ch, "Data zakończenia działalności JO")
        for _, r in ch.iterrows():
            k = clean(r["ID Księgi"])
            if k in meta: jednostki[k].add(norm(r["Nazwa"]))

    cols = ["ID Księgi","Nazwa komórki","Specjalność komórki","kodResortVIII",
            "Data zakończenia działalności komórki","Liczba łóżek ogółem",
            "Liczba łóżek intensywnej terapii","Liczba łóżek dla noworodków",
            "Liczba inkubatorów","Liczba stanowisk dializacyjnych",
            "Liczba miejsc pobytu dziennego"]
    raw = defaultdict(list)

    for ch in pd.read_csv(z.open("rpwdl/komorki.csv"), sep=";", dtype=str,
                          usecols=cols, chunksize=100000, low_memory=False):
        ch = active(ch, "Data zakończenia działalności komórki")
        for _, r in ch.iterrows():
            k = clean(r["ID Księgi"])
            if k not in meta: continue
            raw[k].append({
                "nazwa": clean(r["Nazwa komórki"]) or "",
                "specjalnosc": clean(r["Specjalność komórki"]) or "",
                "kod": clean(r["kodResortVIII"]),
                "lozka": n(r["Liczba łóżek ogółem"]),
                "lozka_it_pole": n(r["Liczba łóżek intensywnej terapii"]),
                "lozka_noworodkowe": n(r["Liczba łóżek dla noworodków"]),
                "inkubatory": n(r["Liczba inkubatorów"]),
                "dializy": n(r["Liczba stanowisk dializacyjnych"]),
                "pobyt_dzienny": n(r["Liczba miejsc pobytu dziennego"]),
            })

    by_nip = {}
    for k, m in meta.items():
        cells = dedup_cells(raw.get(k, []))
        wards = [x for x in cells if is_ward(x)]
        clinics = [x for x in cells if is_clinic(x)]
        lozka_oit = sum(x["lozka_it_pole"] for x in cells)

        rec = {
            **m,
            "liczba_zakladow": len([x for x in zaklady.get(k, set()) if x]),
            "liczba_jednostek": len([x for x in jednostki.get(k, set()) if x]),
            "liczba_komorek": len(cells),
            "liczba_oddzialow": len(wards),
            "liczba_poradni": len(clinics),
            "liczba_innych_komorek": max(0, len(cells) - len(wards) - len(clinics)),
            "lozka_ogolem": sum(x["lozka"] for x in cells),
            "lozka_intensywnej_terapii": lozka_oit,
            "lozka_noworodkowe": sum(x["lozka_noworodkowe"] for x in cells),
            "inkubatory": sum(x["inkubatory"] for x in cells),
            "stanowiska_dializacyjne": sum(x["dializy"] for x in cells),
            "miejsca_pobytu_dziennego": sum(x["pobyt_dzienny"] for x in cells),
            "liczba_dziedzin": 0,
            "dziedziny": [],
            "liczba_akredytacji_jakosci": 0,
            "liczba_akredytacji_ksztalcenia": 0,
            "liczba_kontroli": 0,
            "oddzialy": [{"nazwa":x["nazwa"],"specjalnosc":x["specjalnosc"],"kod":x["kod"],"lozka":x["lozka"]} for x in wards],
            "poradnie": [{"nazwa":x["nazwa"],"specjalnosc":x["specjalnosc"],"kod":x["kod"],"lozka":x["lozka"]} for x in clinics],
        }
        nip = m["nip"]
        if nip and (nip not in by_nip or rec["liczba_komorek"] > by_nip[nip]["liczba_komorek"]):
            by_nip[nip] = rec

    payload = {
        "wersja": 2,
        "zrodlo": "RPWDL — aktywne rekordy, deduplikacja komórek po nazwie+specjalności",
        "po_nip": by_nip,
    }
    with gzip.open(args.output, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Zapisano {len(by_nip)} profili -> {args.output}")

if __name__ == "__main__":
    main()
