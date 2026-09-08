from __future__ import annotations
import streamlit as st
from .database import (
    connect_readonly, load_reference_data, aggregate_status, load_product_mapping,
    distinct_values as _distinct_values, distinct_cities as _distinct_cities,
    load_aggregated as _load_aggregated, load_admission_comparison as _load_admission_comparison,
)

@st.cache_resource
def get_connection():
    return connect_readonly()

@st.cache_data(show_spinner=False)
def reference_data():
    return load_reference_data(get_connection())

@st.cache_data(show_spinner=False, ttl=60)
def pipeline_status():
    return aggregate_status(get_connection())

@st.cache_data(show_spinner=False)
def product_mapping():
    return load_product_mapping(get_connection())

@st.cache_data(show_spinner=False)
def distinct_values(column: str):
    return _distinct_values(get_connection(), column)

@st.cache_data(show_spinner=False)
def distinct_cities():
    return _distinct_cities(get_connection())

@st.cache_data(show_spinner=False, ttl=3600)
def aggregated(filters: tuple, method: str, death_code: int, region_items: tuple[tuple[str,str], ...]):
    return _load_aggregated(get_connection(), filters, method, death_code, dict(region_items))

@st.cache_data(show_spinner=False, ttl=3600)
def admission_comparison(filters: tuple, method: str):
    return _load_admission_comparison(get_connection(), filters, method)
