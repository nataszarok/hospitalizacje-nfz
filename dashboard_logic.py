from __future__ import annotations

from collections.abc import Mapping, Sequence
import pandas as pd


def normalize_nip(series: pd.Series) -> pd.Series:
    """Normalize NIP values to 10 digits, preserving missing values as strings only when present."""
    return (
        series.astype("string")
        .str.replace(r"\.0$", "", regex=True)
        .str.replace(r"\D", "", regex=True)
        .str.zfill(10)
    )


def deduplicate_hospitals_by_nip(szpitale_df: pd.DataFrame) -> pd.DataFrame:
    """Return one hospital row per NIP, following the notebook's first-record rule."""
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
        .drop_duplicates()
        .groupby("NIP", as_index=False, sort=False)
        .first()
    )

    optional = [c for c in ["Województwo", "Poziom PSZ", "Nazwa zakładu leczniczego"] if c in work.columns]
    if not optional:
        return core

    meta = (
        work[["NIP", *optional]]
        .drop_duplicates()
        .groupby("NIP", as_index=False, sort=False)
        .first()
    )
    return core.merge(meta, on="NIP", how="left")


def combine_hospital_sources(psz_unique: pd.DataFrame, supplement: pd.DataFrame) -> pd.DataFrame:
    """Combine PSZ and supplement with supplement taking precedence; result is unique by NIP."""
    psz = psz_unique.copy()
    supp = supplement.copy()
    psz["NIP"] = normalize_nip(psz["NIP"])
    supp["NIP"] = normalize_nip(supp["NIP"])
    supp = supp[["NIP", "Świadczeniodawca", "Miejscowość"]].drop_duplicates("NIP", keep="first")

    combined = psz.merge(supp, on="NIP", how="outer", suffixes=("_psz", "_uzup"))
    combined["Świadczeniodawca"] = combined["Świadczeniodawca_uzup"].combine_first(
        combined["Świadczeniodawca_psz"]
    )
    combined["Miejscowość"] = combined["Miejscowość_uzup"].combine_first(combined["Miejscowość_psz"])

    keep = ["NIP", "Świadczeniodawca", "Miejscowość"]
    if "Województwo" in combined.columns:
        keep.append("Województwo")
    return combined[keep].drop_duplicates("NIP", keep="first").reset_index(drop=True)


def add_derived_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Add non-death hospitalizations and weighted mortality per aggregated row."""
    work = df.copy()
    work["hospitalizacje_bez_zgonu"] = work["hospitalizacje_ogolem"] - work["zgony"]
    denominator = work["hospitalizacje_ogolem"].astype(float)
    mortality = 100 * work["zgony"].astype(float).div(denominator.where(denominator.ne(0)))
    work["smiertelnosc_proc"] = mortality.fillna(0.0)
    return work



def count_facilities(df: pd.DataFrame) -> int:
    """Count facilities as unique (OW_NFZ, NIP_PODMIOTU) pairs.

    A single legal entity (NIP) may operate hospitals in more than one NFZ
    regional branch, so NIP alone undercounts physical/operational facilities.
    """
    required = {"OW_NFZ", "NIP_PODMIOTU"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Brak wymaganych kolumn: {sorted(missing)}")
    if df.empty:
        return 0
    work = df[["OW_NFZ", "NIP_PODMIOTU"]].copy()
    work["OW_NFZ"] = work["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    work["NIP_PODMIOTU"] = normalize_nip(work["NIP_PODMIOTU"])
    work = work.dropna(subset=["OW_NFZ", "NIP_PODMIOTU"])
    return int(work.drop_duplicates(["OW_NFZ", "NIP_PODMIOTU"]).shape[0])

def filter_by_min_facility_hospitalizations(df: pd.DataFrame, minimum: float) -> pd.DataFrame:
    """Keep whole facilities whose total hospitalizations meet the threshold.

    The facility key is (OW_NFZ, NIP_PODMIOTU). The threshold is evaluated after
    all currently selected substantive filters and across all selected products.
    If a facility qualifies, all of its product rows are retained.
    """
    if minimum <= 0 or df.empty:
        return df.copy()
    required = {"OW_NFZ", "NIP_PODMIOTU", "hospitalizacje_ogolem"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Brak wymaganych kolumn: {sorted(missing)}")

    work = df.copy()
    work["OW_NFZ"] = work["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    work["NIP_PODMIOTU"] = normalize_nip(work["NIP_PODMIOTU"])
    keys = ["OW_NFZ", "NIP_PODMIOTU"]
    totals = (
        work.groupby(keys, as_index=False, dropna=False)["hospitalizacje_ogolem"]
        .sum()
        .rename(columns={"hospitalizacje_ogolem": "_facility_hosp_total"})
    )
    qualifying = totals[totals["_facility_hosp_total"] >= float(minimum)][keys]
    return work.merge(qualifying, on=keys, how="inner")


def dataset_summary(df: pd.DataFrame) -> dict[str, float]:
    """Weighted top-level metrics for the currently supplied dataset."""
    if df.empty:
        return {"placowki": 0, "hospitalizacje": 0.0, "zgony": 0.0, "smiertelnosc": 0.0}
    total_hosp = float(df["hospitalizacje_ogolem"].sum())
    total_deaths = float(df["zgony"].sum()) if "zgony" in df.columns else 0.0
    return {
        "placowki": count_facilities(df),
        "hospitalizacje": total_hosp,
        "zgony": total_deaths,
        "smiertelnosc": 100 * total_deaths / total_hosp if total_hosp else 0.0,
    }


def area_stats(df: pd.DataFrame, area_column: str, area_values: Sequence[str], area_names: Mapping[str, str] | None = None) -> pd.DataFrame:
    """Weighted stats for whole selected areas, never an unweighted mean of facilities."""
    work = df.copy()
    if area_column == "OW_NFZ":
        work[area_column] = work[area_column].astype(str).str.zfill(2)
        normalized = [str(v).zfill(2) for v in area_values]
    else:
        work[area_column] = work[area_column].astype(str).str.strip()
        normalized = [str(v).strip() for v in area_values]

    rows: list[dict] = []
    for value in normalized:
        part = work[work[area_column] == value]
        if part.empty:
            continue
        total_hosp = float(part["hospitalizacje_ogolem"].sum())
        total_deaths = float(part["zgony"].sum())
        facilities = count_facilities(part)
        rows.append({
            area_column: value,
            "Nazwa obszaru": (area_names or {}).get(value, value),
            "Hospitalizacje": total_hosp,
            "Zgony": total_deaths,
            "Śmiertelność (%)": 100 * total_deaths / total_hosp if total_hosp else 0.0,
            "Hospitalizacje / placówkę": total_hosp / facilities if facilities else 0.0,
            "Liczba placówek": facilities,
        })
    return pd.DataFrame(rows)


def area_product_stats(
    df: pd.DataFrame,
    area_column: str,
    area_values: Sequence[str],
    product_labels: Mapping[str, str] | None = None,
    area_names: Mapping[str, str] | None = None,
) -> dict[str, list[dict]]:
    """Stats per selected area: total plus per-product rows when more than one product is present."""
    work = df.copy()
    if area_column == "OW_NFZ":
        work[area_column] = work[area_column].astype(str).str.zfill(2)
        normalized = [str(v).zfill(2) for v in area_values]
    else:
        work[area_column] = work[area_column].astype(str).str.strip()
        normalized = [str(v).strip() for v in area_values]

    result: dict[str, list[dict]] = {}

    def make_row(label: str, subset: pd.DataFrame, product_code: str | None = None) -> dict:
        total_hosp = float(subset["hospitalizacje_ogolem"].sum())
        total_deaths = float(subset["zgony"].sum())
        facilities = count_facilities(subset)
        return {
            "label": label,
            "product_code": product_code,
            "hospitalizacje": total_hosp,
            "zgony": total_deaths,
            "smiertelnosc": 100 * total_deaths / total_hosp if total_hosp else 0.0,
            "hospitalizacje_na_placowke": total_hosp / facilities if facilities else 0.0,
            "placowki": facilities,
        }

    for value in normalized:
        part = work[work[area_column] == value]
        if part.empty:
            continue
        name = (area_names or {}).get(value, value)
        rows = [make_row("Łącznie", part)]
        products = part["KOD_PRODUKTU_JEDNOSTKOWEGO"].dropna().astype(str).drop_duplicates().tolist()
        if len(products) > 1:
            for product in products:
                subset = part[part["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str) == product]
                rows.append(make_row((product_labels or {}).get(product, product), subset, product))
        result[name] = rows
    return result


def admission_facility_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate planned (6) and urgent (2+3) admissions to one row per facility.

    A facility is the pair (OW_NFZ, NIP_PODMIOTU). If multiple products are selected,
    they are summed together so the scatter still contains exactly one point per facility.
    """
    required = {
        "OW_NFZ", "NIP_PODMIOTU", "KOD_TRYBU_PRZYJECIA", "hospitalizacje_ogolem"
    }
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Brak wymaganych kolumn: {sorted(missing)}")

    base_cols = [
        "OW_NFZ", "NIP_PODMIOTU", "planowane", "nagle",
        "razem_planowane_nagle",
    ]
    meta_cols = [c for c in ["Świadczeniodawca", "Miejscowość"] if c in df.columns]
    if df.empty:
        return pd.DataFrame(columns=base_cols + meta_cols)

    work = df.copy()
    work["OW_NFZ"] = work["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    work["NIP_PODMIOTU"] = normalize_nip(work["NIP_PODMIOTU"])
    work["KOD_TRYBU_PRZYJECIA"] = pd.to_numeric(work["KOD_TRYBU_PRZYJECIA"], errors="coerce")
    work = work[work["KOD_TRYBU_PRZYJECIA"].isin([2, 3, 6])].copy()
    if work.empty:
        return pd.DataFrame(columns=base_cols + meta_cols)

    work["grupa_przyjec"] = work["KOD_TRYBU_PRZYJECIA"].map({6: "planowane", 2: "nagle", 3: "nagle"})
    keys = ["OW_NFZ", "NIP_PODMIOTU"]
    grouped = (
        work.groupby(keys + ["grupa_przyjec"], as_index=False, dropna=False)["hospitalizacje_ogolem"]
        .sum()
        .pivot(index=keys, columns="grupa_przyjec", values="hospitalizacje_ogolem")
        .fillna(0.0)
        .reset_index()
    )
    grouped.columns.name = None
    for col in ["planowane", "nagle"]:
        if col not in grouped.columns:
            grouped[col] = 0.0
    grouped["razem_planowane_nagle"] = grouped["planowane"] + grouped["nagle"]
    if meta_cols:
        meta = work[keys + meta_cols].drop_duplicates(keys, keep="first")
        grouped = grouped.merge(meta, on=keys, how="left")
    return grouped[base_cols + meta_cols]
