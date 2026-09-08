from pathlib import Path
import sqlite3

import pytest

DB_PATH = Path(__file__).resolve().parents[1] / "health_dashboard.db"


@pytest.fixture(scope="module")
def conn():
    if not DB_PATH.exists():
        pytest.skip("health_dashboard.db nie jest dołączona do wersji no-db")
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    yield con
    con.close()


def test_combined_hospitals_have_unique_nip(conn):
    total, unique_nip = conn.execute(
        "SELECT COUNT(*), COUNT(DISTINCT NIP) FROM szpitale_laczone"
    ).fetchone()
    assert total == unique_nip


def test_psz_unique_table_really_has_unique_nip(conn):
    total, unique_nip = conn.execute(
        "SELECT COUNT(*), COUNT(DISTINCT NIP) FROM szpitale_psz_unique"
    ).fetchone()
    assert total == unique_nip


def test_join_to_hospital_dictionary_does_not_multiply_rows(conn):
    raw = conn.execute("SELECT COUNT(*) FROM hospitalizacje").fetchone()[0]
    joined = conn.execute(
        """
        SELECT COUNT(*)
        FROM hospitalizacje h
        LEFT JOIN szpitale_laczone s ON s.NIP = CAST(h.NIP_PODMIOTU AS TEXT)
        """
    ).fetchone()[0]
    assert joined == raw


def test_join_preserves_min_hospitalization_sum(conn):
    raw = conn.execute(
        "SELECT SUM(LICZBA_HOSPITALIZACJI_MIN) FROM hospitalizacje"
    ).fetchone()[0]
    joined = conn.execute(
        """
        SELECT SUM(h.LICZBA_HOSPITALIZACJI_MIN)
        FROM hospitalizacje h
        LEFT JOIN szpitale_laczone s ON s.NIP = CAST(h.NIP_PODMIOTU AS TEXT)
        """
    ).fetchone()[0]
    assert joined == raw


def test_supplement_has_unique_nip(conn):
    total, unique_nip = conn.execute(
        "SELECT COUNT(*), COUNT(DISTINCT NIP) FROM szpitale_uzupelnienie"
    ).fetchone()
    assert total == unique_nip


def test_product_5061_has_493_facilities_by_ow_and_nip(conn):
    product = "5.51.01.0005061"
    count = conn.execute(
        """
        SELECT COUNT(*)
        FROM (
            SELECT DISTINCT
                printf('%02d', CAST(OW_NFZ AS INTEGER)) AS OW_NFZ_NORM,
                CAST(NIP_PODMIOTU AS TEXT) AS NIP_PODMIOTU
            FROM hospitalizacje
            WHERE KOD_PRODUKTU_JEDNOSTKOWEGO = ?
        )
        """,
        (product,),
    ).fetchone()[0]
    assert count == 493


def test_reference_tables_are_stored_in_database(conn):
    expected = {
        'app_config', 'nfz_regions', 'admission_modes',
        'highlight_palette', 'product_symbols', 'produkty_jgp',
    }
    present = {
        row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert expected.issubset(present)


def test_default_product_is_e10(conn):
    code = conn.execute(
        "SELECT value FROM app_config WHERE key='default_product_code'"
    ).fetchone()[0]
    assert code == '5.51.01.0005010'
    row = conn.execute(
        "SELECT KOD_JGP FROM produkty_jgp WHERE KOD_PRODUKTU_JEDNOSTKOWEGO=?",
        (code,),
    ).fetchone()
    assert row == ('E10',)


def test_csv_backed_reference_data_are_in_database(conn):
    assert conn.execute("SELECT COUNT(*) FROM produkty_jgp").fetchone()[0] == 693
    assert conn.execute("SELECT COUNT(*) FROM szpitale_uzupelnienie").fetchone()[0] == 125
    assert conn.execute("SELECT COUNT(*) FROM hospitalizacje").fetchone()[0] == 3_881_675
