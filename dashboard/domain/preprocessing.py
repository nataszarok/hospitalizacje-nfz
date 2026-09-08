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

NFZ_PROVIDER_COLUMNS = [
    "nip", "swiadczeniodawca", "miejscowosc", "kod", "regon",
    "kod_pocztowy", "ulica", "gmina", "oddzial_nfz", "telefon",
]


def prepare_nfz_providers(
    raw: pd.DataFrame,
    manual_rows: list[dict[str, str]] | None = None,
    branch_overrides: dict[str, str] | None = None,
) -> pd.DataFrame:
    """Prepare a 1:1 NFZ provider dictionary keyed by (oddzial_nfz, nip).

    Source duplicates are intentionally collapsed with keep='last' after
    branch corrections and optional manual supplementation. The dashboard
    therefore has exactly one metadata row for every analytical facility key.
    """
    missing = [column for column in NFZ_PROVIDER_COLUMNS if column not in raw.columns]
    if missing:
        raise ValueError(f"Brak wymaganych kolumn NFZ: {missing}")

    work = raw[NFZ_PROVIDER_COLUMNS].copy()
    work["nip"] = normalize_nip(work["nip"])
    work["oddzial_nfz"] = (
        work["oddzial_nfz"].astype("string")
        .str.replace(r"\.0$", "", regex=True)
        .str.replace(r"\D", "", regex=True)
        .str.zfill(2)
    )
    for column in NFZ_PROVIDER_COLUMNS:
        work[column] = work[column].astype("string").str.strip()

    work = work[work["nip"].str.fullmatch(r"\d{10}", na=False)].copy()
    work = work[work["oddzial_nfz"].str.fullmatch(r"\d{2}", na=False)].copy()

    for nip, corrected_branch in (branch_overrides or {}).items():
        work.loc[work["nip"].eq(str(nip)), "oddzial_nfz"] = str(corrected_branch).zfill(2)

    if manual_rows:
        manual = pd.DataFrame(manual_rows, columns=NFZ_PROVIDER_COLUMNS, dtype="string")
        manual["nip"] = normalize_nip(manual["nip"])
        manual["oddzial_nfz"] = manual["oddzial_nfz"].astype("string").str.zfill(2)
        work = pd.concat([work, manual], ignore_index=True)

    work = work.drop_duplicates(["oddzial_nfz", "nip"], keep="last").reset_index(drop=True)
    work[NFZ_PROVIDER_COLUMNS] = work[NFZ_PROVIDER_COLUMNS].fillna("")

    if work.duplicated(["oddzial_nfz", "nip"]).any():
        raise RuntimeError("Deduplikacja NFZ po (oddzial_nfz, nip) nie powiodła się")
    return work
