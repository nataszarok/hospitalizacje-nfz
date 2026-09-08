import pandas as pd
import pytest

from dashboard_logic import (
    add_derived_metrics,
    area_product_stats,
    area_stats,
    combine_hospital_sources,
    count_facilities,
    deduplicate_hospitals_by_nip,
    normalize_nip,
)


def sample_hospitalizations():
    return pd.DataFrame({
        "OW_NFZ": ["7", "07", "07", "12", "12"],
        "Miejscowość": ["Warszawa", "Warszawa", "Warszawa", "Katowice", "Katowice"],
        "NIP_PODMIOTU": ["1111111111", "2222222222", "1111111111", "3333333333", "4444444444"],
        "KOD_PRODUKTU_JEDNOSTKOWEGO": ["A", "A", "B", "A", "B"],
        "hospitalizacje_ogolem": [100, 10, 50, 20, 80],
        "zgony": [10, 0, 10, 2, 8],
    })


def test_normalize_nip_removes_formatting_and_pads():
    s = pd.Series(["1234567890.0", "123-456-78-90", "123456789"])
    assert normalize_nip(s).tolist() == ["1234567890", "1234567890", "0123456789"]


def test_deduplicate_hospitals_returns_one_row_per_nip_and_titles_name():
    df = pd.DataFrame({
        "NIP": ["1234567890", "1234567890", "2222222222"],
        "Świadczeniodawca": ["SZPITAL TESTOWY", "SZPITAL TESTOWY", "klinika abc"],
        "Miejscowość": ["Warszawa", "Kraków", "Gdańsk"],
        "Województwo": ["Mazowieckie", "Mazowieckie", "Pomorskie"],
    })
    out = deduplicate_hospitals_by_nip(df)
    assert out["NIP"].is_unique
    assert len(out) == 2
    first = out.loc[out["NIP"] == "1234567890"].iloc[0]
    assert first["Świadczeniodawca"] == "Szpital Testowy"
    assert first["Miejscowość"] == "Warszawa"


def test_combine_sources_supplement_overrides_psz_and_stays_unique():
    psz = pd.DataFrame({
        "NIP": ["1111111111", "2222222222"],
        "Świadczeniodawca": ["Stara nazwa", "PSZ B"],
        "Miejscowość": ["Małe Miasto", "Gdańsk"],
        "Województwo": ["Mazowieckie", "Pomorskie"],
    })
    supp = pd.DataFrame({
        "NIP": ["1111111111", "1111111111", "3333333333"],
        "Świadczeniodawca": ["Nowa nazwa", "Ignorowany duplikat", "Nowy C"],
        "Miejscowość": ["Warszawa", "Inne", "Poznań"],
    })
    out = combine_hospital_sources(psz, supp)
    assert out["NIP"].is_unique
    assert len(out) == 3
    row = out.loc[out["NIP"] == "1111111111"].iloc[0]
    assert row["Świadczeniodawca"] == "Nowa nazwa"
    assert row["Miejscowość"] == "Warszawa"


def test_add_derived_metrics_handles_zero_denominator():
    df = pd.DataFrame({"hospitalizacje_ogolem": [100, 0], "zgony": [5, 0]})
    out = add_derived_metrics(df)
    assert out["hospitalizacje_bez_zgonu"].tolist() == [95, 0]
    assert out["smiertelnosc_proc"].tolist() == [5.0, 0.0]


def test_area_stats_uses_weighted_mortality_not_mean_of_facility_rates():
    df = sample_hospitalizations()
    out = area_stats(df, "OW_NFZ", ["07"], {"07": "Mazowieckie"})
    row = out.iloc[0]
    # 160 hospitalizacji, 20 zgonów => 12.5%, while mean of per-facility rates would differ.
    assert row["Hospitalizacje"] == 160
    assert row["Zgony"] == 20
    assert row["Śmiertelność (%)"] == pytest.approx(12.5)
    assert row["Liczba placówek"] == 2
    assert row["Hospitalizacje / placówkę"] == pytest.approx(80.0)


def test_area_product_stats_contains_total_and_each_product():
    df = sample_hospitalizations()
    out = area_product_stats(
        df,
        "Miejscowość",
        ["Warszawa"],
        product_labels={"A": "Produkt A", "B": "Produkt B"},
    )
    rows = out["Warszawa"]
    assert [r["label"] for r in rows] == ["Łącznie", "Produkt A", "Produkt B"]
    assert rows[0]["hospitalizacje"] == 160
    assert rows[0]["smiertelnosc"] == pytest.approx(12.5)
    assert rows[0]["placowki"] == 2
    assert rows[1]["hospitalizacje"] == 110
    assert rows[2]["hospitalizacje"] == 50


def test_area_product_stats_single_product_does_not_duplicate_total():
    df = sample_hospitalizations()
    df = df[df["KOD_PRODUKTU_JEDNOSTKOWEGO"] == "A"]
    out = area_product_stats(df, "Miejscowość", ["Warszawa"])
    assert len(out["Warszawa"]) == 1
    assert out["Warszawa"][0]["label"] == "Łącznie"


def test_area_stats_ignores_unselected_areas():
    df = sample_hospitalizations()
    out = area_stats(df, "Miejscowość", ["Katowice"])
    assert len(out) == 1
    assert out.iloc[0]["Hospitalizacje"] == 100
    assert out.iloc[0]["Liczba placówek"] == 2


def test_count_facilities_uses_ow_nfz_and_nip_pair():
    df = pd.DataFrame({
        "OW_NFZ": ["07", "07", "12", "12"],
        "NIP_PODMIOTU": ["1111111111", "1111111111", "1111111111", "2222222222"],
    })
    assert df["NIP_PODMIOTU"].nunique() == 2
    assert count_facilities(df) == 3


def test_area_product_stats_counts_same_nip_in_two_ow_as_two_facilities_for_global_subset():
    df = pd.DataFrame({
        "OW_NFZ": ["07", "12"],
        "Miejscowość": ["Warszawa", "Katowice"],
        "NIP_PODMIOTU": ["1111111111", "1111111111"],
        "KOD_PRODUKTU_JEDNOSTKOWEGO": ["A", "A"],
        "hospitalizacje_ogolem": [100, 50],
        "zgony": [5, 5],
    })
    assert count_facilities(df) == 2





def test_admission_facility_stats_one_point_per_ow_nip_and_product():
    from dashboard_logic import admission_facility_stats

    df = pd.DataFrame({
        "OW_NFZ": [7, 7, 7, 12, 12],
        "NIP_PODMIOTU": ["1111111111"] * 5,
        "KOD_PRODUKTU_JEDNOSTKOWEGO": ["A"] * 5,
        "KOD_TRYBU_PRZYJECIA": [2, 3, 6, 2, 6],
        "hospitalizacje_ogolem": [10, 20, 30, 40, 60],
        "Świadczeniodawca": ["Spółka A"] * 5,
        "Miejscowość": ["Warszawa", "Warszawa", "Warszawa", "Katowice", "Katowice"],
    })
    out = admission_facility_stats(df).sort_values("OW_NFZ").reset_index(drop=True)

    assert len(out) == 2
    assert out.loc[0, "OW_NFZ"] == "07"
    assert out.loc[0, "planowane"] == 30
    assert out.loc[0, "nagle"] == 30
    assert out.loc[1, "OW_NFZ"] == "12"
    assert out.loc[1, "planowane"] == 60
    assert out.loc[1, "nagle"] == 40



def test_admission_facility_stats_sums_multiple_products_into_one_facility_point():
    from dashboard_logic import admission_facility_stats

    df = pd.DataFrame({
        "OW_NFZ": ["07", "07", "07", "07"],
        "NIP_PODMIOTU": ["1234567890"] * 4,
        "KOD_PRODUKTU_JEDNOSTKOWEGO": ["A", "A", "B", "B"],
        "KOD_TRYBU_PRZYJECIA": [6, 2, 6, 3],
        "hospitalizacje_ogolem": [10, 20, 30, 40],
    })
    out = admission_facility_stats(df)

    assert len(out) == 1
    assert out.iloc[0]["planowane"] == 40
    assert out.iloc[0]["nagle"] == 60


def test_min_facility_threshold_uses_sum_across_products_and_keeps_all_rows():
    from dashboard_logic import filter_by_min_facility_hospitalizations

    df = pd.DataFrame({
        "OW_NFZ": ["07", "07", "07", "12"],
        "NIP_PODMIOTU": ["1111111111", "1111111111", "2222222222", "1111111111"],
        "KOD_PRODUKTU_JEDNOSTKOWEGO": ["A", "B", "A", "A"],
        "hospitalizacje_ogolem": [30, 25, 40, 60],
        "zgony": [1, 1, 1, 2],
    })
    out = filter_by_min_facility_hospitalizations(df, 50)

    # 07+111... qualifies because 30+25=55 and both product rows stay.
    assert len(out[(out["OW_NFZ"] == "07") & (out["NIP_PODMIOTU"] == "1111111111")]) == 2
    # 07+222... has only 40 and is removed.
    assert not ((out["OW_NFZ"] == "07") & (out["NIP_PODMIOTU"] == "2222222222")).any()
    # Same NIP in OW 12 is a separate facility and qualifies with 60.
    assert ((out["OW_NFZ"] == "12") & (out["NIP_PODMIOTU"] == "1111111111")).any()


def test_min_facility_threshold_zero_returns_full_dataset():
    from dashboard_logic import filter_by_min_facility_hospitalizations

    df = sample_hospitalizations()
    out = filter_by_min_facility_hospitalizations(df, 0)
    pd.testing.assert_frame_equal(out.reset_index(drop=True), df.reset_index(drop=True))


def test_dataset_summary_is_weighted_and_counts_ow_nip_pairs():
    from dashboard_logic import dataset_summary

    df = pd.DataFrame({
        "OW_NFZ": ["07", "07", "12"],
        "NIP_PODMIOTU": ["1111111111", "2222222222", "1111111111"],
        "hospitalizacje_ogolem": [100, 50, 50],
        "zgony": [10, 0, 10],
    })
    summary = dataset_summary(df)
    assert summary["placowki"] == 3
    assert summary["hospitalizacje"] == 200
    assert summary["zgony"] == 20
    assert summary["smiertelnosc"] == pytest.approx(10.0)
