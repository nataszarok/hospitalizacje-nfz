from __future__ import annotations

from collections.abc import Mapping
import pandas as pd

RATE_SCALE = 100_000


def add_population_rate(
    df: pd.DataFrame,
    population_by_ow: Mapping[str, int],
    *,
    hospitalizations_column: str = "hospitalizacje_ogolem",
) -> pd.DataFrame:
    """Dodaje ludność województwa i hospitalizacje na 100 tys. mieszkańców.

    Denominator jest przypisany wg OW NFZ placówki, czyli województwa placówki,
    a nie miejsca zamieszkania pacjenta.
    """
    if df.empty:
        out = df.copy()
        out["ludnosc_wojewodztwa"] = pd.Series(dtype="Int64")
        out["hospitalizacje_na_100k"] = pd.Series(dtype=float)
        return out

    out = df.copy()
    ow = out["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    normalized = {str(k).zfill(2): int(v) for k, v in population_by_ow.items()}
    out["ludnosc_wojewodztwa"] = ow.map(normalized).astype("Int64")
    out["hospitalizacje_na_100k"] = (
        pd.to_numeric(out[hospitalizations_column], errors="coerce")
        / out["ludnosc_wojewodztwa"].astype(float)
        * RATE_SCALE
    )
    return out
