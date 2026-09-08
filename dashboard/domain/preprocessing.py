from __future__ import annotations

import pandas as pd


def normalize_nip(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.replace(r"\.0$", "", regex=True)
        .str.replace(r"\D", "", regex=True)
        .str.zfill(10)
    )


def deduplicate_hospitals_by_nip(szpitale_df: pd.DataFrame) -> pd.DataFrame:
    required = {"NIP", "Świadczeniodawca", "Miejscowość"}
    missing = required.difference(szpitale_df.columns)
    if missing:
        raise ValueError(f"Brak wymaganych kolumn: {sorted(missing)}")
    work = szpitale_df.copy()
    work["NIP"] = normalize_nip(work["NIP"])
    work = work[work["NIP"].str.len().eq(10)].copy()
    work["Świadczeniodawca"] = work["Świadczeniodawca"].astype("string").str.title()
    core = (
        work[["Świadczeniodawca", "NIP", "Miejscowość"]]
        .drop_duplicates().groupby("NIP", as_index=False, sort=False).first()
    )
    optional = [c for c in ["Województwo", "Poziom PSZ", "Nazwa zakładu leczniczego"] if c in work.columns]
    if not optional:
        return core
    meta = work[["NIP", *optional]].drop_duplicates().groupby("NIP", as_index=False, sort=False).first()
    return core.merge(meta, on="NIP", how="left")


def combine_hospital_sources(psz_unique: pd.DataFrame, supplement: pd.DataFrame) -> pd.DataFrame:
    psz = psz_unique.copy(); supp = supplement.copy()
    psz["NIP"] = normalize_nip(psz["NIP"]); supp["NIP"] = normalize_nip(supp["NIP"])
    supp = supp[["NIP", "Świadczeniodawca", "Miejscowość"]].drop_duplicates("NIP", keep="first")
    combined = psz.merge(supp, on="NIP", how="outer", suffixes=("_psz", "_uzup"))
    combined["Świadczeniodawca"] = combined["Świadczeniodawca_uzup"].combine_first(combined["Świadczeniodawca_psz"])
    combined["Miejscowość"] = combined["Miejscowość_uzup"].combine_first(combined["Miejscowość_psz"])
    keep = ["NIP", "Świadczeniodawca", "Miejscowość"]
    if "Województwo" in combined.columns: keep.append("Województwo")
    return combined[keep].drop_duplicates("NIP", keep="first").reset_index(drop=True)
