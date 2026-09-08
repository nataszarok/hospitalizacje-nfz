from pathlib import Path
import sqlite3

from db_build.import_nfz_providers import (
    TABLE_NAME, prepare_provider_dataframe, write_provider_table, verify_hospital_join,
)

ROOT = Path(__file__).resolve().parents[1]


def test_prepare_provider_dataframe_deduplicates_branch_and_nip():
    df = prepare_provider_dataframe(ROOT / "data_sources" / "nfz_swiadczeniodawcy_2025.csv")
    assert not df.duplicated(["oddzial_nfz", "nip"]).any()
    assert len(df) == 24_704


def test_prepare_provider_dataframe_fills_known_missing_hospital_providers():
    df = prepare_provider_dataframe(ROOT / "data_sources" / "nfz_swiadczeniodawcy_2025.csv")
    by_nip = df.set_index("nip")
    assert by_nip.loc["6151706942", "oddzial_nfz"] == "01"
    assert by_nip.loc["6151706942", "kod"] == "3401029"
    assert by_nip.loc["5422208990", "oddzial_nfz"] == "10"
    assert by_nip.loc["5422208990", "kod"] == "100003731"
    assert by_nip.loc["6121542507", "oddzial_nfz"] == "01"


def test_write_provider_table_creates_unique_composite_key():
    df = prepare_provider_dataframe(ROOT / "data_sources" / "nfz_swiadczeniodawcy_2025.csv").head(100)
    con = sqlite3.connect(":memory:")
    write_provider_table(con, df)
    total, unique_keys = con.execute(
        f"SELECT COUNT(*), COUNT(DISTINCT oddzial_nfz || '|' || nip) FROM {TABLE_NAME}"
    ).fetchone()
    assert total == unique_keys == len(df)


def test_prepare_provider_dataframe_normalizes_districts_to_parent_cities():
    df = prepare_provider_dataframe(ROOT / "data_sources" / "nfz_swiadczeniodawcy_2025.csv")
    cities = set(df["miejscowosc"])
    assert "WARSZAWA WOLA" not in cities
    assert "MOKOTÓW" not in cities
    assert not any(city.startswith("POZNAŃ-") for city in cities)
    assert not any(city.startswith("WROCŁAW-") for city in cities)
    assert not any(city.startswith("ŁÓDŹ-") for city in cities)
    assert {"WARSZAWA", "POZNAŃ", "WROCŁAW", "ŁÓDŹ"}.issubset(cities)


def test_display_names_remove_legal_forms_without_overwriting_official_names():
    df = prepare_provider_dataframe(ROOT / "data_sources" / "nfz_swiadczeniodawcy_2025.csv")
    assert "swiadczeniodawca_wyswietlany" in df.columns
    legal_fragments = [
        "SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ", "SPÓŁKA AKCYJNA",
        "SPÓŁKA KOMANDYTOWA", "SPÓŁKA JAWNA", "SPÓŁKA PARTNERSKA",
        "SPÓŁKA CYWILNA", "SP. Z O.O.", "SP.Z O.O.", "S.A.", "S.C.",
    ]
    display = df["swiadczeniodawca_wyswietlany"].str.upper()
    for fragment in legal_fragments:
        assert not display.str.contains(fragment, regex=False).any()
    assert (df["swiadczeniodawca"] != df["swiadczeniodawca_wyswietlany"]).any()
    assert df["swiadczeniodawca_wyswietlany"].str.len().gt(0).all()
