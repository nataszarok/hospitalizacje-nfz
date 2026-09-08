from __future__ import annotations

from collections.abc import Callable
import pandas as pd
import plotly.graph_objects as go

from .axis_options import X_AXIS_PER_100K, X_AXIS_TOTAL


def _geography_color_maps(
    selected_ow: list[str],
    selected_cities: list[str],
    colors: list[str],
) -> tuple[dict[str, str], dict[str, str]]:
    """Assign deterministic highlight colors shared across dashboard charts."""
    region_map = {x: colors[i % len(colors)] for i, x in enumerate(selected_ow)} if colors else {}
    city_map = {
        x: colors[(i + len(selected_ow)) % len(colors)]
        for i, x in enumerate(selected_cities)
    } if colors else {}
    return region_map, city_map


def _admission_axis_config(scale_mode: str) -> tuple[str, str, str, str, str]:
    if scale_mode == X_AXIS_PER_100K:
        return (
            "planowane_na_100k",
            "nagle_na_100k",
            "Przyjęcia planowane / 100 000 mieszkańców",
            "Przyjęcia nagłe / 100 000 mieszkańców",
            ":,.2f",
        )
    return (
        "planowane",
        "nagle",
        "Liczba przyjęć planowanych (kod 6)",
        "Liczba przyjęć nagłych (kody 2 + 3)",
        ":,.0f",
    )


def _shared_axis_range_with_padding(
    x: pd.Series,
    y: pd.Series,
    padding: float = 0.05,
) -> tuple[float, float]:
    """Return one padded data-driven range shared by both comparable axes.

    The bounds are based on the combined X/Y minimum and maximum, with equal
    padding on both sides. The lower display bound may be slightly negative
    even though admission values are non-negative; this is intentional visual
    whitespace so observations equal to zero are not clipped against the plot
    border. The same bounds on both axes preserve the geometric meaning of the
    y=x reference line.
    """
    values = pd.concat([pd.to_numeric(x, errors="coerce"), pd.to_numeric(y, errors="coerce")])
    values = values[values.notna()]
    if values.empty:
        return 0.0, 1.0

    lower_data = float(values.min())
    upper_data = float(values.max())
    span = upper_data - lower_data

    if span <= 0:
        reference = max(abs(upper_data), 1.0)
        margin = reference * padding
    else:
        margin = span * padding

    lower = lower_data - margin
    upper = upper_data + margin
    if upper <= lower:
        upper = lower + 1.0
    return lower, upper


def make_admission_comparison_chart(
    facility_stats: pd.DataFrame,
    selected_ow: list[str] | None = None,
    selected_cities: list[str] | None = None,
    region_names: dict[str, str] | None = None,
    colors: list[str] | None = None,
    scale_mode: str = X_AXIS_TOTAL,
):
    """Admission scatter with shared population scale and geography highlights.

    Both axes always use the same scale: either nominal admission counts or
    admissions per 100k residents of the facility's OW NFZ voivodeship.
    Unselected facilities are gray; selected regions/cities use the same
    palette semantics as the mortality scatter.
    """
    fig = go.Figure()
    if facility_stats.empty:
        return fig

    work = facility_stats.copy()
    work["OW_NFZ"] = work["OW_NFZ"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(2)
    if "Miejscowość" not in work.columns:
        work["Miejscowość"] = ""
    else:
        work["Miejscowość"] = work["Miejscowość"].astype(str).str.strip()
    selected_ow = [str(x).zfill(2) for x in (selected_ow or [])]
    selected_cities = [str(x).strip() for x in (selected_cities or []) if str(x).strip()]
    region_names = region_names or {}
    colors = colors or ["#2856A3"]
    region_color_map, city_color_map = _geography_color_maps(selected_ow, selected_cities, colors)

    x_col, y_col, x_title, y_title, _ = _admission_axis_config(scale_mode)
    required_rate_cols = {x_col, y_col}
    missing = required_rate_cols.difference(work.columns)
    if missing:
        raise ValueError(f"Brak kolumn wymaganych dla wybranej skali: {sorted(missing)}")

    custom_cols = [
        "Świadczeniodawca", "NIP_PODMIOTU", "OW_NFZ", "Miejscowość",
        "planowane", "nagle", "razem_planowane_nagle",
        "planowane_na_100k", "nagle_na_100k", "ludnosc_wojewodztwa",
    ]
    custom = lambda part: part[custom_cols].to_numpy()
    hover = (
        "<b>%{customdata[0]}</b><br>NIP: %{customdata[1]}<br>"
        "OW NFZ: %{customdata[2]}<br>Miejscowość: %{customdata[3]}<br><br>"
        "Przyjęcia planowane (kod 6): <b>%{customdata[4]:,.0f}</b><br>"
        "Przyjęcia nagłe (kody 2+3): <b>%{customdata[5]:,.0f}</b><br>"
        "Razem w porównaniu: %{customdata[6]:,.0f}<br>"
        "Planowane / 100 000: <b>%{customdata[7]:,.2f}</b><br>"
        "Nagłe / 100 000: <b>%{customdata[8]:,.2f}</b><br>"
        "Ludność województwa: %{customdata[9]:,.0f}<br><br>"
        "Każdy punkt reprezentuje jedną placówkę = unikalną parę OW NFZ + NIP."
        "<extra></extra>"
    )

    highlighted = work["OW_NFZ"].isin(selected_ow) | work["Miejscowość"].isin(selected_cities)

    def add(part: pd.DataFrame, name: str, marker: dict):
        if part.empty:
            return
        fig.add_trace(go.Scatter(
            x=part[x_col], y=part[y_col], mode="markers", name=name,
            marker=marker, customdata=custom(part), hovertemplate=hover,
        ))

    add(work[~highlighted], "Pozostałe placówki", dict(color="#C7CBD1", size=9, opacity=0.68))

    for region in selected_ow:
        part = work[(work["OW_NFZ"] == region) & (~work["Miejscowość"].isin(selected_cities))]
        add(
            part,
            region_names.get(region, f"OW NFZ {region}"),
            dict(color=region_color_map[region], size=11, opacity=0.94),
        )

    for city in selected_cities:
        part = work[work["Miejscowość"] == city]
        add(
            part,
            city,
            dict(color=city_color_map[city], size=12, opacity=0.96, line=dict(width=1, color="#4B5563")),
        )

    shared_range = _shared_axis_range_with_padding(work[x_col], work[y_col])
    fig.add_shape(
        type="line",
        x0=shared_range[0],
        y0=shared_range[0],
        x1=shared_range[1],
        y1=shared_range[1],
        line=dict(color="#9CA3AF", width=1.5, dash="dash"),
        layer="below",
    )

    fig.update_layout(
        template="plotly_white",
        xaxis_title=x_title,
        yaxis_title=y_title,
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(color="#172033", family="Arial"),
        hoverlabel=dict(bgcolor="#FFFFFF", font_color="#111111", bordercolor="#B8BDC7"),
        showlegend=bool(selected_ow or selected_cities),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0, font=dict(color="#111111")),
        margin=dict(l=20, r=20, t=70 if (selected_ow or selected_cities) else 30, b=50),
        height=650,
    )
    fig.update_xaxes(
        range=list(shared_range),
        showgrid=True, gridcolor="#EEF1F5", zeroline=False, linecolor="#6B7280",
    )
    fig.update_yaxes(
        range=list(shared_range),
        showgrid=True, gridcolor="#EEF1F5", zeroline=False, linecolor="#6B7280",
    )
    return fig

def _scatter_x_config(x_axis_mode: str) -> tuple[str, str, str]:
    if x_axis_mode == X_AXIS_PER_100K:
        return (
            "hospitalizacje_na_100k",
            "Liczba hospitalizacji / 100 000 mieszkańców",
            "Hospitalizacje / 100 000 mieszkańców: %{x:,.2f}",
        )
    return (
        "hospitalizacje_ogolem",
        "Liczba hospitalizacji",
        "Hospitalizacje: %{x:,.0f}",
    )


def make_scatter(
    df: pd.DataFrame,
    selected_ow: list[str],
    selected_products: list[str],
    selected_cities: list[str],
    region_names: dict[str, str],
    colors: list[str],
    symbols: list[str],
    product_legend_label: Callable[[str], str],
    x_axis_mode: str = X_AXIS_TOTAL,
):
    fig = go.Figure()
    work = df.copy()
    work["OW_NFZ"] = work["OW_NFZ"].astype(str).str.zfill(2)
    work["KOD_PRODUKTU_JEDNOSTKOWEGO"] = work["KOD_PRODUKTU_JEDNOSTKOWEGO"].astype(str)

    selected_ow = [str(x).zfill(2) for x in selected_ow]
    selected_products = [str(x) for x in selected_products]
    selected_cities = [str(x).strip() for x in selected_cities if str(x).strip()]

    color_map, city_color_map = _geography_color_maps(selected_ow, selected_cities, colors)
    symbol_map = {
        x: ("circle" if len(selected_products) == 1 else symbols[i % len(symbols)])
        for i, x in enumerate(selected_products)
    }

    x_column, x_title, x_hover = _scatter_x_config(x_axis_mode)
    cols = [
        "Świadczeniodawca",
        "NIP_PODMIOTU",
        "OW_NFZ",
        "Województwo",
        "Miejscowość",
        "zgony",
        "KOD_PRODUKTU_JEDNOSTKOWEGO",
        "hospitalizacje_ogolem",
        "hospitalizacje_na_100k",
        "ludnosc_wojewodztwa",
    ]
    hover = (
        "<b>%{customdata[0]}</b><br>"
        "NIP: %{customdata[1]}<br>"
        "OW NFZ: %{customdata[2]}<br>"
        "Województwo: %{customdata[3]}<br>"
        "Miejscowość: %{customdata[4]}<br>"
        "Produkt: %{customdata[6]}<br>"
        f"{x_hover}<br>"
        "Hospitalizacje ogółem: %{customdata[7]:,.0f}<br>"
        "Hospitalizacje / 100 000: %{customdata[8]:,.2f}<br>"
        "Ludność województwa: %{customdata[9]:,.0f}<br>"
        "Zgony: %{customdata[5]:,.0f}<br>"
        "Śmiertelność: %{y:.2f}%<extra></extra>"
    )

    highlighted = work["OW_NFZ"].isin(selected_ow) | work["Miejscowość"].astype(str).str.strip().isin(selected_cities)

    def add(part: pd.DataFrame, name: str, marker: dict, legendgroup: str | None = None):
        if part.empty:
            return
        fig.add_trace(
            go.Scatter(
                x=part[x_column],
                y=part["smiertelnosc_proc"],
                mode="markers",
                name=name,
                legendgroup=legendgroup,
                marker=marker,
                customdata=part[cols],
                hovertemplate=hover,
            )
        )

    for product in selected_products:
        part = work[(~highlighted) & (work["KOD_PRODUKTU_JEDNOSTKOWEGO"] == product)]
        add(
            part,
            f"Pozostałe · {product_legend_label(product)}",
            dict(color="#C7CBD1", symbol=symbol_map[product], size=9, opacity=0.68),
            f"product-{product}",
        )

    for region in selected_ow:
        for product in selected_products:
            part = work[
                (work["OW_NFZ"] == region)
                & (~work["Miejscowość"].astype(str).str.strip().isin(selected_cities))
                & (work["KOD_PRODUKTU_JEDNOSTKOWEGO"] == product)
            ]
            add(
                part,
                f"{region_names.get(region, f'OW NFZ {region}')} · {product_legend_label(product)}",
                dict(color=color_map[region], symbol=symbol_map[product], size=11, opacity=0.94),
            )

    for city in selected_cities:
        for product in selected_products:
            part = work[
                (work["Miejscowość"].astype(str).str.strip() == city)
                & (work["KOD_PRODUKTU_JEDNOSTKOWEGO"] == product)
            ]
            add(
                part,
                f"{city} · {product_legend_label(product)}",
                dict(
                    color=city_color_map[city],
                    symbol=symbol_map[product],
                    size=12,
                    opacity=0.96,
                    line=dict(width=1, color="#4B5563"),
                ),
            )

    fig.update_layout(
        template="plotly_white",
        xaxis_title=x_title,
        yaxis_title="Śmiertelność (%)",
        hovermode="closest",
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font=dict(color="#172033", family="Arial"),
        hoverlabel=dict(bgcolor="#FFFFFF", font_color="#111111", bordercolor="#B8BDC7"),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="left",
            x=0,
            font=dict(color="#111111"),
        ),
        margin=dict(l=20, r=20, t=70, b=20),
        height=650,
    )
    fig.update_xaxes(
        showgrid=True,
        gridcolor="#EEF1F5",
        zeroline=False,
        linecolor="#6B7280",
        tickfont=dict(color="#111111"),
        title_font=dict(color="#111111"),
    )
    fig.update_yaxes(
        showgrid=True,
        gridcolor="#EEF1F5",
        zeroline=False,
        linecolor="#6B7280",
        tickfont=dict(color="#111111"),
        title_font=dict(color="#111111"),
    )
    return fig
