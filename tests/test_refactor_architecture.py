from pathlib import Path
import pandas as pd

from dashboard.data.database import should_use_preaggregate
from dashboard.domain.labels import build_product_meta, product_label, product_legend_label, admission_mode_label
from dashboard.ui.components import compact_stats_html, metric_display_value
from dashboard.ui.charts import make_scatter, make_admission_comparison_chart

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
        {"OW_NFZ":"07","NIP_PODMIOTU":"1234567890","KOD_PRODUKTU_JEDNOSTKOWEGO":"p1","Świadczeniodawca":"A","Województwo":"Mazowieckie","Miejscowość":"Warszawa","hospitalizacje_ogolem":100,"zgony":2,"smiertelnosc_proc":2.0},
        {"OW_NFZ":"12","NIP_PODMIOTU":"1234567891","KOD_PRODUKTU_JEDNOSTKOWEGO":"p1","Świadczeniodawca":"B","Województwo":"Śląskie","Miejscowość":"Katowice","hospitalizacje_ogolem":80,"zgony":1,"smiertelnosc_proc":1.25},
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
