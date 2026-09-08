# Ludność województw — źródło i import do SQLite

## Źródło

Dane ludności używane do przeliczenia liczby hospitalizacji na 100 000 mieszkańców pochodzą z publikacji Głównego Urzędu Statystycznego **„Rocznik Statystyczny Województw 2025”**.

Strona publikacji:
https://stat.gov.pl/obszary-tematyczne/roczniki-statystyczne/roczniki-statystyczne/rocznik-statystyczny-wojewodztw-2025,4,20.html

W repozytorium zachowano wykorzystany plik wejściowy:

`data_sources/gus/Dzial_04_Ludnosc.xlsx`

W pliku wykorzystywany jest pierwszy arkusz **`1 (19)`** i tabela:

**TABL. 1 (19). LUDNOŚĆ W 2024 R. — Stan w dniu 31 grudnia**.

Do dashboardu pobierana jest kolumna **„Ogółem”**, której jednostką w arkuszu jest **tys. osób**. Wartości są mnożone przez 1000 i zapisywane w SQLite jako liczba osób. Przykładowo wartość `5508,3` dla województwa mazowieckiego oznacza `5 508 300` mieszkańców.

Publikacja została opublikowana przez GUS 30.12.2025. Dane w tej konkretnej tabeli opisują stan ludności na **31.12.2024**.

## Tabela w bazie

Dane trafiają do tabeli:

`population_voivodeship`

Tabela przechowuje 16 województw oraz metadane źródłowe, m.in. datę referencyjną, nazwę publikacji, arkusz, tabelę, jednostkę, nazwę pliku i URL źródłowy.

Kluczem jest `ow_nfz`, dzięki czemu ludność może być jednoznacznie dołączona do danych placówki według województwa odpowiadającego OW NFZ.

## Import / aktualizacja

Po podmianie pliku XLSX uruchom:

```bash
poetry run python -m db_build.import_population
```

Skrypt:

1. odczytuje arkusz `1 (19)`,
2. znajduje wiersz `POLSKA` oraz 16 województw,
3. odczytuje kolumnę `Ogółem`,
4. zamienia wartości z tysięcy osób na osoby,
5. dopasowuje nazwy województw do `nfz_regions`,
6. sprawdza kompletność 16 województw i zgodność sumy województw z pozycją Polska,
7. odtwarza tabelę zgodnie z `db_build/sql/create_population.sql`,
8. zapisuje dane i metadane źródłowe do `health_dashboard.db`.

Pełny rebuild przez `db_build/build_db.py` również uruchamia import ludności na końcu procesu.

## Wskaźnik hospitalizacji / 100 000

Dla każdego punktu pierwszego wykresu liczony jest wskaźnik:

`hospitalizacje placówki / liczba mieszkańców województwa × 100 000`

Mianownik jest przypisany według **OW NFZ placówki**. Nie jest to więc wskaźnik hospitalizacji mieszkańców danego województwa według miejsca zamieszkania pacjenta. To normalizacja wolumenu placówki względem populacji województwa, w którym placówka jest przypisana do OW NFZ. Należy to uwzględniać przy interpretacji, zwłaszcza dla placówek przyjmujących pacjentów ponadregionalnie.
