from pathlib import Path
import pandas as pd

from dashboard.data.database import should_use_preaggregate
from dashboard.domain.labels import build_product_meta, product_label, product_legend_label, admission_mode_label
from dashboard.ui.components import compact_stats_html, metric_display_value
from dashboard.ui.charts import make_scatter, make_admission_comparison_chart
from dashboard.ui.axis_options import X_AXIS_PER_100K

ROOT = Path(__file__).resolve().parents[1]

def test_sql_moved_to_sql_directory():
    assert (ROOT / "sql" / "create_aggregates.sql").exists()
    assert not (ROOT / "create_aggregates.sql").exists()

def test_build_and_refresh_reference_sql_directory():
    assert "sql' / 'create_aggregates.sql" in (ROOT / "build_db.py").read_text(encoding="utf-8")
    assert '"sql" / "create_aggregates.sql"' in (ROOT / "refresh_aggregates.py").read_text(encoding="utf-8")

def test_preaggregate_decision_is_explicit_and_testable():
    assert should_use_preaggregate({"products": ("x",), "months": ()})
    assert not should_use_preaggregate({"products": ("x",), "months": (1,)})

def test_product_labels_are_pure_domain_helpers():
    mapping = pd.DataFrame([{"KOD_PRODUKTU_JEDNOSTKOWEGO":"5.51.01.0005010","KOD_JGP":"E10","NAZWA":"Test"}])
    meta = build_product_meta(mapping)
    assert product_label("5.51.01.0005010", meta) == "5.51.01.0005010 — E10 — Test"
    assert product_legend_label("5.51.01.0005010", meta) == "E10 — Test"
    assert admission_mode_label(6, {6:"Planowe"}) == "6 — Planowe"

def test_metric_value_and_compact_stats_are_pure_render_helpers():
    assert metric_display_value("372", "493") == "372 / 493"
    html = compact_stats_html("Mazowieckie", [{"label":"Łącznie","hospitalizacje":100,"hospitalizacje_na_placowke":10,"smiertelnosc":2.5,"placowki":10}])
    assert "Mazowieckie" in html and "2.50%" in html

def _scatter_df():
    return pd.DataFrame([
        {"OW_NFZ":"07","NIP_PODMIOTU":"1234567890","KOD_PRODUKTU_JEDNOSTKOWEGO":"p1","Świadczeniodawca":"A","Województwo":"Mazowieckie","Miejscowość":"Warszawa","hospitalizacje_ogolem":100,"ludnosc_wojewodztwa":5508300,"hospitalizacje_na_100k":1.8154,"zgony":2,"smiertelnosc_proc":2.0},
        {"OW_NFZ":"12","NIP_PODMIOTU":"1234567891","KOD_PRODUKTU_JEDNOSTKOWEGO":"p1","Świadczeniodawca":"B","Województwo":"Śląskie","Miejscowość":"Katowice","hospitalizacje_ogolem":80,"ludnosc_wojewodztwa":4291400,"hospitalizacje_na_100k":1.8642,"zgony":1,"smiertelnosc_proc":1.25},
    ])

def test_scatter_builder_keeps_hover_and_highlight_layers():
    fig = make_scatter(_scatter_df(), ["07"], ["p1"], [], {"07":"Mazowieckie"}, ["#000000"], ["circle"], lambda p:p)
    assert len(fig.data) == 2
    assert all("Śmiertelność" in trace.hovertemplate for trace in fig.data)
    assert fig.layout.hovermode == "closest"

def test_admission_chart_hover_contract():
    df = pd.DataFrame([{"OW_NFZ":"07","NIP_PODMIOTU":"1234567890","Świadczeniodawca":"A","Miejscowość":"Warszawa","planowane":10,"nagle":20,"razem_planowane_nagle":30}])
    fig = make_admission_comparison_chart(df)
    assert len(fig.data) == 1
    assert "unikalną parę OW NFZ + NIP" in fig.data[0].hovertemplate

def test_app_is_thin_orchestrator():
    app = (ROOT / "app.py").read_text(encoding="utf-8")
    assert app.count("def ") == 0
    assert len(app.splitlines()) < 120


def test_population_sql_and_import_process_are_separated():
    assert (ROOT / "sql" / "create_population.sql").exists()
    assert (ROOT / "import_population.py").exists()
    assert (ROOT / "docs" / "population_gus.md").exists()
    build = (ROOT / "build_db.py").read_text(encoding="utf-8")
    assert "import_population" in build

def test_scatter_can_use_population_normalized_x_axis():
    fig = make_scatter(
        _scatter_df(), ["07"], ["p1"], [], {"07":"Mazowieckie"},
        ["#000000"], ["circle"], lambda p:p, x_axis_mode=X_AXIS_PER_100K
    )
    assert fig.layout.xaxis.title.text == "Liczba hospitalizacji / 100 000 mieszkańców"
    assert fig.data[1].x[0] == _scatter_df().iloc[0]["hospitalizacje_na_100k"]
    assert "Ludność województwa" in fig.data[0].hovertemplate


def test_x_axis_widget_state_is_initialized_once_and_persists():
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import MORTALITY_X_AXIS_STATE_KEY, ensure_widget_choice

    state = {}
    assert ensure_widget_choice(
        state,
        MORTALITY_X_AXIS_STATE_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K],
        X_AXIS_TOTAL,
    ) == X_AXIS_TOTAL

    state[MORTALITY_X_AXIS_STATE_KEY] = X_AXIS_PER_100K
    assert ensure_widget_choice(
        state,
        MORTALITY_X_AXIS_STATE_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K],
        X_AXIS_TOTAL,
    ) == X_AXIS_PER_100K


def test_x_axis_widget_state_recovers_invalid_value():
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import MORTALITY_X_AXIS_STATE_KEY, ensure_widget_choice

    state = {MORTALITY_X_AXIS_STATE_KEY: "stara-wartosc"}
    assert ensure_widget_choice(
        state,
        MORTALITY_X_AXIS_STATE_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K],
        X_AXIS_TOTAL,
    ) == X_AXIS_TOTAL
    assert state[MORTALITY_X_AXIS_STATE_KEY] == X_AXIS_TOTAL


def test_mortality_chart_key_changes_with_axis_mode():
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import mortality_chart_key

    total = mortality_chart_key("Województwa", X_AXIS_TOTAL)
    normalized = mortality_chart_key("Województwa", X_AXIS_PER_100K)
    assert total != normalized
    assert total.endswith("_total")
    assert normalized.endswith("_per_100k")


def test_x_axis_visual_widget_is_restored_from_canonical_state():
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import (
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        prepare_widget_choice,
    )

    state = {MORTALITY_X_AXIS_STATE_KEY: X_AXIS_PER_100K}
    selected = prepare_widget_choice(
        state,
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K],
        X_AXIS_TOTAL,
    )
    assert selected == X_AXIS_PER_100K
    assert state[MORTALITY_X_AXIS_WIDGET_KEY] == X_AXIS_PER_100K


def test_x_axis_widget_change_updates_canonical_state():
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import (
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        sync_widget_choice,
    )

    state = {
        MORTALITY_X_AXIS_STATE_KEY: X_AXIS_PER_100K,
        MORTALITY_X_AXIS_WIDGET_KEY: X_AXIS_TOTAL,
    }
    selected = sync_widget_choice(
        state,
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K],
        X_AXIS_TOTAL,
    )
    assert selected == X_AXIS_TOTAL
    assert state[MORTALITY_X_AXIS_STATE_KEY] == X_AXIS_TOTAL


def test_x_axis_state_uses_stable_ids_not_labels():
    from dashboard.ui.axis_options import (
        X_AXIS_PER_100K, X_AXIS_TOTAL, X_AXIS_LABELS, x_axis_label
    )
    assert X_AXIS_TOTAL == "total"
    assert X_AXIS_PER_100K == "per_100k"
    assert X_AXIS_LABELS[X_AXIS_TOTAL] != X_AXIS_TOTAL
    assert x_axis_label(X_AXIS_PER_100K) == "Liczba hospitalizacji / 100 000 mieszkańców"


def test_x_axis_legacy_label_is_migrated_to_stable_id():
    from dashboard.ui.axis_options import (
        X_AXIS_DEFAULT, X_AXIS_LEGACY_VALUES, X_AXIS_OPTIONS, X_AXIS_PER_100K, X_AXIS_LABELS
    )
    from dashboard.ui.state import MORTALITY_X_AXIS_STATE_KEY, ensure_widget_choice

    old_label = X_AXIS_LABELS[X_AXIS_PER_100K]
    state = {MORTALITY_X_AXIS_STATE_KEY: old_label}
    selected = ensure_widget_choice(
        state, MORTALITY_X_AXIS_STATE_KEY, X_AXIS_OPTIONS, X_AXIS_DEFAULT,
        aliases=X_AXIS_LEGACY_VALUES,
    )
    assert selected == X_AXIS_PER_100K
    assert state[MORTALITY_X_AXIS_STATE_KEY] == X_AXIS_PER_100K


def test_chart_key_does_not_depend_on_presentation_label():
    from dashboard.ui.axis_options import X_AXIS_PER_100K
    from dashboard.ui.state import mortality_chart_key

    assert mortality_chart_key("Województwa", X_AXIS_PER_100K) == (
        "mortality_chart_regions_per_100k"
    )


def test_widget_callback_never_writes_instantiated_widget_key():
    """Regression: Streamlit forbids changing a widget key after instantiation."""
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import (
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        sync_widget_choice,
    )

    class LockedWidgetState(dict):
        locked = False

        def __setitem__(self, key, value):
            if self.locked and key == MORTALITY_X_AXIS_WIDGET_KEY:
                raise AssertionError("widget key modified after instantiation")
            super().__setitem__(key, value)

    state = LockedWidgetState({
        MORTALITY_X_AXIS_STATE_KEY: X_AXIS_TOTAL,
        MORTALITY_X_AXIS_WIDGET_KEY: X_AXIS_PER_100K,
    })
    state.locked = True

    selected = sync_widget_choice(
        state,
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K],
        X_AXIS_TOTAL,
    )
    assert selected == X_AXIS_PER_100K
    assert state[MORTALITY_X_AXIS_STATE_KEY] == X_AXIS_PER_100K
    assert state[MORTALITY_X_AXIS_WIDGET_KEY] == X_AXIS_PER_100K


def test_prepare_then_callback_models_streamlit_widget_lifecycle():
    from dashboard.ui.axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL
    from dashboard.ui.state import (
        MORTALITY_X_AXIS_STATE_KEY,
        MORTALITY_X_AXIS_WIDGET_KEY,
        prepare_widget_choice,
        sync_widget_choice,
    )

    state = {MORTALITY_X_AXIS_STATE_KEY: X_AXIS_PER_100K}
    # Before instantiation: restore the visual widget from canonical state.
    prepare_widget_choice(
        state, MORTALITY_X_AXIS_STATE_KEY, MORTALITY_X_AXIS_WIDGET_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K], X_AXIS_TOTAL,
    )
    assert state[MORTALITY_X_AXIS_WIDGET_KEY] == X_AXIS_PER_100K

    # Simulate a user's widget change. Callback copies it to canonical state.
    dict.__setitem__(state, MORTALITY_X_AXIS_WIDGET_KEY, X_AXIS_TOTAL)
    sync_widget_choice(
        state, MORTALITY_X_AXIS_STATE_KEY, MORTALITY_X_AXIS_WIDGET_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K], X_AXIS_TOTAL,
    )
    assert state[MORTALITY_X_AXIS_STATE_KEY] == X_AXIS_TOTAL

    # Next unrelated rerun restores the same visual selection.
    prepare_widget_choice(
        state, MORTALITY_X_AXIS_STATE_KEY, MORTALITY_X_AXIS_WIDGET_KEY,
        [X_AXIS_TOTAL, X_AXIS_PER_100K], X_AXIS_TOTAL,
    )
    assert state[MORTALITY_X_AXIS_WIDGET_KEY] == X_AXIS_TOTAL
