from pathlib import Path

import pandas as pd
import pytest

from dashboard.domain.population import RATE_SCALE, add_population_rate
from db_build.import_population import extract_population

ROOT = Path(__file__).resolve().parents[1]


def test_add_population_rate_uses_ow_nfz_denominator():
    df = pd.DataFrame([
        {"OW_NFZ": "07", "hospitalizacje_ogolem": 100},
        {"OW_NFZ": "12", "hospitalizacje_ogolem": 80},
    ])
    out = add_population_rate(df, {"07": 5_508_300, "12": 4_291_400})
    assert out.loc[0, "ludnosc_wojewodztwa"] == 5_508_300
    assert out.loc[0, "hospitalizacje_na_100k"] == pytest.approx(100 / 5_508_300 * RATE_SCALE)
    assert out.loc[1, "hospitalizacje_na_100k"] == pytest.approx(80 / 4_291_400 * RATE_SCALE)


def test_population_import_extracts_first_gus_sheet():
    xlsx = ROOT / "data_sources" / "gus" / "Dzial_04_Ludnosc.xlsx"
    data, poland = extract_population(xlsx)
    assert len(data) == 16
    assert poland == 37_489_100
    maz = data.loc[data["wojewodztwo_gus"] == "Mazowieckie", "population"].iloc[0]
    assert maz == 5_508_300


def test_population_source_is_reproducible():
    assert (ROOT / "data_sources" / "gus" / "Dzial_04_Ludnosc.xlsx").exists()
    assert (ROOT / "db_build" / "sql" / "create_population.sql").exists()
    assert (ROOT / "docs" / "population_gus.md").exists()


def test_add_admission_population_rates_normalizes_both_axes_together():
    from dashboard.domain.population import add_admission_population_rates

    df = pd.DataFrame([{
        "OW_NFZ": "07",
        "planowane": 100,
        "nagle": 250,
        "razem_planowane_nagle": 350,
    }])
    out = add_admission_population_rates(df, {"07": 5_000_000})
    assert out.loc[0, "planowane_na_100k"] == pytest.approx(2.0)
    assert out.loc[0, "nagle_na_100k"] == pytest.approx(5.0)
    assert out.loc[0, "razem_planowane_nagle_na_100k"] == pytest.approx(7.0)
    assert out.loc[0, "ludnosc_wojewodztwa"] == 5_000_000
