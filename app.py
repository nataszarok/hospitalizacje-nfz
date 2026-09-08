from pathlib import Path
import sqlite3
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from dashboard_logic import (
    add_derived_metrics, admission_facility_stats, area_product_stats, count_facilities,
    dataset_summary, filter_by_min_facility_hospitalizations,
)

DB_PATH = Path(__file__).resolve().parent / "health_dashboard.db"
PRODUCT_MAP_PATH = Path(__file__).resolve().parent / "kody_produktu_jgp.csv"
KOD_ZGONU = 9
DEFAULT_PRODUCT = "5.51.01.0005061"

OW_NFZ_TO_WOJEWODZTWO = {
    "01": "Dolnośląskie",
    "02": "Kujawsko-Pomorskie",
    "03": "Lubelskie",
    "04": "Lubuskie",
    "05": "Łódzkie",
    "06": "Małopolskie",
    "07": "Mazowieckie",
    "08": "Opolskie",
    "09": "Podkarpackie",
    "10": "Podlaskie",
    "11": "Pomorskie",
    "12": "Śląskie",
    "13": "Świętokrzyskie",
    "14": "Warmińsko-Mazurskie",
    "15": "Wielkopolskie",
    "16": "Zachodniopomorskie",
}
WOJEWODZTWO_TO_OW_NFZ = {v: k for k, v in OW_NFZ_TO_WOJEWODZTWO.items()}

HIGHLIGHT_COLORS = [
    "#2563EB", "#DC2626", "#16A34A", "#9333EA", "#EA580C", "#0891B2",
    "#DB2777", "#65A30D", "#4F46E5", "#CA8A04", "#0F766E", "#7C3AED",
    "#B91C1C", "#0369A1", "#15803D", "#A21CAF",
]
PRODUCT_SYMBOLS = [
    "circle", "diamond", "square", "triangle-up", "cross", "x",
    "triangle-down", "star", "hexagon", "pentagon",
]


ADMISSION_MODE_LABELS = {
    2: "Przyjęcie w trybie nagłym w wyniku przekazania przez zespół ratownictwa medycznego",
    3: "Przyjęcie w trybie nagłym – inne przypadki",
    5: "Przyjęcie noworodka w wyniku porodu w tym szpitalu",
    6: "Przyjęcie planowe na podstawie skierowania",
    7: "Przyjęcie planowe osoby korzystającej ze świadczeń poza kolejnością na podstawie ustawowych uprawnień",
    8: "Przeniesienie z innego szpitala",
    9: "Przyjęcie osoby podlegającej obowiązkowemu leczeniu",
    10: "Przyjęcie przymusowe",
    11: "Przyjęcie na podstawie karty diagnostyki i leczenia onkologicznego",
}

def admission_mode_label(code) -> str:
    """Etykieta UI dla kodu trybu przyjęcia; do filtrowania nadal trafia sam kod."""
    try:
        normalized = int(code)
    except (TypeError, ValueError):
        return str(code)
    description = ADMISSION_MODE_LABELS.get(normalized)
    return f"{normalized} — {description}" if description else str(normalized)

st.set_page_config(
    page_title="Hospitalizacje 2025 — panel analityczny",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    :root {
        --app-ink: #172033;
        --app-muted: #667085;
        --app-border: #E6EAF0;
        --app-soft: #F7F9FC;
        --app-accent: #2856A3;
        --app-accent-soft: #EEF4FF;
    }
    .stApp { background: #FFFFFF; color: var(--app-ink); }
    .block-container { max-width: 1480px; padding-top: 1.65rem; padding-bottom: 2.5rem; }
    [data-testid="stSidebar"] { border-right: 1px solid var(--app-border); background: #FAFBFD; }
    [data-testid="stSidebar"] .block-container { padding-top: 1.4rem; }
    [data-testid="stMetric"] {
        background: #FFFFFF; border: 1px solid var(--app-border); border-radius: 12px;
        padding: 0.8rem 0.95rem; box-shadow: 0 1px 2px rgba(16,24,40,.03);
    }
    [data-testid="stMetricLabel"] { color: var(--app-muted); }
    [data-testid="stMetricValue"] { color: var(--app-ink); letter-spacing: -0.02em; }
    [data-testid="stPlotlyChart"] {
        background: #FFFFFF; border: 1px solid var(--app-border); border-radius: 14px;
        padding: 0.25rem; overflow: hidden; box-shadow: 0 1px 3px rgba(16,24,40,.035);
    }
    div[data-baseweb="tab-list"] { gap: .35rem; border-bottom: 1px solid var(--app-border); }
    button[data-baseweb="tab"] { font-weight: 650; padding-left: 1rem; padding-right: 1rem; }
    div[data-testid="stExpander"] { border: 1px solid var(--app-border); border-radius: 10px; }
    .app-eyebrow { color: var(--app-accent); font-size: .76rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; margin-bottom: .45rem; }
    .app-title { color: var(--app-ink); font-size: clamp(1.75rem, 2.6vw, 2.45rem); line-height: 1.04; font-weight: 760; letter-spacing: -.035em; margin: 0; }
    .app-subtitle { color: var(--app-muted); max-width: 900px; font-size: .94rem; line-height: 1.45; margin-top: .35rem; }
    .app-badges { display:flex; gap:.5rem; flex-wrap:wrap; margin-top: 1rem; }
    .app-badge { background: var(--app-soft); border: 1px solid var(--app-border); color:#475467; border-radius:999px; padding:.28rem .62rem; font-size:.78rem; font-weight:600; }
    .info-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:.75rem; margin: 1.25rem 0 1.4rem 0; }
    .info-card { background:#FFFFFF; border:1px solid var(--app-border); border-radius:12px; padding:.85rem 1rem; }
    .info-card .k { color:#344054; font-weight:700; font-size:.84rem; margin-bottom:.22rem; }
    .info-card .v { color:var(--app-muted); font-size:.79rem; line-height:1.45; }
    .section-kicker { color: var(--app-accent); font-size:.72rem; font-weight:750; letter-spacing:.07em; text-transform:uppercase; margin-bottom:.18rem; }
    .section-title { color:var(--app-ink); font-size:1.28rem; line-height:1.25; font-weight:730; margin:0; }
    .section-copy { color:var(--app-muted); font-size:.88rem; line-height:1.5; margin:.3rem 0 .8rem 0; }
    .sidebar-kicker { color:#667085; font-size:.7rem; font-weight:750; letter-spacing:.07em; text-transform:uppercase; margin-top:.45rem; margin-bottom:.15rem; }
    .baseline-note { color:#667085; font-size:.78rem; padding:.55rem .72rem; background:#F8FAFC; border:1px solid #EAECF0; border-radius:9px; margin:.45rem 0 .7rem 0; }
    .footer-note { color:#7B8494; font-size:.76rem; line-height:1.5; padding-top:1rem; border-top:1px solid var(--app-border); margin-top:1.6rem; }
    @media (max-width: 900px) { .info-grid { grid-template-columns:1fr; } .block-container { padding-left:1rem; padding-right:1rem; } }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="app-eyebrow">Panel analityczny · Polska · 2025</div>
    <h1 class="app-title">Hospitalizacje 2025</h1>
    <div class="app-subtitle">Interaktywna analiza hospitalizacji, wyników leczenia i trybów przyjęcia na poziomie placówek i regionów.</div>
    """,
    unsafe_allow_html=True,
)

with st.expander("O panelu · dane, zakres i interpretacja", expanded=False):
    st.markdown(
        """
        **Hospitalizacje 2025** to rozwijane narzędzie do eksploracji danych hospitalizacyjnych za 2025 rok. Obecne MVP obejmuje
        analizę wolumenu i śmiertelności oraz porównanie przyjęć planowych i nagłych; kolejne moduły mogą być dokładane bez zmiany
        głównej struktury panelu.

        **Zakres analizy:** hospitalizacje, zgony, śmiertelność, tryb przyjęcia oraz przekroje produktowe i geograficzne.  
        **Jednostka placówki:** unikalna para **OW NFZ + NIP** — ten sam NIP może reprezentować odrębne placówki w różnych OW NFZ.  
        **Jak korzystać:** wybierz produkt i filtry w panelu bocznym, a następnie przełączaj moduły analityczne. Wyróżnienie miasta
        lub województwa zachowuje pozostałe punkty jako tło porównawcze.

        **Interpretacja:** dashboard służy do analizy danych zagregowanych, a nie do oceny jakości pojedynczej placówki bez kontekstu.
        Wyniki zależą m.in. od produktu, profilu pacjentów, trybu przyjęcia i wolumenu. Wartości źródłowe oznaczone jako `<5`
        są przeliczane zgodnie z metodą wybraną w panelu bocznym.
        """
    )


if not DB_PATH.exists():
    st.error(f"Nie znaleziono bazy danych: {DB_PATH}")
    st.info("Plik health_dashboard.db musi znajdować się w tym samym katalogu co app.py.")
    st.stop()

@st.cache_resource
def get_connection():
    try:
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False)
        con.execute("SELECT 1")
        return con
    except Exception as exc:
        st.error("Nie udało się otworzyć bazy SQLite.")
        st.exception(exc)
        st.stop()

@st.cache_data(show_spinner=False)
def load_product_mapping() -> pd.DataFrame:
    if not PRODUCT_MAP_PATH.exists():
        return pd.DataFrame(columns=["KOD_PRODUKTU_JEDNOSTKOWEGO", "KOD_JGP", "NAZWA"])
    mapping = pd.read_csv(PRODUCT_MAP_PATH, encoding="utf-8-sig", dtype=str)
    mapping = mapping[["KOD_PRODUKTU_JEDNOSTKOWEGO", "KOD_JGP", "NAZWA"]].dropna(
        subset=["KOD_PRODUKTU_JEDNOSTKOWEGO"]
    )
    return mapping.drop_duplicates("KOD_PRODUKTU_JEDNOSTKOWEGO")

PRODUCT_MAPPING = load_product_mapping()
def clean_label_value(value) -> str:
    """Zamienia wartości z CSV (w tym NaN) na bezpieczny tekst do UI."""
    if pd.isna(value):
        return ""
    return str(value).strip()


PRODUCT_META = {
    str(row["KOD_PRODUKTU_JEDNOSTKOWEGO"]).strip(): {
        "jgp": clean_label_value(row.get("KOD_JGP", "")),
        "name": clean_label_value(row.get("NAZWA", "")),
    }
    for _, row in PRODUCT_MAPPING.iterrows()
}

def product_label(code: str) -> str:
    code = str(code).strip()
    meta = PRODUCT_META.get(code)
    if not meta:
        return code

    parts = [code]
    if meta["jgp"]:
        parts.append(meta["jgp"])
    if meta["name"]:
        parts.append(meta["name"])
    return " — ".join(parts)

def product_legend_label(code: str) -> str:
    code = str(code).strip()
    meta = PRODUCT_META.get(code, {})
    jgp = clean_label_value(meta.get("jgp", ""))
    name = clean_label_value(meta.get("name", ""))
    if jgp and name:
        return f"{jgp} — {name}"
    return name or jgp or code

@st.cache_data(show_spinner=False)
def distinct_values(column: str):
    allowed_num = {"KOD_TRYBU_PRZYJECIA", "KOD_TRYBU_WYPISU", "MIESIAC"}
    allowed_text = {
        "KOD_PRODUKTU_JEDNOSTKOWEGO", "KOD_PRODUKTU_KONTRAKTOWEGO", "OW_NFZ",
        "PLEC_PACJENTA", "GRUPA_WIEKOWA_PACJENTA", "PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI",
    }
    if column in allowed_num:
        q = "SELECT value_num FROM filter_values WHERE column_name=? ORDER BY value_num"
        vals = pd.read_sql_query(q, get_connection(), params=[column])["value_num"].dropna().tolist()
        return [int(v) if float(v).is_integer() else v for v in vals]
    if column in allowed_text:
        q = "SELECT value_text FROM filter_values WHERE column_name=? ORDER BY value_text"
        return pd.read_sql_query(q, get_connection(), params=[column])["value_text"].dropna().astype(str).tolist()
    raise ValueError("Niedozwolona kolumna filtra")

@st.cache_data(show_spinner=False)
def distinct_cities():
    q = """
        SELECT DISTINCT TRIM("Miejscowość") AS city
        FROM szpitale_laczone
        WHERE "Miejscowość" IS NOT NULL AND TRIM("Miejscowość") <> ''
        ORDER BY city
    """
    return pd.read_sql_query(q, get_connection())["city"].dropna().astype(str).tolist()

def sql_in(column: str, values, where, params):
    if values:
        marks = ",".join("?" for _ in values)
        where.append(f'h."{column}" IN ({marks})')
        params.extend(values)

@st.cache_data(show_spinner=False, ttl=3600)
def load_aggregated(filters: tuple, method: str):
    f = dict(filters)
    where, params = [], []
    sql_in("KOD_PRODUKTU_JEDNOSTKOWEGO", f.get("products", ()), where, params)
    sql_in("KOD_PRODUKTU_KONTRAKTOWEGO", f.get("contracts", ()), where, params)
    sql_in("KOD_TRYBU_PRZYJECIA", f.get("admission", ()), where, params)
    sql_in("KOD_TRYBU_WYPISU", f.get("discharge", ()), where, params)
    sql_in("MIESIAC", f.get("months", ()), where, params)
    sql_in("PLEC_PACJENTA", f.get("sex", ()), where, params)
    sql_in("GRUPA_WIEKOWA_PACJENTA", f.get("age", ()), where, params)
    sql_in("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI", f.get("duration", ()), where, params)

    hosp_col = "LICZBA_HOSPITALIZACJI_NUM" if method.startswith("Symulacyjna") else "LICZBA_HOSPITALIZACJI_MIN"
    where_sql = " WHERE " + " AND ".join(where) if where else ""
    q = f'''
        SELECT h.OW_NFZ, h.NIP_PODMIOTU, h.KOD_PRODUKTU_JEDNOSTKOWEGO,
               COALESCE(s."Świadczeniodawca", 'NIP ' || h.NIP_PODMIOTU) AS "Świadczeniodawca",
               COALESCE(s."Województwo", '') AS "Województwo",
               COALESCE(s."Miejscowość", '') AS "Miejscowość",
               SUM(h."{hosp_col}") AS hospitalizacje_ogolem,
               SUM(CASE WHEN h.KOD_TRYBU_WYPISU = ? THEN h."{hosp_col}" ELSE 0 END) AS zgony
        FROM hospitalizacje h
        LEFT JOIN szpitale_laczone s ON s.NIP = CAST(h.NIP_PODMIOTU AS TEXT)
        {where_sql}
        GROUP BY h.OW_NFZ, h.NIP_PODMIOTU, h.KOD_PRODUKTU_JEDNOSTKOWEGO,
                 s."Świadczeniodawca", s."Województwo", s."Miejscowość"
    '''
    data = pd.read_sql_query(q, get_connection(), params=[KOD_ZGONU] + params)
    if data.empty:
        return data
    data["OW_NFZ"] = data["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    data["Województwo"] = (
        data["Województwo"].replace("", pd.NA)
        .fillna(data["OW_NFZ"].map(OW_NFZ_TO_WOJEWODZTWO))
        .fillna("")
    )
    data["KOD_PRODUKTU_JEDNOSTKOWEGO"] = data["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str)
    data = add_derived_metrics(data)
    return data.sort_values("hospitalizacje_ogolem", ascending=False).reset_index(drop=True)

@st.cache_data(show_spinner=False, ttl=3600)
def load_admission_comparison(filters: tuple, method: str):
    """Load codes 2, 3 and 6, ignoring the sidebar admission filter."""
    f = dict(filters)
    where, params = [], []
    sql_in("KOD_PRODUKTU_JEDNOSTKOWEGO", f.get("products", ()), where, params)
    sql_in("KOD_PRODUKTU_KONTRAKTOWEGO", f.get("contracts", ()), where, params)
    sql_in("KOD_TRYBU_WYPISU", f.get("discharge", ()), where, params)
    sql_in("MIESIAC", f.get("months", ()), where, params)
    sql_in("PLEC_PACJENTA", f.get("sex", ()), where, params)
    sql_in("GRUPA_WIEKOWA_PACJENTA", f.get("age", ()), where, params)
    sql_in("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI", f.get("duration", ()), where, params)
    where.append('h."KOD_TRYBU_PRZYJECIA" IN (2, 3, 6)')
    hosp_col = "LICZBA_HOSPITALIZACJI_NUM" if method.startswith("Symulacyjna") else "LICZBA_HOSPITALIZACJI_MIN"
    where_sql = " WHERE " + " AND ".join(where)
    q = f"""
        SELECT h.OW_NFZ, h.NIP_PODMIOTU, h.KOD_PRODUKTU_JEDNOSTKOWEGO,
               h.KOD_TRYBU_PRZYJECIA,
               COALESCE(s."Świadczeniodawca", 'NIP ' || CAST(h.NIP_PODMIOTU AS TEXT)) AS "Świadczeniodawca",
               COALESCE(s."Miejscowość", '') AS "Miejscowość",
               SUM(h."{hosp_col}") AS hospitalizacje_ogolem
        FROM hospitalizacje h
        LEFT JOIN szpitale_laczone s ON s.NIP = CAST(h.NIP_PODMIOTU AS TEXT)
        {where_sql}
        GROUP BY h.OW_NFZ, h.NIP_PODMIOTU, h.KOD_PRODUKTU_JEDNOSTKOWEGO,
                 h.KOD_TRYBU_PRZYJECIA, s."Świadczeniodawca", s."Miejscowość"
    """
    data = pd.read_sql_query(q, get_connection(), params=params)
    if data.empty:
        return data
    data["OW_NFZ"] = data["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    data["KOD_PRODUKTU_JEDNOSTKOWEGO"] = data["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str)
    return data


def make_admission_comparison_chart(facility_stats: pd.DataFrame):
    """Scatter: one point per facility; X planned (6), Y urgent (2+3)."""
    fig = go.Figure()
    if facility_stats.empty:
        return fig
    work = facility_stats.copy()
    custom = work[[
        "Świadczeniodawca", "NIP_PODMIOTU", "OW_NFZ", "Miejscowość",
        "planowane", "nagle", "razem_planowane_nagle",
    ]].to_numpy()
    fig.add_trace(go.Scatter(
        x=work["planowane"], y=work["nagle"], mode="markers", name="Placówki",
        marker=dict(size=10, opacity=0.75), customdata=custom,
        hovertemplate=(
            "<b>%{customdata[0]}</b><br>"
            "NIP: %{customdata[1]}<br>OW NFZ: %{customdata[2]}<br>"
            "Miejscowość: %{customdata[3]}<br><br>"
            "Przyjęcia planowane (kod 6): <b>%{customdata[4]:,.0f}</b><br>"
            "Przyjęcia nagłe (kody 2+3): <b>%{customdata[5]:,.0f}</b><br>"
            "Razem w porównaniu: %{customdata[6]:,.0f}<br><br>"
            "Każdy punkt reprezentuje jedną placówkę = unikalną parę OW NFZ + NIP."
            "<extra></extra>"
        ),
    ))
    fig.update_layout(
        template="plotly_white",
        xaxis_title="Liczba przyjęć planowanych (kod 6)",
        yaxis_title="Liczba przyjęć nagłych (kody 2 + 3)",
        paper_bgcolor="#FFFFFF", plot_bgcolor="#FFFFFF", font=dict(color="#172033", family="Arial"),
        hoverlabel=dict(bgcolor="#FFFFFF", font_color="#111111", bordercolor="#B8BDC7"),
        showlegend=False, margin=dict(l=20, r=20, t=30, b=50), height=650,
    )
    fig.update_xaxes(showgrid=True, gridcolor="#EEF1F5", zeroline=False)
    fig.update_yaxes(showgrid=True, gridcolor="#EEF1F5", zeroline=False)
    return fig


def make_scatter(
    df: pd.DataFrame, 
    selected_ow: list[str], 
    selected_products: list[str],
    selected_cities: list[str],
    ):
    fig = go.Figure()
    work = df.copy()
    work["OW_NFZ"] = work["OW_NFZ"].astype(str).str.zfill(2)
    work["KOD_PRODUKTU_JEDNOSTKOWEGO"] = work["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str)

    selected_ow = [str(code).zfill(2) for code in selected_ow]
    selected_products = [str(code) for code in selected_products]
    color_map = {code: HIGHLIGHT_COLORS[i % len(HIGHLIGHT_COLORS)] for i, code in enumerate(selected_ow)}
    selected_cities = [str(city).strip() for city in selected_cities if str(city).strip()]
    city_color_map = {city: HIGHLIGHT_COLORS[(i + len(selected_ow)) % len(HIGHLIGHT_COLORS)] for i, city in enumerate(selected_cities)}
    symbol_map = {
        code: ("circle" if len(selected_products) == 1 else PRODUCT_SYMBOLS[i % len(PRODUCT_SYMBOLS)])
        for i, code in enumerate(selected_products)
    }

    # Warstwa szara: wszystko, co nie zostało wyróżnione ani województwem, ani miastem.
    highlighted_mask = work["OW_NFZ"].isin(selected_ow) | work["Miejscowość"].astype(str).str.strip().isin(selected_cities)
    for product in selected_products:
        part = work[(~highlighted_mask) & (work["KOD_PRODUKTU_JEDNOSTKOWEGO"] == product)].copy()
        if part.empty:
            continue
        fig.add_trace(go.Scatter(
            x=part["hospitalizacje_ogolem"],
            y=part["smiertelnosc_proc"],
            mode="markers",
            name=f"Pozostałe · {product_legend_label(product)}",
            legendgroup=f"product-{product}",
            marker=dict(color="#C7CBD1", symbol=symbol_map[product], size=9, opacity=0.68),
            customdata=part[["Świadczeniodawca", "NIP_PODMIOTU", "OW_NFZ", "Województwo", "Miejscowość", "zgony", "KOD_PRODUKTU_JEDNOSTKOWEGO"]],
            hovertemplate=(
                "<b>%{customdata[0]}</b><br>NIP: %{customdata[1]}"
                "<br>OW NFZ: %{customdata[2]}"
                "<br>Województwo: %{customdata[3]}"
                "<br>Miejscowość: %{customdata[4]}"
                "<br>Produkt: %{customdata[6]}"
                "<br>Hospitalizacje: %{x:,.0f}"
                "<br>Zgony: %{customdata[5]:,.0f}"
                "<br>Śmiertelność: %{y:.2f}%<extra></extra>"
            ),
        ))

    # Kolor = wyróżnione województwo, kształt = produkt.
    for region_code in selected_ow:
        region_name = OW_NFZ_TO_WOJEWODZTWO.get(region_code, f"OW NFZ {region_code}")
        for product in selected_products:
            part = work[
                (work["OW_NFZ"] == region_code)
                & (~work["Miejscowość"].astype(str).str.strip().isin(selected_cities))
                & (work["KOD_PRODUKTU_JEDNOSTKOWEGO"] == product)
            ].copy()
            if part.empty:
                continue
            fig.add_trace(go.Scatter(
                x=part["hospitalizacje_ogolem"],
                y=part["smiertelnosc_proc"],
                mode="markers",
                name=f"{region_name} · {product_legend_label(product)}",
                marker=dict(color=color_map[region_code], symbol=symbol_map[product], size=11, opacity=0.94),
                customdata=part[["Świadczeniodawca", "NIP_PODMIOTU", "OW_NFZ", "Województwo", "Miejscowość", "zgony", "KOD_PRODUKTU_JEDNOSTKOWEGO"]],
                hovertemplate=(
                    "<b>%{customdata[0]}</b><br>NIP: %{customdata[1]}"
                    "<br>OW NFZ: %{customdata[2]}"
                    "<br>Województwo: %{customdata[3]}"
                    "<br>Miejscowość: %{customdata[4]}"
                    "<br>Produkt: %{customdata[6]}"
                    "<br>Hospitalizacje: %{x:,.0f}"
                    "<br>Zgony: %{customdata[5]:,.0f}"
                    "<br>Śmiertelność: %{y:.2f}%<extra></extra>"
                ),
            ))

    # Miasto działa jak highlight: nie filtruje danych. Wybrane miasta mają własne kolory.
    for city in selected_cities:
        for product in selected_products:
            part = work[
                (work["Miejscowość"].astype(str).str.strip() == city)
                & (work["KOD_PRODUKTU_JEDNOSTKOWEGO"] == product)
            ].copy()
            if part.empty:
                continue
            fig.add_trace(go.Scatter(
                x=part["hospitalizacje_ogolem"],
                y=part["smiertelnosc_proc"],
                mode="markers",
                name=f"{city} · {product_legend_label(product)}",
                marker=dict(color=city_color_map[city], symbol=symbol_map[product], size=12, opacity=0.96, line=dict(width=1, color="#4B5563")),
                customdata=part[["Świadczeniodawca", "NIP_PODMIOTU", "OW_NFZ", "Województwo", "Miejscowość", "zgony", "KOD_PRODUKTU_JEDNOSTKOWEGO"]],
                hovertemplate=(
                    "<b>%{customdata[0]}</b><br>NIP: %{customdata[1]}"
                    "<br>OW NFZ: %{customdata[2]}"
                    "<br>Województwo: %{customdata[3]}"
                    "<br>Miejscowość: %{customdata[4]}"
                    "<br>Produkt: %{customdata[6]}"
                    "<br>Hospitalizacje: %{x:,.0f}"
                    "<br>Zgony: %{customdata[5]:,.0f}"
                    "<br>Śmiertelność: %{y:.2f}%<extra></extra>"
                ),
            ))

    fig.update_layout(
        template="plotly_white",
        xaxis_title="Liczba hospitalizacji",
        yaxis_title="Śmiertelność (%)",
        hovermode="closest",
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(color="#172033", family="Arial"),
        hoverlabel=dict(bgcolor="#FFFFFF", font_color="#111111", bordercolor="#B8BDC7"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0, font=dict(color="#111111")),
        margin=dict(l=20, r=20, t=70, b=20),
        height=650,
    )
    fig.update_xaxes(showgrid=True, gridcolor="#EEF1F5", zeroline=False, linecolor="#6B7280", tickfont=dict(color="#111111"), title_font=dict(color="#111111"))
    fig.update_yaxes(showgrid=True, gridcolor="#EEF1F5", zeroline=False, linecolor="#6B7280", tickfont=dict(color="#111111"), title_font=dict(color="#111111"))
    return fig

def _save_region_selection():
    st.session_state["region_selection_cache"] = list(
        st.session_state.get("region_sidebar_selector", [])
    )

def _save_city_selection():
    st.session_state["city_selection_cache"] = list(
        st.session_state.get("city_sidebar_selector", [])
    )

def _compact_stats_html(area_name: str, rows: list[dict], baseline_rows: list[dict] | None = None) -> str:
    lines = [
        f'<div style="margin:0 0 8px 0;padding:7px 8px;border:1px solid #E5E7EB;'
        f'border-radius:7px;line-height:1.15;font-size:0.74rem;">',
        f'<div style="font-weight:700;font-size:0.88rem;margin-bottom:5px;">{area_name}</div>',
    ]
    baseline_by_label = {r.get("label"): r for r in (baseline_rows or [])}
    for i, row in enumerate(rows):
        hosp = f"{row['hospitalizacje']:,.0f}".replace(",", " ")
        hosp_fac = f"{row['hospitalizacje_na_placowke']:,.1f}".replace(",", " ")
        label = row["label"]
        weight = "700" if i == 0 else "600"
        border = "" if i == 0 else "border-top:1px solid #F0F1F3;padding-top:4px;margin-top:4px;"
        lines.append(
            f'<div style="{border}">'
            f'<span style="font-weight:{weight};">{label}</span><br>'
            f'Hosp. <b>{hosp}</b> · Śmiert. <b>{row["smiertelnosc"]:.2f}%</b><br>'
            f'Hosp./plac. <b>{hosp_fac}</b> · Placówki <b>{int(row["placowki"])}</b>'
        )
        base = baseline_by_label.get(label)
        if base is not None:
            base_hosp = f"{base['hospitalizacje']:,.0f}".replace(",", " ")
            lines.append(
                f'<br><span style="color:#6B7280;font-size:0.68rem;">Bez progu: '
                f'Hosp. {base_hosp} · Śmiert. {base["smiertelnosc"]:.2f}% · '
                f'Placówki {int(base["placowki"])}</span>'
            )
        lines.append('</div>')
    lines.append("</div>")
    return "".join(lines)


try:
    st.markdown('<div class="section-kicker">Perspektywa geograficzna</div>', unsafe_allow_html=True)
    view_mode = st.segmented_control(
        "Wyróżniaj na wykresie",
        options=["Województwa", "Miasta"],
        default="Województwa",
        selection_mode="single",
        key="view_mode",
    )
    if view_mode is None:
        view_mode = "Województwa"

    with st.sidebar:
        st.markdown("## Ustawienia analizy")
        st.caption("Zawęź dane i zdefiniuj kontekst porównania. Filtry obowiązują oba moduły, z wyjątkiem opisanych odstępstw.")
        st.markdown('<div class="sidebar-kicker">Estymacja wartości ukrytych</div>', unsafe_allow_html=True)
        method = st.radio(
            "Jak przeliczać wartości oznaczone jako '<5'?",
            [
                "Symulacyjna: losowanie 1–4",
                "Konserwatywna: każde <5 = 1",
            ],
            index=1,
            help=(
                "W danych źródłowych część komórek nie zawiera dokładnej liczby, tylko oznaczenie '<5'. "
                "Metoda konserwatywna przypisuje każdej takiej komórce wartość 1, więc daje najniższy możliwy "
                "wkład tych komórek do sum. Metoda symulacyjna korzysta z wcześniej zapisanych w bazie wartości "
                "1–4, wylosowanych raz z seedem 42; niższe liczby mają większe prawdopodobieństwo zgodnie z wagami exp(-x). "
                "Wybór wpływa na sumy hospitalizacji, śmiertelność i położenie punktów, ale nie zmienia liczby rekordów źródłowych."
            ),
        )
        if method.startswith("Konserwatywna"):
            st.caption("<5 → 1. Najbardziej zachowawcze oszacowanie liczby hospitalizacji.")
        else:
            st.caption("<5 → 1–4. Stałe losowanie (seed 42), z większym prawdopodobieństwem niższych wartości.")

        st.divider()
        st.markdown('<div class="sidebar-kicker">Zakres świadczeń</div>', unsafe_allow_html=True)
        products = distinct_values("KOD_PRODUKTU_JEDNOSTKOWEGO")
        default_products = [DEFAULT_PRODUCT] if DEFAULT_PRODUCT in products else []
        selected_products = st.multiselect(
            "Produkt jednostkowy",
            options=products,
            default=default_products,
            format_func=product_label,
            help="Lista pokazuje kod, JGP i nazwę produktu. Do zapytania do bazy przekazywany jest wyłącznie kod produktu.",
        )

        if len(selected_products) > 1:
            st.caption("Kształt punktu oznacza produkt; kolor oznacza wybrane województwo.")

        admission = st.multiselect(
            "Kod trybu przyjęcia",
            options=distinct_values("KOD_TRYBU_PRZYJECIA"),
            format_func=admission_mode_label,
            help="Lista pokazuje kod i opis trybu przyjęcia. Do zapytania do bazy przekazywany jest wyłącznie kod.",
        )
        st.divider()
        st.markdown('<div class="sidebar-kicker">Wyróżnienie geograficzne</div>', unsafe_allow_html=True)
        if view_mode == "Województwa":
            if "region_selection_cache" not in st.session_state:
                st.session_state["region_selection_cache"] = []
            selected_regions = st.multiselect(
                "Województwa do wyróżnienia",
                options=list(WOJEWODZTWO_TO_OW_NFZ.keys()),
                default=st.session_state["region_selection_cache"],
                help=(
                    "Wybór nie usuwa pozostałych województw z wykresu. "
                    "Wybrane są tylko wyróżniane kolorem."
                ),
                key="region_sidebar_selector",
                on_change=_save_region_selection,
            )
            selected_ow = [WOJEWODZTWO_TO_OW_NFZ[name] for name in selected_regions]
            selected_cities = []
        else:
            if "city_selection_cache" not in st.session_state:
                st.session_state["city_selection_cache"] = []
            selected_cities = st.multiselect(
                "Miejscowości do wyróżnienia",
                options=distinct_cities(),
                default=st.session_state["city_selection_cache"],
                help=(
                    "Wybór nie filtruje danych. Wszystkie placówki pozostają na wykresie; "
                    "wybrane miasta są wyróżniane, a pozostałe punkty pozostają szare."
                ),
                placeholder="Wybierz jedno lub więcej miast",
                key="city_sidebar_selector",
                on_change=_save_city_selection,
            )
            selected_ow = []

        st.divider()
        st.markdown('<div class="sidebar-kicker">Filtry dodatkowe</div>', unsafe_allow_html=True)
        with st.expander("Rozwiń filtry dodatkowe"):
            contracts = st.multiselect("Kod produktu kontraktowego", distinct_values("KOD_PRODUKTU_KONTRAKTOWEGO"))
            discharge = st.multiselect("Kod trybu wypisu", distinct_values("KOD_TRYBU_WYPISU"))
            months = st.multiselect("Miesiąc", distinct_values("MIESIAC"))
            sex = st.multiselect("Płeć pacjenta", distinct_values("PLEC_PACJENTA"))
            age = st.multiselect("Grupa wiekowa", distinct_values("GRUPA_WIEKOWA_PACJENTA"))
            duration = st.multiselect("Długość hospitalizacji", distinct_values("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"))
        st.markdown('<div class="sidebar-kicker">Próg wolumenu</div>', unsafe_allow_html=True)
        min_hosp = st.number_input(
            "Minimalna liczba hospitalizacji na placówkę",
            min_value=0, value=0, step=10,
            help=(
                "Próg jest liczony po aktualnych filtrach na poziomie całej placówki, czyli unikalnej pary OW NFZ + NIP. "
                "Jeśli wybrano kilka produktów, ich hospitalizacje są najpierw sumowane dla placówki. "
                "Próg wpływa na punkty, tabele i główne statystyki. Dla porównania aplikacja nadal pokazuje wartości bez tego progu."
            ),
        )

    filters = tuple(sorted({
        "products": tuple(selected_products),
        "contracts": tuple(contracts),
        "admission": tuple(admission),
        "discharge": tuple(discharge),
        "months": tuple(months),
        "sex": tuple(sex),
        "age": tuple(age),
        "duration": tuple(duration),
    }.items()))

    if not selected_products:
        st.info("Wybierz co najmniej jeden produkt jednostkowy w panelu po lewej.")
        st.stop()

    with st.spinner("Agreguję dane..."):
        result_all = load_aggregated(filters, method)

    result = filter_by_min_facility_hospitalizations(result_all, min_hosp)
    tab_mortality, tab_admissions = st.tabs(["Wolumen i śmiertelność", "Tryb przyjęcia"])

    with tab_mortality:
        st.markdown(
            '<div class="section-copy"><b>Wolumen hospitalizacji a śmiertelność.</b> Każdy punkt reprezentuje placówkę; wyróżnienia geograficzne zachowują pozostałe placówki jako tło porównawcze.</div>',
            unsafe_allow_html=True,
        )
        if result.empty:
            st.warning("Brak placówek spełniających wybrany próg liczby hospitalizacji.")
            if min_hosp > 0 and not result_all.empty:
                st.caption("Dane bez progu istnieją — zmniejsz minimalną liczbę hospitalizacji, aby ponownie pokazać punkty.")
        else:
            current_summary = dataset_summary(result)
            baseline_summary = dataset_summary(result_all)
            if min_hosp > 0:
                st.markdown(
                    f'<div class="baseline-note"><b>Aktywny próg wolumenu: ≥ {min_hosp}</b> hospitalizacji na placówkę. '
                    'Główne wartości pokazują dane po progu, a wiersz <b>Bez progu</b> zachowuje punkt odniesienia dla identycznego zestawu filtrów.</div>',
                    unsafe_allow_html=True,
                )
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Placówki", f"{current_summary['placowki']:,}".replace(",", " "),
                      help="Placówka = unikalna para OW NFZ + NIP.")
            c2.metric("Hospitalizacje", f"{current_summary['hospitalizacje']:,.0f}".replace(",", " "))
            c3.metric("Zgony", f"{current_summary['zgony']:,.0f}".replace(",", " "))
            c4.metric("Śmiertelność ogółem", f"{current_summary['smiertelnosc']:.2f}%",
                      help="Śmiertelność ważona: suma zgonów / suma hospitalizacji × 100.")
            if min_hosp > 0:
                b1, b2, b3, b4 = st.columns(4)
                b1.caption(f"Bez progu: **{baseline_summary['placowki']:,}** placówek".replace(",", " "))
                b2.caption(f"Bez progu: **{baseline_summary['hospitalizacje']:,.0f}**".replace(",", " "))
                b3.caption(f"Bez progu: **{baseline_summary['zgony']:,.0f}**".replace(",", " "))
                b4.caption(f"Bez progu: **{baseline_summary['smiertelnosc']:.2f}%**")

            chart_col, stats_col = st.columns([4.25, 1.1], gap="medium")
            with chart_col:
                if view_mode == "Województwa":
                    fig = make_scatter(result, selected_ow, selected_products, [])
                    chart_key = "chart_regions"
                else:
                    fig = make_scatter(result, [], selected_products, selected_cities)
                    chart_key = "chart_cities"
                st.plotly_chart(fig, use_container_width=True, theme=None, config={"displaylogo": False}, key=chart_key)

            with stats_col:
                if view_mode == "Województwa":
                    st.markdown("#### Województwa")
                    if not selected_ow:
                        st.caption("Wybierz województwo w panelu po lewej.")
                    else:
                        area_stats = area_product_stats(
                            result, "OW_NFZ", selected_ow,
                            product_labels={p: product_legend_label(p) for p in selected_products},
                            area_names=OW_NFZ_TO_WOJEWODZTWO,
                        )
                        for area_name, rows in area_stats.items():
                            baseline_area = area_product_stats(
                                result_all, "OW_NFZ", selected_ow,
                                product_labels={p: product_legend_label(p) for p in selected_products},
                                area_names=OW_NFZ_TO_WOJEWODZTWO,
                            ).get(area_name, []) if min_hosp > 0 else None
                            st.markdown(_compact_stats_html(area_name, rows, baseline_area), unsafe_allow_html=True)
                else:
                    st.markdown("#### Miasta")
                    if not selected_cities:
                        st.caption("Wybierz miasto w panelu po lewej.")
                    else:
                        area_stats = area_product_stats(
                            result, "Miejscowość", selected_cities,
                            product_labels={p: product_legend_label(p) for p in selected_products},
                        )
                        for area_name, rows in area_stats.items():
                            baseline_area = area_product_stats(
                                result_all, "Miejscowość", selected_cities,
                                product_labels={p: product_legend_label(p) for p in selected_products},
                            ).get(area_name, []) if min_hosp > 0 else None
                            st.markdown(_compact_stats_html(area_name, rows, baseline_area), unsafe_allow_html=True)

            with st.expander("Tabela danych · wolumen i śmiertelność"):
                show_cols = [
                    "Świadczeniodawca", "NIP_PODMIOTU", "KOD_PRODUKTU_JEDNOSTKOWEGO",
                    "OW_NFZ", "Województwo", "Miejscowość", "hospitalizacje_ogolem", "zgony", "smiertelnosc_proc",
                ]
                display_df = result[show_cols].copy()
                display_df.insert(3, "Nazwa produktu", display_df["KOD_PRODUKTU_JEDNOSTKOWEGO"].map(
                    lambda code: PRODUCT_META.get(str(code), {}).get("name", "")
                ))
                display_df["smiertelnosc_proc"] = display_df["smiertelnosc_proc"].round(2)
                st.dataframe(display_df, use_container_width=True, hide_index=True)

    with tab_admissions:
        st.markdown(
            '<div class="section-title">Przyjęcia planowane a nagłe</div>'
            '<div class="section-copy">Każdy punkt to jedna placówka. Oś X pokazuje przyjęcia planowane (kod 6), a oś Y sumę przyjęć nagłych (kody 2 i 3). Widok pomaga szybko wychwycić placówki o odmiennym profilu przyjęć.</div>',
            unsafe_allow_html=True,
        )
        st.info(
            "W tym module filtr „Kod trybu przyjęcia” z panelu bocznego jest celowo pomijany. "
            "Porównanie zawsze obejmuje pełne kody 6 vs 2+3. Jeśli wybierzesz kilka produktów, ich wolumen jest sumowany do jednego punktu placówki."
        )
        if min_hosp > 0:
            st.caption(
                f"Próg ≥ {min_hosp} w tym tabie jest liczony na sumie przyjęć planowanych (6) + nagłych (2+3) dla całej placówki."
            )
        with st.spinner("Agreguję tryby przyjęcia..."):
            admission_data = load_admission_comparison(filters, method)

        facility_admissions_all = admission_facility_stats(admission_data)
        facility_admissions = (
            facility_admissions_all[facility_admissions_all["razem_planowane_nagle"] >= min_hosp].copy()
            if min_hosp > 0 and not facility_admissions_all.empty
            else facility_admissions_all.copy()
        )

        if facility_admissions.empty:
            st.warning("Brak placówek spełniających warunki porównania kodów przyjęcia 2, 3 i 6.")
        else:
            total_planned = facility_admissions["planowane"].sum()
            total_urgent = facility_admissions["nagle"].sum()
            total_both = total_planned + total_urgent
            facilities_now = facility_admissions[["OW_NFZ", "NIP_PODMIOTU"]].drop_duplicates().shape[0]

            a1, a2, a3, a4 = st.columns(4)
            a1.metric("Placówki", f"{facilities_now:,}".replace(",", " "),
                      help="Placówka = unikalna para OW NFZ + NIP.")
            a2.metric("Planowane (6)", f"{total_planned:,.0f}".replace(",", " "),
                      help="Suma hospitalizacji z kodem trybu przyjęcia 6: przyjęcie planowe na podstawie skierowania.")
            a3.metric("Nagłe (2+3)", f"{total_urgent:,.0f}".replace(",", " "),
                      help="Suma hospitalizacji z kodem 2 (nagłe przez ZRM) oraz kodem 3 (inne przyjęcia nagłe).")
            a4.metric("Planowane + nagłe", f"{total_both:,.0f}".replace(",", " "))

            if min_hosp > 0 and not facility_admissions_all.empty:
                all_planned = facility_admissions_all["planowane"].sum()
                all_urgent = facility_admissions_all["nagle"].sum()
                all_facilities = facility_admissions_all[["OW_NFZ", "NIP_PODMIOTU"]].drop_duplicates().shape[0]
                r1, r2, r3, r4 = st.columns(4)
                r1.caption(f"Bez progu: **{all_facilities:,}** placówek".replace(",", " "))
                r2.caption(f"Bez progu: **{all_planned:,.0f}**".replace(",", " "))
                r3.caption(f"Bez progu: **{all_urgent:,.0f}**".replace(",", " "))
                r4.caption(f"Bez progu: **{(all_planned + all_urgent):,.0f}**".replace(",", " "))

            st.plotly_chart(
                make_admission_comparison_chart(facility_admissions),
                use_container_width=True, theme=None, config={"displaylogo": False},
                key="admission_scatter_nominal",
            )

            table = facility_admissions.copy().rename(columns={
                "planowane": "Planowane (6)", "nagle": "Nagłe (2+3)",
                "razem_planowane_nagle": "Planowane + nagłe",
            })
            with st.expander("Tabela danych · tryby przyjęcia"):
                st.dataframe(
                    table[[
                        "Świadczeniodawca", "NIP_PODMIOTU", "OW_NFZ", "Miejscowość",
                        "Planowane (6)", "Nagłe (2+3)", "Planowane + nagłe",
                    ]],
                    use_container_width=True, hide_index=True,
                )

    st.markdown(
        """
        <div class="footer-note">
        <b>Hospitalizacje 2025 · MVP panelu analitycznego.</b> Wartości oznaczone jako &lt;5 nie są dokładnymi liczbami.
        Metoda konserwatywna przyjmuje 1, a metoda symulacyjna korzysta z zapisanych wartości 1–4
        (seed 42, prawdopodobieństwa ∝ exp(-x)). Interpretuj porównania razem z wolumenem i zakresem aktywnych filtrów.
        </div>
        """,
        unsafe_allow_html=True,
    )
except Exception as exc:
    st.error("Aplikacja napotkała błąd podczas ładowania danych.")
    st.exception(exc)
