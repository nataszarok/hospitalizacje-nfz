# Etap 2 — warstwa servingowa bez `hospitalizacje`

## Wniosek

Publiczny runtime nie potrzebuje tabeli `hospitalizacje`. Dla filtrów obecnie widocznych w UI wystarcza agregat o ziarnie:

`(OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO, PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI, KOD_TRYBU_PRZYJECIA)`.

Tabela `dashboard_facility_product_duration_admission` przechowuje cztery addytywne miary: `HOSP_MIN`, `HOSP_NUM`, `DEATHS_MIN`, `DEATHS_NUM`.

Baseline ignorujący długość pobytu otrzymujemy przez sumowanie wszystkich wartości `PRZEDZIAL...`. Próg minimalnej liczby hospitalizacji jest nakładany dopiero po agregacji do placówki, więc nie wymaga osobnej tabeli.

## Wynik audytu

- `hospitalizacje`: 3 881 675 wierszy.
- nowy agregat servingowy: 543 633 wiersze (14,0% liczby wierszy raw).
- 100 losowych kontroli parity (seed 42), dla obu metod `<5`, 1–3 produktów, 1–4 przedziałów długości oraz trybów przyjęcia 2/3/6: pełna zgodność z `hospitalizacje`.

## Tabele potrzebne w produkcyjnym PostgreSQL

- `dashboard_facility_product_duration_admission`
- `nfz_swiadczeniodawcy_unique`
- `produkty_jgp`
- `population_voivodeship`
- `nfz_regions`
- `admission_modes`
- `app_config`

`highlight_palette` i `product_symbols` mogą zostać przeniesione do TypeScriptu jako konfiguracja UI. `filter_values` nie jest konieczne: opcje długości i produktów można odczytać z tabel servingowych/referencyjnych.

## Granica kompatybilności

Ukryte obecnie filtry (`contracts`, `discharge`, `months`, `sex`, `age`) nadal wymagają raw `hospitalizacje`. Nie przenosimy ich do wersji publicznej, dopóki nie zdecydujemy o ponownym udostępnieniu któregoś z nich. Jeśli wrócą, trzeba rozszerzyć serving grain lub dodać osobny agregat.
