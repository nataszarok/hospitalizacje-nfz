from __future__ import annotations

from collections.abc import Mapping
import pandas as pd

RATE_SCALE = 100_000


def add_population_rates(
    df: pd.DataFrame,
    population_by_ow: Mapping[str, int],
    rate_columns: Mapping[str, str],
) -> pd.DataFrame:
    """Add voivodeship population and one or more per-100k rate columns.

    ``rate_columns`` maps a numerator column to the output rate column. The
    denominator is always population of the facility's OW NFZ voivodeship,
    not patient residence. This helper is intentionally generic so the same
    population normalization is shared by mortality and admission charts.
    """
    out = df.copy()
    if "OW_NFZ" not in out.columns:
        raise ValueError("Brak wymaganej kolumny: OW_NFZ")

    normalized = {str(k).zfill(2): int(v) for k, v in population_by_ow.items()}
    if out.empty:
        out["ludnosc_wojewodztwa"] = pd.Series(dtype="Int64")
        for output_column in rate_columns.values():
            out[output_column] = pd.Series(dtype=float)
        return out

    ow = out["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    out["ludnosc_wojewodztwa"] = ow.map(normalized).astype("Int64")
    denominator = out["ludnosc_wojewodztwa"].astype(float)

    for numerator_column, output_column in rate_columns.items():
        if numerator_column not in out.columns:
            raise ValueError(f"Brak wymaganej kolumny: {numerator_column}")
        numerator = pd.to_numeric(out[numerator_column], errors="coerce")
        out[output_column] = numerator.div(denominator.where(denominator.gt(0))) * RATE_SCALE

    return out


def add_population_rate(
    df: pd.DataFrame,
    population_by_ow: Mapping[str, int],
    *,
    hospitalizations_column: str = "hospitalizacje_ogolem",
) -> pd.DataFrame:
    """Add population and hospitalizations per 100k residents.

    Denominator is assigned by facility OW NFZ (the facility's voivodeship),
    not patient residence.
    """
    return add_population_rates(
        df,
        population_by_ow,
        {hospitalizations_column: "hospitalizacje_na_100k"},
    )


def add_admission_population_rates(
    df: pd.DataFrame,
    population_by_ow: Mapping[str, int],
) -> pd.DataFrame:
    """Add planned, urgent and combined admission rates per 100k residents."""
    return add_population_rates(
        df,
        population_by_ow,
        {
            "planowane": "planowane_na_100k",
            "nagle": "nagle_na_100k",
            "razem_planowane_nagle": "razem_planowane_nagle_na_100k",
        },
    )
