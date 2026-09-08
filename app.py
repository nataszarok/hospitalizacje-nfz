from pathlib import Path
import streamlit as st

from dashboard.config import DB_PATH
from dashboard.data.loaders import (
    reference_data, pipeline_status, product_mapping, distinct_values, distinct_cities,
    aggregated, admission_comparison, population_by_ow, population_metadata,
)
from dashboard.domain.analytics import filter_by_min_facility_hospitalizations
from dashboard.domain.population import add_population_rate
from dashboard.domain.labels import build_product_meta, product_label, product_legend_label
from dashboard.ui.content import APP_CSS, header_html, about_markdown, footer_html
from dashboard.ui.sidebar import render_sidebar
from dashboard.ui.views import render_mortality, render_admissions

st.set_page_config(page_title="Hospitalizacje — panel analityczny",page_icon="🏥",layout="wide",initial_sidebar_state="expanded")

if not DB_PATH.exists():
    st.error(f"Nie znaleziono bazy danych: {DB_PATH}"); st.info("Plik health_dashboard.db musi znajdować się w katalogu projektu."); st.stop()

try:
    refs=reference_data(); status=pipeline_status()
    if status is None:
        st.error("Brak materializowanych agregatów dashboardu."); st.code("poetry run python refresh_aggregates.py"); st.stop()
    if int(status[0]) != 0:
        st.error("Dane hospitalizacje zostały zmienione, a agregaty dashboardu są nieaktualne."); st.code("poetry run python refresh_aggregates.py"); st.stop()

    mapping=product_mapping(); product_meta=build_product_meta(mapping)
    population=population_by_ow(); population_meta=population_metadata()
    label=lambda code: product_label(code,product_meta)
    legend=lambda code: product_legend_label(code,product_meta)
    st.markdown(APP_CSS,unsafe_allow_html=True); st.markdown(header_html(refs.analysis_year),unsafe_allow_html=True)
    state=render_sidebar(default_product=refs.default_product_code,region_name_to_code={v:k for k,v in refs.regions.items()},distinct_values=distinct_values,distinct_cities=distinct_cities,product_label=label)
    if not state.selected_products: st.info("Wybierz co najmniej jeden produkt jednostkowy w panelu po lewej."); st.stop()

    filters=state.filters_tuple()
    baseline_filters=state.filters_tuple(exclude={"duration"})
    with st.spinner("Agreguję dane..."):
        result_before_threshold=aggregated(filters,state.method,refs.death_discharge_code,tuple(refs.regions.items()))
        baseline_result=(
            result_before_threshold
            if not state.duration
            else aggregated(baseline_filters,state.method,refs.death_discharge_code,tuple(refs.regions.items()))
        )
    result_before_threshold=add_population_rate(result_before_threshold,population)
    baseline_result=add_population_rate(baseline_result,population)
    result=filter_by_min_facility_hospitalizations(result_before_threshold,state.min_hosp)

    tab_mortality,tab_admissions,tab_about=st.tabs(["Wolumen i śmiertelność","Tryb przyjęcia","Metodologia i dane"])
    with tab_mortality:
        render_mortality(result=result,baseline_result=baseline_result,min_hosp=state.min_hosp,state=state,refs=refs,product_meta=product_meta,product_legend=legend,population_metadata=population_meta)
    with tab_admissions:
        with st.spinner("Agreguję tryby przyjęcia..."):
            admission_data=admission_comparison(filters,state.method)
            baseline_admission_data=(
                admission_data
                if not state.duration
                else admission_comparison(baseline_filters,state.method)
            )
        render_admissions(admission_data=admission_data,baseline_admission_data=baseline_admission_data,min_hosp=state.min_hosp,state=state,refs=refs,population_by_ow=population,population_metadata=population_meta)
    with tab_about:
        st.markdown(about_markdown(refs.analysis_year))
    st.markdown(footer_html(refs.analysis_year),unsafe_allow_html=True)
except Exception as exc:
    st.error("Aplikacja napotkała błąd podczas ładowania danych."); st.exception(exc)
