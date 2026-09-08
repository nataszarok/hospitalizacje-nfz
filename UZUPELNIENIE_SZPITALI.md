# Uzupełnienie danych świadczeniodawców

- `szpitale` — surowa tabela z pliku PSZ.
- `szpitale_psz_unique` — tabela PSZ zdeduplikowana do jednego rekordu na NIP, analogicznie do logiki z notebooka.
- `szpitale_uzupelnienie` — 125 zweryfikowanych wpisów NIP / świadczeniodawca / miejscowość z przekazanej tabeli.
- `szpitale_laczone` — finalny słownik używany przez aplikację; jeden rekord na NIP, z priorytetem danych uzupełniających nad PSZ.

Dla wpisów z wieloma miejscowościami wybrano jedną zgodnie z instrukcją: większą miejscowość (Warszawa zamiast Katowic, Żory zamiast Ustronia, Łódź zamiast Konstantynowa Łódzkiego, Środa Wielkopolska zamiast Dąbrówki).

Integralność: `szpitale_laczone.NIP` ma unikalny indeks, więc join do `hospitalizacje` nie może zwielokrotniać rekordów.
