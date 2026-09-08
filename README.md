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

## Słowniki i konfiguracja w SQLite

Aplikacja nie korzysta już z `kody_produktu_jgp.csv` podczas działania. Konfiguracja i słowniki są odczytywane z `health_dashboard.db`:

- `app_config` — rok analizy, kod zgonu, domyślny produkt, parametry estymacji `<5>`;
- `nfz_regions` — mapowanie OW NFZ → województwo;
- `admission_modes` — opisy trybów przyjęcia;
- `highlight_palette` i `product_symbols` — paleta wyróżnień i symbole produktów;
- `produkty_jgp` — dane z `kody_produktu_jgp.csv`;
- `szpitale_uzupelnienie` — dane z `szpitale_uzupelnienie.csv`;
- `hospitalizacje` — dane z `hospitalizacje_2025.csv.zip`.

Domyślnym produktem jest `5.51.01.0005010` (E10).

## Preagregacja i aktualizacja danych

Dashboard korzysta z materializowanych agregatów SQLite dla najczęstszej ścieżki analizy:
- `dashboard_facility_product` — placówka (OW NFZ + NIP) × produkt,
- `dashboard_facility_product_admission` — placówka × produkt × tryb przyjęcia.

Dzięki temu standardowy widok nie grupuje przy każdym odświeżeniu ~3,9 mln rekordów źródłowych. Filtry szczegółowe (m.in. miesiąc, płeć, wiek, długość hospitalizacji, produkt kontraktowy i tryb wypisu) nadal wymagają tabeli źródłowej, bo zachowanie dowolnych przecięć tych filtrów w jednym małym agregacie nie jest możliwe bez utraty informacji.

Po podmianie/importowaniu nowych danych do `hospitalizacje` **obowiązkowo** uruchom:

```bash
poetry run python refresh_aggregates.py
```

SQL tworzący agregaty znajduje się w `create_aggregates.sql`. Triggery SQLite automatycznie ustawiają `data_pipeline_status.needs_refresh=1` po INSERT/UPDATE/DELETE tabeli `hospitalizacje`. Jeżeli agregaty są nieaktualne, aplikacja zatrzyma się z komunikatem i poda polecenie odświeżenia, zamiast pokazywać stare wyniki.

Pełne zbudowanie bazy przez `build_db.py` również wykonuje `create_aggregates.sql` jako ostatni etap, więc po pełnym rebuildzie osobne odświeżenie nie jest potrzebne.

## Architektura po refaktorze

`app.py` jest wyłącznie cienką warstwą orkiestracji Streamlit. Kod został rozdzielony według odpowiedzialności:

- `dashboard/data/` — dostęp do SQLite, zapytania i cache Streamlit,
- `dashboard/domain/` — analityka, preprocessing i formatowanie słowników bez zależności od UI,
- `dashboard/ui/` — wykresy Plotly, markdown/CSS, komponenty, sidebar i widoki zakładek,
- `sql/` — skrypty SQL, obecnie `create_aggregates.sql`,
- `build_db.py` / `refresh_aggregates.py` — jawne procesy budowy i odświeżania danych.

Po zmianie danych źródłowych nadal należy wykonać `poetry run python refresh_aggregates.py`; skrypt korzysta z `sql/create_aggregates.sql`.

## Ludność województw i hospitalizacje / 100 000 mieszkańców

Pierwszy wykres pozwala przełączać oś X pomiędzy:

- `Liczba hospitalizacji ogółem`,
- `Liczba hospitalizacji / 100 000 mieszkańców`.

Dane ludności pochodzą z GUS, publikacji **Rocznik Statystyczny Województw 2025**, Dział IV „Ludność”, pierwszy arkusz `1 (19)`, **TABL. 1 (19). LUDNOŚĆ W 2024 R. — Stan w dniu 31 grudnia**, kolumna `Ogółem` (w tys. osób). W SQLite wartości są zapisane w osobach w tabeli `population_voivodeship`.

Plik źródłowy użyty do importu:

`data_sources/gus/Dzial_04_Ludnosc.xlsx`

Import / odświeżenie ludności:

```bash
poetry run python import_population.py
```

Schemat tabeli znajduje się w `sql/create_population.sql`. Pełny opis źródła, walidacji i sposobu wyliczania wskaźnika znajduje się w `docs/population_gus.md`.

Wskaźnik jest liczony jako `hospitalizacje placówki / ludność województwa × 100 000`. Województwo jest przypisywane przez OW NFZ placówki; nie jest to miejsce zamieszkania pacjenta.

### Stabilne identyfikatory wariantów osi X

Stan wyboru osi X jest zapisywany pod stabilnymi identyfikatorami (`total`, `per_100k`).
Polskie etykiety są wyłącznie warstwą prezentacyjną (`format_func` w Streamlit), dzięki czemu
zmiana tekstu w UI nie zmienia logiki, kluczy wykresów ani wartości w `session_state`.
Aplikacja zawiera migrację wartości zapisanych przez wcześniejsze wersje, które używały pełnych etykiet.


## Stan widgetów Streamlit

Przełącznik osi X używa wzorca rozdzielającego trwały stan aplikacji od technicznego
stanu widgetu. `prepare_widget_choice()` przywraca wartość widgetu wyłącznie przed jego
utworzeniem, a `sync_widget_choice()` jest callbackiem `on_change` i aktualizuje tylko
stan kanoniczny. Dzięki temu kod nie modyfikuje klucza widgetu po instancjacji, co jest
niezgodne z cyklem życia `st.session_state`.
