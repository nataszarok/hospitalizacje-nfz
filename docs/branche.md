# Branche od przebudowy strony głównej

Stan na 1 listopada 2026 r. Opis obejmuje branche od rozpoczęcia przebudowy strony głównej (`feature/homepage`, 28 października 2026 r.).

## W skrócie

- Główna praca to **łańcuch sześciu branchy**. Każdy następny zaczyna się od końca poprzedniego. Najnowszy, `feature/jgp-scatter-linear-axis`, zawiera wszystko z wcześniejszych.
- **Żaden branch z łańcucha nie jest jeszcze w `main`.**
- Obok łańcucha są trzy **branche boczne**. Dwa z nich (porównanie szpitali i suwak odległości par) są już w `main` jako PR #16 i #18.

## Schemat

```mermaid
gitGraph
  commit id: "1f5c602 (#15)"
  branch feature/hospital-comparison
  commit id: "73ccb08 porównanie par"
  checkout main
  branch feature/homepage
  commit id: "ed69463 strona główna"
  commit id: "4f99772 teksty portalu"
  checkout main
  commit id: "a28cbcd (#16) porównanie par"
  checkout feature/homepage
  merge main id: "d5b5540 merge main"
  branch feature/analizy-redesign
  commit id: "735e947 dane 2024–2025"
  commit id: "e4fc085 nowe /analizy"
  commit id: "4c0a2da filtr obszaru"
  branch feature/portal-search
  commit id: "89da7a4 wyszukiwarka"
  branch feature/jgp-card-complete
  commit id: "c5f1901 karta E10"
  commit id: "17e16ba mapa, poprawki"
  branch feature/jgp-catalog
  commit id: "d123c6d karty wszystkich grup"
  branch feature/jgp-scatter-linear-axis
  commit id: "20d590b oś liniowa"
  commit id: "7729234 docs: karty JGP"
  checkout main
  branch feature/sanok-kody-e
  commit id: "af22fe9 /sanok-kody-e"
  commit id: "cf5008d /sanok-szpital"
  checkout main
  branch feature/peer-distance-slider
  commit id: "baffed7 suwak par"
  checkout main
  merge feature/peer-distance-slider id: "9c5ca4d (#18)"
```

Ten sam układ w prostszej formie:

```text
main (1f5c602, #15)
 ├─ feature/hospital-comparison ──────────────► w main jako #16 (a28cbcd)
 ├─ feature/homepage  (+ merge main z #16)
 │   └─ feature/analizy-redesign
 │       └─ feature/portal-search
 │           └─ feature/jgp-card-complete
 │               └─ feature/jgp-catalog
 │                   └─ feature/jgp-scatter-linear-axis   ← tu pracujemy
 │
main (a28cbcd, #16)
 ├─ feature/sanok-kody-e                       (osobna strona, poza łańcuchem)
 └─ feature/peer-distance-slider ─────────────► w main jako #18 (9c5ca4d)
```

## Łańcuch główny

| # | Branch | Wychodzi z | Co wnosi | Ostatni commit |
|---|---|---|---|---|
| 1 | `feature/homepage` | `main` (1f5c602), potem merge `main` z #16 | strona główna portalu, panel przeniesiony do `/analizy`, `CLAUDE.md`, ilustracja hero, teksty o publicznej ochronie zdrowia | d5b5540, 29.10 |
| 2 | `feature/analizy-redesign` | `feature/homepage` | dane z lat 2024–2025 i wybór roku, widok „W czasie”, pierwsza strona grupy JGP, nowe `/analizy` (eksplorator pytań), szpitale poza `/analizy`, filtr obszaru | 4c0a2da, 30.10 |
| 3 | `feature/portal-search` | `feature/analizy-redesign` | wyszukiwarka grup JGP i szpitali (etap 1 roadmapy) | 89da7a4, 30.10 |
| 4 | `feature/jgp-card-complete` | `feature/portal-search` | pełna karta E10 (etap 2), mapa województw, dane budowane skryptami w `scripts/`, paleta (zielony interfejs, niebieskie dane) | 17e16ba, 31.10 |
| 5 | `feature/jgp-catalog` | `feature/jgp-card-complete` | karty wszystkich grup JGP i katalog `/jgp` (etap 3) | d123c6d, 31.10 |
| 6 | `feature/jgp-scatter-linear-axis` | `feature/jgp-catalog` | oś liniowa na wykresach punktowych karty; dokumenty koncepcyjne kart w `docs/` | 7729234, 1.11 |

Każdy branch zawiera wszystkie wcześniejsze. `feature/jgp-scatter-linear-axis` ma 24 commity ponad `origin/main`.

## Branche boczne

| Branch | Wychodzi z | Co wnosi | Stan |
|---|---|---|---|
| `feature/hospital-comparison` | `main` (1f5c602) | porównanie szpitala z parami z modelu A/B | w `main` jako PR #16 (a28cbcd); łańcuch ma tę zmianę przez merge w `feature/homepage` |
| `feature/peer-distance-slider` | `main` (a28cbcd) | suwak odległości par w porównaniu szpitali | w `main` jako PR #18 (9c5ca4d); **łańcuch tej zmiany nie ma** |
| `feature/sanok-kody-e` | `main` (a28cbcd) | strony `/sanok-kody-e` i `/sanok-szpital` (SP ZOZ Sanok) | niezależny od łańcucha, nie jest w `main` |

## Co z tego wynika przy scalaniu do `main`

1. **Najprościej: jeden PR z `feature/jgp-scatter-linear-axis`.** Zawiera cały łańcuch. Osobne PR-y dla każdego branchu z kolejnym squash merge powodują konflikty w następnych branchach, bo squash zmienia historię.
2. **Przed PR trzeba dołączyć `main` z #18** (suwak par). #18 i łańcuch zmieniają te same pliki: `src/components/Dashboard.tsx`, `src/components/HospitalAnalysisBase.css`, `src/lib/dashboardUrlState.ts` i jego testy. Możliwe są konflikty.
3. **Lokalny `main` jest nieaktualny** (1f5c602, bez #16 i #18). Przed pracą z `main` trzeba go zaktualizować z `origin/main`.
4. **`feature/sanok-kody-e`** można scalić osobno, niezależnie od łańcucha.
5. **Push do `main` = wdrożenie na Cloudflare Pages.** Do `main` tylko przez PR (squash merge).
