from __future__ import annotations

from collections.abc import Callable
import streamlit as st

from dashboard.domain.filters import SidebarState


def render_sidebar(
    *,
    default_product: str,
    region_name_to_code: dict[str, str],
    distinct_values: Callable,
    distinct_cities: Callable,
    product_label: Callable[[str], str],
    admission_label: Callable[[object], str],
) -> SidebarState:
    with st.sidebar:
        # 1. Ustawienia analizy
        st.markdown("## Ustawienia analizy")
        st.caption(
            "Zawęź dane i zdefiniuj kontekst porównania. Filtry obowiązują oba "
            "moduły, z wyjątkiem opisanych odstępstw."
        )

        # 2. Zakres świadczeń
        st.markdown(
            '<div class="sidebar-kicker">Zakres świadczeń</div>',
            unsafe_allow_html=True,
        )
        products = distinct_values("KOD_PRODUKTU_JEDNOSTKOWEGO")
        defaults = [default_product] if default_product in products else []
        selected_products = st.multiselect(
            "Produkt jednostkowy",
            products,
            default=defaults,
            format_func=product_label,
            help="Lista pokazuje kod, JGP i nazwę produktu.",
        )
        if len(selected_products) > 1:
            st.caption(
                "Kształt punktu oznacza produkt; kolor oznacza wybraną geografię."
            )
        admission = st.multiselect(
            "Kod trybu przyjęcia",
            distinct_values("KOD_TRYBU_PRZYJECIA"),
            format_func=admission_label,
        )

        # 3. Wyróżnienie geograficzne
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Wyróżnienie geograficzne</div>',
            unsafe_allow_html=True,
        )
        view_mode = (
            st.segmented_control(
                "Perspektywa",
                ["Województwa", "Miasta"],
                default="Województwa",
                selection_mode="single",
                key="view_mode",
            )
            or "Województwa"
        )
        if view_mode == "Województwa":
            selected_regions = st.multiselect(
                "Województwa do wyróżnienia",
                list(region_name_to_code),
                key="region_sidebar_selector",
            )
            selected_ow = [region_name_to_code[x] for x in selected_regions]
            selected_cities = []
        else:
            selected_cities = st.multiselect(
                "Miejscowości do wyróżnienia",
                distinct_cities(),
                placeholder="Wybierz jedno lub więcej miast",
                key="city_sidebar_selector",
            )
            selected_ow = []

        # 4. Próg wolumenu
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Próg wolumenu</div>',
            unsafe_allow_html=True,
        )
        min_hosp = st.number_input(
            "Minimalna liczba hospitalizacji na placówkę",
            min_value=0,
            value=0,
            step=10,
            help=(
                "Próg jest liczony dla unikalnej pary OW NFZ + NIP po aktualnych "
                "filtrach, w tym po filtrze długości hospitalizacji."
            ),
        )

        # 5. Długość hospitalizacji — świadomie poza filtrem rozwijanym.
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Długość hospitalizacji</div>',
            unsafe_allow_html=True,
        )
        duration = st.multiselect(
            "Przedział długości hospitalizacji",
            distinct_values("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"),
            help=(
                "Filtr jest stosowany przed progiem wolumenu, dlatego oba ustawienia "
                "mogą jednocześnie zmieniać wartości KPI nad wykresem."
            ),
        )

        # 6. Estymacja wartości ukrytych
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Estymacja wartości ukrytych</div>',
            unsafe_allow_html=True,
        )
        method = st.radio(
            "Jak przeliczać wartości oznaczone jako '<5'?",
            [
                "Symulacyjna: losowanie 1–4",
                "Konserwatywna: każde <5 = 1",
            ],
            index=1,
            help=(
                "Metoda konserwatywna przypisuje <5 wartość 1. Metoda symulacyjna "
                "używa zapisanych w bazie wartości 1–4."
            ),
        )
        st.caption(
            "<5 → 1. Najbardziej zachowawcze oszacowanie liczby hospitalizacji."
            if method.startswith("Konserwatywna")
            else "<5 → 1–4. Stałe losowanie zapisane w bazie."
        )

        # 7. Filtry dodatkowe
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Filtry dodatkowe</div>',
            unsafe_allow_html=True,
        )
        with st.expander("Rozwiń filtry dodatkowe"):
            contracts = st.multiselect(
                "Kod produktu kontraktowego",
                distinct_values("KOD_PRODUKTU_KONTRAKTOWEGO"),
            )
            discharge = st.multiselect(
                "Kod trybu wypisu", distinct_values("KOD_TRYBU_WYPISU")
            )
            months = st.multiselect("Miesiąc", distinct_values("MIESIAC"))
            sex = st.multiselect(
                "Płeć pacjenta", distinct_values("PLEC_PACJENTA")
            )
            age = st.multiselect(
                "Grupa wiekowa", distinct_values("GRUPA_WIEKOWA_PACJENTA")
            )

    return SidebarState(
        method,
        selected_products,
        admission,
        selected_ow,
        selected_cities,
        view_mode,
        contracts,
        discharge,
        months,
        sex,
        age,
        duration,
        int(min_hosp),
    )
