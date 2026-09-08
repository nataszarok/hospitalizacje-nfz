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
) -> SidebarState:
    with st.sidebar:
        st.markdown("## Panel filtrów")

        # 1. Zakres świadczeń
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
            max_selections=5,
            help="Lista pokazuje kod, JGP i nazwę produktu. Możesz wybrać maksymalnie 5 produktów.",
        )
        if len(selected_products) > 1:
            st.caption(
                "Kształt punktu oznacza produkt; kolor oznacza wybraną geografię."
            )

        # 2. Wyróżnienie geograficzne
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Wyróżnienie geograficzne</div>',
            unsafe_allow_html=True,
        )
        view_mode = (
            st.segmented_control(
                "Wyróżnienie geograficzne",
                ["Województwa", "Miasta"],
                default="Województwa",
                selection_mode="single",
                key="view_mode",
                label_visibility="collapsed",
            )
            or "Województwa"
        )
        if view_mode == "Województwa":
            selected_regions = st.multiselect(
                "Województwa do wyróżnienia",
                list(region_name_to_code),
                max_selections=5,
                key="region_sidebar_selector",
                help="Możesz wyróżnić maksymalnie 5 województw jednocześnie.",
            )
            selected_ow = [region_name_to_code[x] for x in selected_regions]
            selected_cities = []
        else:
            selected_cities = st.multiselect(
                "Miejscowości do wyróżnienia",
                distinct_cities(),
                placeholder="Wybierz maksymalnie 5 miast",
                max_selections=5,
                key="city_sidebar_selector",
                help="Możesz wyróżnić maksymalnie 5 miast jednocześnie.",
            )
            selected_ow = []

        # 3. Filtry
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Filtry</div>',
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
        duration = st.multiselect(
            "Przedział długości hospitalizacji",
            distinct_values("PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI"),
            help=(
                "Filtr jest stosowany przed progiem wolumenu, dlatego oba ustawienia "
                "mogą jednocześnie zmieniać wartości KPI nad wykresem."
            ),
        )

        # Filtry dodatkowe są tymczasowo ukryte w interfejsie.
        # Zachowujemy neutralne wartości, żeby logika zapytań pozostała bez zmian.
        contracts: list[str] = []
        discharge: list[str] = []
        months: list[str] = []
        sex: list[str] = []
        age: list[str] = []

        # TODO: przywrócić w razie potrzeby:
        # with st.expander("Filtry dodatkowe"):
        #     contracts = st.multiselect(
        #         "Kod produktu kontraktowego",
        #         distinct_values("KOD_PRODUKTU_KONTRAKTOWEGO"),
        #     )
        #     discharge = st.multiselect(
        #         "Kod trybu wypisu", distinct_values("KOD_TRYBU_WYPISU")
        #     )
        #     months = st.multiselect("Miesiąc", distinct_values("MIESIAC"))
        #     sex = st.multiselect(
        #         "Płeć pacjenta", distinct_values("PLEC_PACJENTA")
        #     )
        #     age = st.multiselect(
        #         "Grupa wiekowa", distinct_values("GRUPA_WIEKOWA_PACJENTA")
        #     )

        # 4. Estymacja wartości ukrytych
        st.divider()
        st.markdown(
            '<div class="sidebar-kicker">Estymacja wartości ukrytych</div>',
            unsafe_allow_html=True,
        )
        method = st.selectbox(
            "Wartości <5",
            [
                "Symulacyjna: losowanie 1–4",
                "Konserwatywna: każde <5 = 1",
            ],
            index=1,
            help=(
                "Dane źródłowe nie podają dokładnej liczby hospitalizacji dla komórek "
                "oznaczonych jako <5. Metoda konserwatywna zastępuje każdą taką wartość "
                "liczbą 1. Metoda symulacyjna przypisuje wartości 1–4 z ustalonego losowania "
                "zapisanego w bazie (seed 42); mniejsze wartości są bardziej prawdopodobne, "
                "zgodnie z wagami proporcjonalnymi do exp(-x). Wybór metody wpływa także "
                "na liczbę zgonów, gdy rekord z wartością <5 dotyczy trybu wypisu 9."
            ),
        )

    return SidebarState(
        method,
        selected_products,
        [],  # Filtr trybu przyjęcia został usunięty z panelu bocznego.
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
