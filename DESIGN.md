# DESIGN.md — funduszdanych.pl

System wizualny portalu w jednym miejscu: zasady, tokeny, wzorce komponentów i wykresów.
Dla ludzi i agentów, którzy zmieniają UI. Wersja robocza 0.1 (listopad 2026).

- Idea, znak, paleta z uzasadnieniem: [`brand/brandbook.html`](brand/brandbook.html)
- Język i ton tekstów: [`brand/brand-voice.md`](brand/brand-voice.md)
- Banery: [`brand/baner.html`](brand/baner.html), PNG w `brand/`

Status tokenów w tabelach:
**jest** — token istnieje w kodzie;
**propozycja** — tokenu jeszcze nie ma, kolor dziś jest literałem w plikach.

---

## 1. Zasady

1. **Sterylna precyzja.** Dużo bieli i kafla, mało ozdób. Każdy kolor, ramka i cień ma funkcję.
2. **Zieleń = działanie, błękit = dane.** Zieleń operacyjna oznacza nawigację, linki, przyciski i fokus.
   Serie danych rysujemy w błękitach i granacie. Nie mieszamy tych ról.
3. **Jedno wyróżnienie.** Kolor sygnału (`#C65D2E`) oznacza to, o co pyta czytelnik:
   wybrany ośrodek, ostatni rok, „Ty tu jesteś”. Najwyżej jedno wyróżnienie na wykres.
4. **Liczba z podpisem.** Każda liczba ma jednostkę, okres i źródło. Szacunki mają plakietkę „szacunek”.
5. **Pytanie, liczba, kontekst.** Karta danych: tytuł-pytanie, liczba z wnioskiem, wykres, link do pełnego widoku.
6. **Tokeny, nie literały.** Kolor, rozmiar tekstu i grubość tylko z tokenów.
   Nowa wartość = nowy token w `globals.css` / `portal.css`, nie wartość w pliku komponentu.
7. **Komponenty niezależne od strony.** Komponent działa w eksploratorze, na karcie JGP i na stronie głównej
   (wzór: `TrendView`). Układ strony należy do strony, wygląd do komponentu.

---

## 2. Kolory

### 2.1 Rdzeń: sterylność (interfejs)

| Token | Wartość | Nazwa | Użycie | Status |
|---|---|---|---|---|
| `--color-primary` | `#087F75` | Zieleń operacyjna | Znak, aktywna zakładka, ikony, przyciski | jest |
| `--color-primary-hover` | `#076B63` | | Tekst linków, hover | jest |
| `--color-primary-active` | `#055850` | | Stan wciśnięty | jest |
| `--color-primary-soft` | `#E9F6F2` | | Tło ikon, aktywny wiersz, hover chipów | jest |
| `--color-primary-outline` | `#B9DDD4` | | Obrys elementów aktywnych | jest |
| `--color-focus-ring` | `rgba(8,127,117,.22)` | | Pierścień fokusu | jest |
| `--color-background` | `#FFFFFF` | Biel fartucha | Tło treści i kart | jest |
| `--color-background-soft` | `#F3F8F7` | Kafel | Hero, stopka, panel boczny | jest |
| `--color-background-muted` | `#EDF4F1` | | Elementy nieaktywne, plakietka „Planowane” | jest |
| `--color-text` | `#253B3A` | Grafit | Tekst główny | jest |
| `--color-text-secondary` | `#536C68` | | Opisy, wstępy | jest |
| `--color-text-tertiary` | `#6C827E` | | Etykiety, przypisy | jest |
| `--color-border` | `#D9E6E3` | | Ramki kart, linie tabel | jest |
| `--color-border-strong` | `#B9CEC9` | | Chipy, separatory faktów | jest |
| `--color-error` / `-soft` | `#B42318` / `#FFF4F2` | Alarm | Tylko błędy | jest |

Mantine: paleta `atlas` w `src/app/layout.tsx` (odcienie 0–9, `primaryShade: 7` = `#087F75`).

### 2.2 Rozszerzenie: uniformy (dane i wyróżnienia)

| Token | Wartość | Nazwa (źródło) | Użycie | Status |
|---|---|---|---|---|
| `--color-data-strong` | `#1B3D78` | Granat pielęgniarski | Liczby kluczowe (`.compareFacts dd`), seria nr 1 skali | propozycja |
| `--color-data` | `#2856A3` | Błękit danych | Główna seria wykresów, przyjęcia nagłe, „zysk” | propozycja (`--data` w `globals.css`) |
| `--color-data-soft` | `#9DB4DB` | Błękit fartucha | Druga seria, wartości tła | propozycja |
| `--color-data-muted` | `#B5C7E6` | | Przyjęcia planowe | propozycja |
| `--color-data-faint` | `#E4EAF4` | | Pozostałe, tło słupków | propozycja |
| `--color-signal` | `#C65D2E` | Sygnał ratowniczy | Wybrany ośrodek, ostatni rok, „strata” | propozycja |
| `--color-estimate-bg` / `-fg` | `#FFF4E0` / `#8A5300` | | Plakietka „szacunek” | propozycja |
| `--color-positive` | `#1D6B3A` | | Zmiana na plus w tekście | propozycja |

### 2.3 Kolory serii do porównań

`REGION_PICK_COLORS` w `src/lib/chartPalette.ts`: `#7B3FA0`, `#1A9850`, `#D6338A`, `#B88A00`, `#0097A7`, `#9A5B13`.
Do 6 województw lub miast naraz. Bez czerwieni i pomarańczu (zarezerwowane dla sygnału i błędu).
Punkty tła: `BASE_POINT` (błękit 55%), punkty spoza wyboru: `OTHER_POINT` (szary 50%).

### 2.4 Proporcje

Biel i kafel ok. 70%, grafit (tekst) ok. 15%, zieleń ok. 7%, błękity ok. 5%, sygnał do 2%.
Jeśli ekran wygląda „zielono”, zieleń jest użyta jako dekoracja. Zamień ją na grafit lub kafel.

---

## 3. Typografia

Kroje z `next/font` w `src/app/layout.tsx`:

| Zmienna | Krój | Grubości | Użycie |
|---|---|---|---|
| `--font-display` | Inter Tight | 400, 500 | Marka, menu, `h1`, tytuły sekcji, hero |
| `--font-body` | Inter | zmienny | Tekst, tabele, wykresy, liczby |

Skala w `src/app/globals.css` (pilnuje jej test `src/app/__tests__/typographyTokens.test.ts`):

| Token | Wartość | Użycie |
|---|---|---|
| `--fs-2xs` | 10px | Mikroetykiety w panelu bocznym |
| `--fs-xs` | 11px | Plakietki, przypisy tabel |
| `--fs-sm` | 12px | Etykiety wersalikami, legendy |
| `--fs-md` | 13px | Podpowiedzi, opisy faktów |
| `--fs-base` | 14px | Tekst interfejsu |
| `--fs-lg` | 16px | Tekst czytany (wstępy, opisy kart) |
| `--fs-xl` | 18px | Tytuły kart, logotyp |
| `--fs-2xl` | 22px | Liczby w kafelkach faktów |
| `--fs-3xl` | 28px | Duże liczby, numery ścieżek |
| `--fs-section` | clamp(26–32px) | `h2` sekcji |
| `--fs-title` | clamp(28–36px) | `h1` modułu (`PageHeader`) |
| `--fs-hero` | clamp(34–56px) | `h1` strony głównej |

Grubości: `--fw-regular` 400, `--fw-medium` 500, `--fw-semibold` 600, `--fw-bold` 700.

Reguły:

- Tytuły krojem display: grubość 400, odstęp liter od −.035em do −.045em, interlinia 1,02–1,08.
- Etykiety nad tytułem (eyebrow): `--fs-sm`, 700, wersaliki, odstęp liter .10–.12em, kolor `--color-primary-hover`.
- Liczby: Inter 700, `font-variant-numeric: tabular-nums` w tabelach i kolumnach liczb.
- Tekst czytany: `--fs-lg`, interlinia 1,6–1,7, szerokość do ok. 680 px.
- Polska typografia: przecinek dziesiętny, spacja tysięcy, półpauza w zakresie lat, minus `−`.
  Formatowanie liczb: funkcje w `src/lib/` (np. `formatCompactCount`, `formatYearRange`), nie ręcznie.

---

## 4. Układ, odstępy, kształt

| Token | Wartość | Użycie |
|---|---|---|
| `--atlas-page-max` | 1240px | Szerokość stron portalu (strona główna to wzorzec) |
| `--atlas-workspace-max` | 1680px | Eksplorator i raporty z wykresami |
| `--atlas-page-gutter` | 40 / 26 / 16px | Margines boczny (>1100 / ≤1100 / ≤550 px) |
| `--atlas-workspace-gap` | 24px | Odstęp panelu bocznego od treści |
| `--radius-card` | 12px | Karty, kafelki faktów, ramki wykresów |
| `--radius-control` | 9px | Pola, przyciski, przełączniki |
| `--shadow-soft` | `0 2px 8px rgba(22,58,52,.055)` | Karty nad tłem |

- Odstępy sekcji strony głównej: 64 px (48 px na telefonie). Siatka odstępów: wielokrotności 4 px.
- Karta (ramka + promień + cień) tylko dla obiektu, który czytelnik traktuje osobno: karta danych, kafelek faktu.
  Listy i sekcje oddzielamy linią (`border-top`), nie kartą (wzór: lista działów, ścieżki „Od czego zacząć”).
- Chip: promień 999px, ramka `--color-border-strong`, hover = `--color-primary-soft`.
- Punkty przełamania w kodzie: 1360, 1220, 1100, 1060, 800, 550 px.

---

## 5. Znak i ikony

- Symbol: serce z linią EKG, biały kontur 2 px na kaflu `--color-primary`, promień ok. 22% boku.
  Źródło: `src/app/icon.svg` (favicon), wersja w nagłówku w `SiteHeader`.
- Logotyp: `funduszdanych.pl` małymi literami, Inter Tight 400, odstęp −.045em. Nazwa w `src/lib/site.ts` (`SITE_NAME`).
- Pole ochronne: ¼ boku kafla. Minimalny rozmiar: 16 px.
- Ikony: `PortalIcon` (`src/components/portal/PortalIcon.tsx`), siatka 24 px, kontur 1,75, zaokrąglone końce.
  Ikona w kaflu: 40–56 px, promień 10–12 px, tło `--color-primary-soft`, kolor `--color-primary`.
  Nowa ikona = nowy wpis w `PortalIcon`, nie osobny plik SVG. Bez ikon wypełnionych i emoji.

---

## 6. Wykresy

- Biblioteki: Plotly (`plotly.js-dist-min`) w widokach analitycznych; własne SVG na stronie głównej (`HomeCharts`).
- Docelowo jeden motyw Plotly w `src/lib/plotlyChart.ts` (dziś `getCommonPlotLayout` mają tylko `MortalityChart`
  i `AdmissionChart`; pozostałe wykresy ustawiają kolory same).
- Seria główna: `--color-data` (`#2856A3`). Skala sekwencyjna: granat → błękit → błękit fartucha → `#E4EAF4`.
- Wyróżnienie: `--color-signal`, jedno na wykres.
- Oś wartości od zera dla słupków. Tekst osi i legend: `--fs-sm` / `--fs-xs`, kolor `--color-text-tertiary`.
- Dymek (hover): tło `--color-text`, biały tekst 13 px, liczby po polsku.
- Pod wykresem: źródło, jednostka, uwaga o szacunku. Legenda jest dodatkiem: seria ma też podpis przy linii lub w tytule.
- Mapy: skala błękitów dla wartości, kolory `REGION_PICK_COLORS` dla wybranych obszarów.
- Kolor nie jest jedynym nośnikiem informacji (daltonizm): podpis, kształt lub pozycja.

### 6.1 Siatka: tylko na osi, która jest miarą

| Typ wykresu | Gdzie | Linie poziome | Linie pionowe |
|---|---|---|---|
| Słupki w latach | Strona główna, karta JGP „Ile?” (Lata) | tak | nie (oś lat to kategorie) |
| Linia w miesiącach | „W czasie”, karta JGP „Ile?” (Miesiące) | tak | tylko granica roku (`dtick: "M12"`) |
| Punktowy | Eksplorator „Kto leczy”, „Tryb przyjęcia”; `ProviderScatter` | tak | tak (obie osie to miary) |
| Udziały (paski 100%) | Tryb przyjęcia w podsumowaniu | nie | opcjonalnie co 25% |
| Mapa, mapa drzewa | „Gdzie”, profil szpitala | brak | brak |

### 6.2 Rodzaje linii

| Linia | Wygląd | Użycie |
|---|---|---|
| Siatka | ciągła 1 px, `--color-chart-grid` (`#E6EFEC`) | podziałka osi-miary |
| Podstawa / zero | ciągła 1,5 px, `--color-border-strong` | zero osi wartości, gdy jest w zakresie |
| Odniesienie | kropkowana 1 px, `--color-text-secondary` | średnia kraju, mediana (`reference` w `ProviderScatter`) |
| Granica | przerywana 1,2 px, `--color-text-tertiary` | granice lejka, przedziały (`curves` w `ProviderScatter`) |

Linia pionowa jest siatką osi-miary albo znacznikiem zdarzenia (granica roku, zmiana wyceny). Nie jest ozdobą.

### 6.2a Status i wyróżnienie

- **Skala odchylenia** (lejek, różnica wobec podobnych): w górę `#E3A27F` (poza 95%) i `#B4441B` (poza 99,8%),
  w dół `#8FB0DD` i `#2856A3`, w granicach `#9DB4DB`. Dziś `FUNNEL_COLORS` w `JgpTabbedCard.tsx`. Zawsze z legendą albo statusem w dymku.
- **Sygnał albo skala odchylenia, nie oba.** Wyróżnienie („ten szpital”) na wykresie bez skali odchylenia: `--color-signal`.
  Na wykresie ze skalą odchylenia: punkt `--color-text` (grafit) z białą obwódką 2,5 px, większy o połowę, z podpisem.
- **Bez legendy** (baner, miniatura, podgląd linku): trzy stopnie błękitu z dużym odstępem jasności — w granicach `#C3D2EB`,
  poza 95% `#6A8FCB`, poza 99,8% `#1B3D78`; w obie strony tak samo.

### 6.3 Dymek (tooltip)

Jeden wzór dla dymków Plotly i HTML (profil szpitala, mapa „Gdzie”, karta JGP). Wzór wizualny: brandbook, sekcja 05.

- Wygląd: tło `#FFFFFF`, ramka `--color-border-strong`, promień 9 px, tekst `--color-text` 13 px, szerokość do 300 px,
  cień „unoszący się”. Plotly: `hoverlabel: { bgcolor: "#FFFFFF", bordercolor: "#B9CEC9", font: { color: "#253B3A", size: 13 }, align: "left" }`.
- Kolejność treści:
  1. Nazwa (pogrubiona, do 2 linii).
  2. Kontekst szarym: miejscowość · województwo · kod JGP.
  3. 2–4 wartości „Etykieta: **wartość**”: najpierw oś Y, potem oś X, potem pozostałe.
  4. Status (opcjonalnie): kolor + słowo, np. „powyżej granicy 99,8%”, „szacunek”.
- Formaty jak na osiach (6.4). Zawsze `<extra></extra>` (bez nazwy serii w osobnej ramce).
- Identyfikatory techniczne (NIP, kod świadczenia) na końcu albo w tabeli, nie na początku.
- `hovermode: "closest"`; jeden dymek naraz.
- **Dymek nie zasłania obiektu**, który opisuje (punkt, słupek, kafel mapy drzewa, województwo), ani obiektu wybranego wcześniej:
  1. Strefa ochronna: promień znacznika + 12 px; dymek zaczyna się za nią, ze strzałką do obiektu.
  2. Kolejność stron: punkt i linia — prawo, lewo, nad, pod; słupek pionowy — nad końcem, potem obok;
     słupek poziomy — za końcem; kafel i obszar mapy — poza krawędzią.
  3. Wygrywa strona z większym miejscem; dymek nie wychodzi poza okno. Gdy nie mieści się nigdzie — panel pod wykresem.
  4. Plotly: bez `hovermode: "x unified"` nad danymi. Dymki HTML liczy jedna funkcja pozycji z prostokątem obiektu
     (`getBoundingClientRect` punktu, słupka, kafla), nie tylko z pozycji kursora.
  5. Telefon: arkusz od dołu; wykres przewija się tak, że obiekt jest nad arkuszem.
- Docelowo wspólny helper w `plotlyChart.ts`, który buduje szablon z listy `{ label, value, format }` (dziś każdy wykres pisze `hovertemplate` sam).

#### Dymek rozszerzony (porównanie, profil szpitala, mapa drzewa)

Gdy dymek porównuje dwa obiekty (szpital i podobne) albo rozkłada wartość na części. Prosty dymek: do 4 wartości jednego obiektu.

1. Nazwa i kontekst (jak w prostym).
2. Jedna wartość kluczowa: etykieta + duża liczba (`--fs-2xl`, granat) + różnica słowami („+5,7 pp wobec podobnych”).
3. Tabela porównania: wiersze = miary, kolumny = obiekty („Ten szpital”, „Podobne (12)”), liczby do prawej, cyfry tabelaryczne.
4. Najwyżej 2 sekcje z tytułem (`--fs-xs`, wersaliki).
5. Przypis metody (`--fs-sm`, `--color-text-tertiary`).

- Granice: szerokość 280–340 px, do 10 wierszy razem, tekst min. 12 px (dziś wiersze mają `--fs-2xs` = 10 px).
  Więcej treści = panel boczny albo profil, nie dymek.
- Zachowanie: najechanie pokazuje; kliknięcie przypina (dopiero wtedy linki są klikalne); Esc i klik obok zamykają.
  Telefon: dotknięcie otwiera arkusz od dołu (wzór: `AreaStatsPopover`, nagłówek mobilny).
- Pozycja: jedna funkcja (dziś 4 kopie: `popupTooltipPosition`, `benchmarkTooltipPosition`, `tooltipPosition`,
  `treemapTooltipPosition`). Dymek po stronie z większym miejscem, nigdy poza oknem.
- Kolory: wartości grafitem, wartość kluczowa granatem, różnica w kolorze lejka ze znakiem (+ `#B4441B`, − `#2856A3`).
  Zieleń tylko dla linku. Wybrany szpital według 6.2a, nie czerwień błędu.
- Komponent docelowy: `ChartTooltip` (HTML) z częściami `Head`, `KeyValue`, `CompareTable`, `Section`, `Note`;
  klasy `.hospital-peer-tooltip-*` przechodzą na niego.

### 6.4 Osie, liczby i zero

| Wartość | Na osi | W dymku | Ustawienie |
|---|---|---|---|
| Liczba całkowita | 1 800 · 10 000 | 1 245 | `separators: ", "` w **każdym** layoucie, `tickformat: ",.0f"` |
| Duża liczba (≥ 100 000) | 150 · 300, tytuł osi „(tys.)” | 142 tys. | przeliczenie wartości; bez skrótów SI („150k”) |
| Udział, śmiertelność | 0% · 10% · 20% | 11,5% (2 miejsca, gdy < 1%) | `percentAxis` (krok 1/2/5 × 10ᵏ, miejsca z kroku) |
| Różnica udziałów | −2 pp · +2 pp | +1,4 pp | minus `−`, znak „+” przy dodatnich |
| Kwota | 0 · 2 · 4 mln zł | 1,49 mld zł | jednostka w tytule osi lub `ticksuffix` |

Krawędzie i zero:

1. Oś wartości od −6% rozpiętości do +10% nad maksimum: `countAxis`, `percentAxis`. Ten sam margines na obu osiach wykresu punktowego.
2. Siatka i podstawa pod danymi. `zeroline: false`; podstawę rysuje `shapes` z `layer: "below"` w kolorze `--color-border-strong`.
   Bez linii zero grubości 3 px w kolorze siatki jako maski (dziś `MortalityChart`).
3. `cliponaxis: false` dla punktów i etykiet tekstowych: znacznik przy krawędzi nie jest ucinany.
4. Zero to wartość: punkt na zerze jest widoczny. Brak danych to `null` (przerwa w linii), nie 0.
5. Słupek o wartości 0: kreska 2 px na podstawie (odróżnia zero od braku danych).
6. Jedna seria wartości ujemnych i dodatnich (np. wynik finansowy): zero zawsze w zakresie, podstawa na zerze.

---

## 7. Wzorce komponentów

| Wzorzec | Gdzie | Zasada |
|---|---|---|
| `PageHeader` | `portal/PageHeader` | `h1` modułu + jedno zdanie wstępu. Bez ikon i ilustracji |
| `DataCard` | `portal/DataCard` | Etykieta → tytuł-pytanie → liczba z wnioskiem → wykres → link |
| Kafelek faktu | `HomePage` `.fact` | Ikona w kaflu + liczba `--fs-2xl` + podpis `--fs-md` |
| Ścieżka | `HomePage` `.path` | Numer tylko, gdy kolejność coś znaczy |
| Wiersz działu | `HomePage` `.sectionRow` | Ikona, nazwa, opis, strzałka. Planowany moduł: bez `href`, plakietka „Planowane” |
| Plakietka „szacunek” | `DataCard` `.badge` | Wersaliki `--fs-xs`, tło `#FFF4E0` (docelowo token) |
| Zakładki | `.tabs` | Aktywna: kolor i dolna linia 2 px `--color-primary` |
| Przełącznik | Mantine `SegmentedControl` | Paleta `atlas` |
| Hero | `HomePage` `.hero` | Zdjęcie przechodzi w kafel gradientem; tekst na kaflu, nie na zdjęciu |

Stany: hover zmienia kolor lub tło, nie rozmiar. Fokus: obrys 2 px `--color-focus-ring` lub `--color-primary`.
Ruch: przejścia do .35 s; płynne przewijanie tylko przy `prefers-reduced-motion: no-preference`.

---

## 8. Obraz

- Zdjęcia i ilustracje pokazują przestrzeń i sprzęt szpitala, nie pacjentów.
- Bez rozpoznawalnych twarzy, krwi, scen dramatycznych. Bez logo NFZ i szpitali jako ozdoby.
- Hero: `public/images/background.webp` (sala operacyjna) z gradientem do `#F3F8F7`.
- Ilustracje własne (`public/images/hero-illustration.svg`), bez licencji zewnętrznych.
- Motyw graficzny marki: **kafel jako jednostka**. Siatka kafli (tło `--color-background-soft`, linie zieleni ok. 8% krycia)
  jest skalą wykresu: jeden kafel = stała wartość (na banerze 200 hospitalizacji × 5 pp, lejek śmiertelności E53G, bez osi i podpisów, tylko błękity). Tekst i wykres stoją na liniach siatki.
  Wzór: `brand/baner.html`. Motyw tylko w materiałach promocyjnych i nagłówkach, nie w wykresach analitycznych.

---

## 9. Dostępność

- Kontrast tekstu min. 4,5:1. `--color-text-tertiary` na bieli: tylko etykiety i przypisy ≥ 12 px.
- Każdy wykres ma `aria-label` z liczbami lub tabelę danych obok (`<details>`).
- Ikony dekoracyjne: `aria-hidden`. Linki mają nazwę celu, nie „kliknij tutaj”.
- `lang="pl"` w `layout.tsx`.

---

## 10. Do uporządkowania (dług wizualny)

Kolejność według wagi. Każdy punkt to osobny, mały PR.

1. **Dwie rodziny szarości.** `globals.css` i część komponentów używa chłodnych szarości
   (`#667085` ok. 90 razy, `#344054`, `#475467`, `#98A2B3`). Zamień na `--color-text-*` i `--color-border*`.
2. **Trzy kolory tekstu.** `--text: #172033` (`globals.css`), `--color-text: #253B3A` (`portal.css`),
   `h1 { color: #1c3534 }`. Zostaw jeden: `--color-text` (dla `h1` ewentualnie wariant `--color-heading`).
3. **Kolory danych jako literały.** `#2856A3`, `#1B3D78`, `#C65D2E` w TSX i CSS.
   Dodaj tokeny z sekcji 2.2 i stałe w `chartPalette.ts` (Plotly nie czyta zmiennych CSS).
4. **Plakietka „szacunek”** w trzech plikach (`DataCard`, `Explorer`, `HospitalizationSummaryPage`).
   Jeden komponent i token `--color-estimate-*`.
5. **Klasy dawnego dashboardu** w `globals.css`: `.kpi-card` (nieużywana), `.sidebar-brand` z gradientem.
   Usuń nieużywane, resztę przenieś na tokeny.
6. **Dwa zestawy tokenów** (`:root` w `globals.css`: `--primary`, `--data`, `--text`…; `.atlas-portal` w `portal.css`: `--color-*`).
   Docelowo jeden zestaw `--color-*` na `:root`.
7. **Dwie metody liczenia na stronie głównej.** Pasek faktów (`datasetHighlights`) sumuje metodą sim: 65,3 mln.
   Wykres lat pod nim (`buildHomeStats`) liczy metodą min: suma 49,6 mln. Oba mają podpis „hospitalizacje JGP”.
   Jedna metoda na stronie albo podpis metody przy liczbie.
8. **Motyw wykresów.** Siatka (`#EEF1F5`), osie (`#D0D5DD`, `#344054`), legendy i dymki (tła `#5F6672`, `#344054`)
   są wpisane osobno w `HospitalAnalysisTab`, `HospitalComparisonShared`, `MortalityChart`, `AdmissionChart`,
   `ProviderScatter`, `GroupLineChart`. Jeden motyw w `plotlyChart.ts` według sekcji 6.
9. **Promienie narożników.** 12 wartości od 2 do 14 px; tokeny `--radius-*` użyte 8 razy.
   Docelowo 4 tokeny: 4 px (plakietka), 9 px (kontrolka), 12 px (karta), 999 px (chip).
10. **Cienie.** 51 różnych deklaracji `box-shadow`; `--shadow-soft` użyty 4 razy.
    Docelowo 2 tokeny: karta nad tłem, element unoszący się (menu, dymek).
11. **Separator tysięcy i przecinek dziesiętny.** `separators: ", "` mają tylko `ProviderScatter` i `GroupLineChart`.
    `MortalityChart`, `AdmissionChart` (przez `getCommonPlotLayout`), `HospitalComparisonShared` i `HospitalAnalysisTab`
    pokazują format angielski: „10,000” na osi, „11.46%” w dymku. Najprostsza poprawka: `separators` w `getCommonPlotLayout`
    i we wspólnym motywie z punktu 8.
12. **Dwa style dymków.** Plotly: ciemne tła w 3 odcieniach (`#5F6672`, `#344054`). HTML (profil szpitala): białe karty
    (`.hospital-peer-tooltip`). Kolejność pól też różna (eksplorator zaczyna od NIP, karta JGP od wartości). Wzór: 6.3.
13. **Marginesy osi.** Dół osi: −2% (`MortalityChart`), −3% i −6% (`ProviderScatter`), −6% (`countAxis`).
    `MortalityChart` maskuje linię zero (grubość 3 px w kolorze siatki). Wzór: 6.4.
14. **Dymki w „Porównaniu”.** Wiersze 10 px, liczby w zieleni (`--primary`), potrójny podpis obiektu
    („Placówka główna” / „Wybrany szpital” / „Placówka: …”), 4 kopie funkcji pozycji, wybrany szpital na czerwono (`#D92D20`).
    Wzór: 6.3, dymek rozszerzony.
15. **Język w „Porównaniu”.** W UI są słowa „peer”, „Peery łącznie”, „Mapa peerów” i notatka dla programisty
    („Tooltip jest liczony niezależnie od hoveru Plotly”, `HospitalComparisonShared.tsx`). Według `brand/brand-voice.md`:
    „podobne szpitale”, „grupa porównawcza”; notatki techniczne usunąć.
16. **Wyróżnienie na lejku.** Karta JGP: wybrany ośrodek `#C65D2E` (albo gwiazdka `#D92D20`, `STAR_COLOR`) ginie wśród
    punktów `#B4441B` / `#E3A27F`. Według 6.2a: grafitowy punkt z obwódką i podpisem.
17. **Pozycja dymków.** 3 z 4 funkcji pozycji liczą miejsce z kursora, nie z obiektu (wyjątek: `treemapTooltipPosition`); dymek może zasłonić punkt albo kafel. Wzór: 6.3.
18. **Motyw ciemny:** na później. Warunek: punkty 1–17 gotowe.
