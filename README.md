# Hospitalizacje 2025 — panel analityczny

MVP narzędzia do analizy danych o hospitalizacjach w Polsce za 2025 rok. Interfejs obejmuje obecnie moduł wolumenu i śmiertelności oraz moduł trybów przyjęcia; architektura UI jest przygotowana pod kolejne obszary analityczne.

# Health Dashboard — Streamlit + Poetry

## Uruchomienie

```bash
poetry install
poetry run streamlit run app.py
```

Po uruchomieniu otwórz adres pokazany przez Streamlit, zwykle `http://localhost:8501`.

## Zawartość
- `app.py` — aplikacja Streamlit
- `health_dashboard.db` — gotowa baza SQLite
- `build_db.py` — skrypt do ponownego zbudowania bazy z danych źródłowych
- `pyproject.toml` — zależności Poetry
- `.streamlit/config.toml` — konfiguracja Streamlit z jasnym motywem

Aplikacja korzysta z tabeli pomocniczej `filter_values`, dzięki czemu opcje filtrów nie wymagają skanowania całej tabeli hospitalizacji przy każdym starcie.

## Baza danych

Plik `health_dashboard.db` **nie jest dołączony do tej paczki**. Umieść istniejący plik `health_dashboard.db` w katalogu głównym projektu (obok `app.py`) albo zbuduj go ponownie poleceniem:

```bash
poetry run python build_db.py
```

Następnie uruchom aplikację:

```bash
poetry run streamlit run app.py
```

Wykres Plotly ma wymuszony jasny motyw (`theme=None`, białe tło i ciemne napisy), niezależnie od motywu Streamlita/systemu.

## Wyróżnianie województw

Pole `Województwa do wyróżnienia` nie filtruje danych z wykresu. Wszystkie placówki pozostają widoczne, natomiast wybrane województwa dostają osobne kolory, a pozostałe punkty pozostają szare.

Panel po prawej pokazuje dla każdego wybranego województwa:
- średnią śmiertelność placówek,
- średnią liczbę hospitalizacji na placówkę,
- liczbę placówek po zastosowaniu pozostałych filtrów dashboardu.

Mapowanie `OW_NFZ` użyte w aplikacji:
01 Dolnośląskie, 02 Kujawsko-Pomorskie, 03 Lubelskie, 04 Lubuskie, 05 Łódzkie, 06 Małopolskie, 07 Mazowieckie, 08 Opolskie, 09 Podkarpackie, 10 Podlaskie, 11 Pomorskie, 12 Śląskie, 13 Świętokrzyskie, 14 Warmińsko-Mazurskie, 15 Wielkopolskie, 16 Zachodniopomorskie.

## Mapowanie produktów i symbole

Plik `kody_produktu_jgp.csv` jest częścią projektu. W selektorze produktu aplikacja pokazuje:

`KOD_PRODUKTU_JEDNOSTKOWEGO — KOD_JGP — NAZWA`

Do zapytań SQL nadal trafia wyłącznie `KOD_PRODUKTU_JEDNOSTKOWEGO`.

Na wykresie kolor oznacza wyróżnione województwo, a kształt punktu oznacza produkt. Przy jednym wybranym produkcie używane są kółka; przy wielu produktach każdy kod dostaje inny symbol.


## Testy

Logika obliczeniowa jest wydzielona do `dashboard_logic.py`, dzięki czemu można ją testować bez uruchamiania Streamlit.

Uruchomienie pełnego zestawu testów:

```bash
poetry install
poetry run pytest -q
```

`tests/test_dashboard_logic.py` zawiera szybkie testy jednostkowe agregacji, śmiertelności, statystyk per produkt i deduplikacji NIP. `tests/test_database_integrity.py` sprawdza rzeczywistą bazę SQLite, w szczególności unikalność NIP oraz brak zwielokrotnienia danych po JOIN-ie.

## Widok trybu przyjęcia

Aplikacja zawiera osobny tab **Tryb przyjęcia**, porównujący przyjęcia planowane (kod 6) z nagłymi (kody 2 + 3). Wykres może prezentować wartości nominalne albo udziały procentowe liczone w ramach sumy planowane + nagłe. Filtr `Kod trybu przyjęcia` z panelu bocznego celowo nie ogranicza tego porównania; pozostałe filtry są respektowane.
