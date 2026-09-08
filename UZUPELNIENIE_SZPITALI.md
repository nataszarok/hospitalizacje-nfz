# Uzupełnienie danych świadczeniodawców

- `szpitale` — surowa tabela z pliku PSZ.
- `szpitale_psz_unique` — tabela PSZ zdeduplikowana do jednego rekordu na NIP, analogicznie do logiki z notebooka.
- `szpitale_uzupelnienie` — 125 zweryfikowanych wpisów NIP / świadczeniodawca / miejscowość z przekazanej tabeli.
- `szpitale_laczone` — finalny słownik używany przez aplikację; jeden rekord na NIP, z priorytetem danych uzupełniających nad PSZ.

Dla wpisów z wieloma miejscowościami wybrano jedną zgodnie z instrukcją: większą miejscowość (Warszawa zamiast Katowic, Żory zamiast Ustronia, Łódź zamiast Konstantynowa Łódzkiego, Środa Wielkopolska zamiast Dąbrówki).

Integralność: `szpitale_laczone.NIP` ma unikalny indeks, więc join do `hospitalizacje` nie może zwielokrotniać rekordów.

## Główny słownik NFZ 2025

Od tej wersji aplikacja korzysta z tabeli `nfz_swiadczeniodawcy_unique`, budowanej przez `db_build/import_nfz_providers.py` z pliku `data_sources/nfz_swiadczeniodawcy_2025.csv`.

Tabela ma jeden rekord na parę `(oddzial_nfz, nip)` i jest łączona z `hospitalizacje` po `(OW_NFZ, NIP_PODMIOTU)`. Skrypt:
- koryguje OW NFZ dla NIP `6121542507` z `04` na `01`,
- uzupełnia brakujące NIP-y `6151706942` i `5422208990`,
- deduplikuje po `(oddzial_nfz, nip)`,
- zapisuje wynik do SQLite i weryfikuje, że join nie multiplikuje rekordów oraz pokrywa wszystkie placówki z `hospitalizacje`.

Stare tabele `szpitale`, `szpitale_psz_unique`, `szpitale_uzupelnienie` i `szpitale_laczone` pozostają w bazie wyłącznie jako warstwa historyczna/audytowa.
