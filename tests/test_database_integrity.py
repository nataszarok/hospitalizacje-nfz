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
        'highlight_palette', 'product_symbols', 'produkty_jgp', 'population_voivodeship',
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


def test_population_table_has_all_voivodeships_and_gus_total(conn):
    count, total = conn.execute(
        "SELECT COUNT(*), SUM(population) FROM population_voivodeship"
    ).fetchone()
    assert count == 16
    assert total == 37_489_000


def test_population_mazowieckie_matches_gus_sheet(conn):
    row = conn.execute(
        "SELECT population, reference_date, source_sheet FROM population_voivodeship WHERE ow_nfz='07'"
    ).fetchone()
    assert row == (5_508_300, '2024-12-31', '1 (19)')


def test_nfz_provider_table_is_unique_by_branch_and_nip(conn):
    total, unique_keys = conn.execute(
        "SELECT COUNT(*), COUNT(DISTINCT oddzial_nfz || '|' || nip) "
        "FROM nfz_swiadczeniodawcy_unique"
    ).fetchone()
    assert total == unique_keys


def test_nfz_provider_join_covers_all_hospital_facilities(conn):
    total_pairs = conn.execute(
        "SELECT COUNT(*) FROM (SELECT OW_NFZ, NIP_PODMIOTU FROM hospitalizacje "
        "GROUP BY OW_NFZ, NIP_PODMIOTU)"
    ).fetchone()[0]
    matched_pairs = conn.execute(
        "SELECT COUNT(*) FROM ("
        "SELECT h.OW_NFZ, h.NIP_PODMIOTU FROM hospitalizacje h "
        "JOIN nfz_swiadczeniodawcy_unique s "
        "ON s.oddzial_nfz=h.OW_NFZ AND s.nip=CAST(h.NIP_PODMIOTU AS TEXT) "
        "GROUP BY h.OW_NFZ, h.NIP_PODMIOTU)"
    ).fetchone()[0]
    assert total_pairs == 833
    assert matched_pairs == total_pairs


def test_nfz_provider_join_does_not_multiply_hospital_rows(conn):
    raw = conn.execute("SELECT COUNT(*) FROM hospitalizacje").fetchone()[0]
    joined = conn.execute(
        "SELECT COUNT(*) FROM hospitalizacje h "
        "LEFT JOIN nfz_swiadczeniodawcy_unique s "
        "ON s.oddzial_nfz=h.OW_NFZ AND s.nip=CAST(h.NIP_PODMIOTU AS TEXT)"
    ).fetchone()[0]
    assert joined == raw == 3_881_675


def test_manual_provider_rows_and_branch_correction(conn):
    zgorzelec = conn.execute(
        "SELECT oddzial_nfz, kod, regon, miejscowosc FROM nfz_swiadczeniodawcy_unique WHERE nip='6151706942'"
    ).fetchone()
    przystupa = conn.execute(
        "SELECT oddzial_nfz, kod, regon, miejscowosc FROM nfz_swiadczeniodawcy_unique WHERE nip='5422208990'"
    ).fetchone()
    boleslawiec = conn.execute(
        "SELECT oddzial_nfz, miejscowosc FROM nfz_swiadczeniodawcy_unique WHERE nip='6121542507'"
    ).fetchone()
    assert zgorzelec == ('01', '3401029', '231161448', 'ZGORZELEC')
    assert przystupa == ('10', '100003731', '200236185', 'BIELSK PODLASKI')
    assert boleslawiec == ('01', 'BOLESŁAWIEC')


def test_duration_admission_serving_aggregate_has_expected_grain(conn):
    total = conn.execute(
        "SELECT COUNT(*) FROM dashboard_facility_product_duration_admission"
    ).fetchone()[0]
    unique_keys = conn.execute(
        "SELECT COUNT(*) FROM (SELECT OW_NFZ,NIP_PODMIOTU,KOD_PRODUKTU_JEDNOSTKOWEGO,"
        "PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI,KOD_TRYBU_PRZYJECIA "
        "FROM dashboard_facility_product_duration_admission GROUP BY 1,2,3,4,5)"
    ).fetchone()[0]
    assert total == unique_keys == 543_633


def test_duration_serving_aggregate_matches_raw_for_default_product(conn):
    product = '5.51.01.0005010'
    duration = '3-5 dni'
    raw = conn.execute(
        "SELECT SUM(LICZBA_HOSPITALIZACJI_MIN), "
        "SUM(CASE WHEN KOD_TRYBU_WYPISU=9 THEN LICZBA_HOSPITALIZACJI_MIN ELSE 0 END), "
        "SUM(LICZBA_HOSPITALIZACJI_NUM), "
        "SUM(CASE WHEN KOD_TRYBU_WYPISU=9 THEN LICZBA_HOSPITALIZACJI_NUM ELSE 0 END) "
        "FROM hospitalizacje WHERE KOD_PRODUKTU_JEDNOSTKOWEGO=? "
        "AND PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI=?",
        (product, duration),
    ).fetchone()
    serving = conn.execute(
        "SELECT SUM(HOSP_MIN),SUM(DEATHS_MIN),SUM(HOSP_NUM),SUM(DEATHS_NUM) "
        "FROM dashboard_facility_product_duration_admission "
        "WHERE KOD_PRODUKTU_JEDNOSTKOWEGO=? "
        "AND PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI=?",
        (product, duration),
    ).fetchone()
    assert serving == raw
