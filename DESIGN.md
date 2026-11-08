# DESIGN.md — funduszdanych.pl

System wizualny portalu w jednym miejscu: zasady, tokeny, wzorce komponentów i wykresów.
Dla ludzi i agentów, którzy zmieniają UI. Wersja robocza 0.2 (listopad 2026).

- Idea, znak, paleta z uzasadnieniem: [`brand/brandbook.html`](brand/brandbook.html)
- Język i ton tekstów: [`brand/brand-voice.md`](brand/brand-voice.md)
- Banery: [`brand/baner.html`](brand/baner.html), PNG w `brand/`

Wszystkie tokeny z tabel istnieją w kodzie: jeden zestaw `--color-*`, `--radius-*`, `--shadow-*` na `:root`
w `src/app/globals.css`. Plotly i atrybuty SVG nie czytają zmiennych CSS, więc te same wartości są w
`CHART_COLORS` i `DEVIATION_COLORS` (`src/lib/chartPalette.ts`). Zgodność pilnuje `src/app/__tests__/designTokens.test.ts`.

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
   Nowa wartość = nowy token w `globals.css` (i stała w `chartPalette.ts`, jeśli czyta ją wykres), nie wartość w pliku komponentu.
7. **Komponenty niezależne od strony.** Komponent działa w eksploratorze, na karcie JGP i na stronie głównej
   (wzór: `TrendView`). Układ strony należy do strony, wygląd do komponentu.

---

## 2. Kolory

### 2.1 Rdzeń: sterylność (interfejs)

| Token | Wartość | Nazwa | Użycie |
|---|---|---|---|
| `--color-primary` | `#087F75` | Zieleń operacyjna | Znak, aktywna zakładka, ikony, przyciski |
| `--color-primary-hover` | `#076B63` | | Tekst linków, hover |
| `--color-primary-active` | `#055850` | | Stan wciśnięty |
| `--color-primary-soft` | `#E9F6F2` | | Tło ikon, aktywny wiersz, hover chipów |
| `--color-primary-outline` | `#B9DDD4` | | Obrys elementów aktywnych |
| `--color-focus-ring` | `rgba(8,127,117,.22)` | | Pierścień fokusu |
| `--color-background` | `#FFFFFF` | Biel fartucha | Tło treści i kart |
| `--color-background-soft` | `#F3F8F7` | Kafel | Hero, stopka, panel boczny |
| `--color-background-muted` | `#EDF4F1` | | Elementy nieaktywne, plakietka „Planowane” |
| `--color-text` | `#253B3A` | Grafit | Tekst główny (jedyny kolor tekstu) |
| `--color-heading` | `#1C3534` | | `h1` |
| `--color-text-secondary` | `#536C68` | | Opisy, wstępy |
| `--color-text-tertiary` | `#6C827E` | | Etykiety, przypisy |
| `--color-border` | `#D9E6E3` | | Ramki kart, linie tabel |
| `--color-border-strong` | `#B9CEC9` | | Chipy, separatory faktów, ramka dymka, podstawa wykresu |
| `--color-border-subtle` | `#E6EFEC` | | Linie wewnątrz kart i tabel (= `--color-chart-grid`) |
| `--color-error` / `-soft` / `-border` | `#B42318` / `#FFF4F2` / `#F0C8C3` | Alarm | Tylko błędy |

Szarości mają jedną rodzinę z odcieniem zieleni. Chłodne szarości dawnego dashboardu (`#667085`, `#344054`…) nie wracają:
pilnuje tego test `designTokens.test.ts`.

Mantine: paleta `atlas` w `src/app/layout.tsx` (odcienie 0–9, `primaryShade: 7` = `#087F75`).

### 2.2 Rozszerzenie: uniformy (dane i wyróżnienia)

| Token | Wartość | Nazwa (źródło) | Użycie |
|---|---|---|---|
| `--color-data-strong` | `#1B3D78` | Granat pielęgniarski | Liczby kluczowe (`.compareFacts dd`), seria nr 1 skali |
| `--color-data` | `#2856A3` | Błękit danych | Główna seria wykresów, przyjęcia nagłe, „zysk” |
| `--color-data-soft` | `#9DB4DB` | Błękit fartucha | Druga seria, wartości tła |
| `--color-data-muted` | `#B5C7E6` | | Przyjęcia planowe |
| `--color-data-faint` | `#E4EAF4` | | Pozostałe, tło słupków |
| `--color-signal` | `#C65D2E` | Sygnał ratowniczy | Wybrany ośrodek, ostatni rok, „strata” |
| `--color-signal-soft` | `#FBEEE7` | | Tło wiersza wybranego szpitala |
| `--color-deviation-up` | `#B4441B` | | Różnica w górę (tekst), lejek poza 99,8% |
| `--color-estimate-bg` / `-fg` | `#FFF4E0` / `#8A5300` | | Plakietka „szacunek” |
| `--color-positive` | `#1D6B3A` | | Zmiana na plus w tekście |

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
| `--radius-badge` | 4px | Plakietki, słupki |
| `--radius-control` | 9px | Pola, przyciski, przełączniki, dymki |
| `--radius-card` | 12px | Karty, kafelki faktów, ramki wykresów |
| `--radius-pill` | 999px | Chipy |
| `--shadow-soft` | `0 2px 8px rgba(22,58,52,.055)` | Karty nad tłem |
| `--shadow-float` | `0 12px 32px rgba(22,58,52,.14), 0 2px 6px rgba(22,58,52,.06)` | Element unoszący się: menu, dymek, arkusz |

Promień tylko z tokenów (albo `0`, `50%`), cień tylko z tokenów (poza obrysami: pierścień fokusu, linia `inset`).
Pilnuje tego `designTokens.test.ts`.

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
- Jeden motyw Plotly w `src/lib/plotlyChart.ts`: `chartLayout()` (separatory, krój, jasny dymek, `closest`),
  `measureAxis()` / `categoryAxis()` (siatka tylko na osi-mierze), `axisTitle()`, `paddedRange()` (−6% / +10%),
  `baselineShape()` (podstawa pod danymi), `referenceShape()`, `hoverTemplate()`. Wykres nie wpisuje kolorów osi i dymka sam.
- Seria główna: `--color-data` (`#2856A3`). Skala sekwencyjna: granat → błękit → błękit fartucha → `#E4EAF4`.
- Wyróżnienie: `--color-signal`, jedno na wykres.
- Oś wartości od zera dla słupków. Tekst osi i legend: `--fs-sm` / `--fs-xs`, kolor `--color-text-tertiary`.
- Dymek (hover): jasny (6.3), tekst 13 px, liczby po polsku.
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
  w dół `#8FB0DD` i `#2856A3`, w granicach `#9DB4DB`. Stała `DEVIATION_COLORS` w `chartPalette.ts`. Zawsze z legendą albo statusem w dymku.
- **Sygnał albo skala odchylenia, nie oba.** Wyróżnienie („ten szpital”) na wykresie bez skali odchylenia: `--color-signal`.
  Na wykresie ze skalą odchylenia: punkt `--color-text` (grafit) z białą obwódką 2,5 px, większy o połowę, z podpisem
  (`ProviderScatter`, `marker="graphite"`; poza lejkiem `marker="signal"`).
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
- Szablon dymka Plotly buduje `hoverTemplate({ title, context, rows, footer })` w `plotlyChart.ts`.

#### Dymek rozszerzony (porównanie, profil szpitala, mapa drzewa)

Gdy dymek porównuje dwa obiekty (szpital i podobne) albo rozkłada wartość na części. Prosty dymek: do 4 wartości jednego obiektu.

1. Nazwa i kontekst (jak w prostym).
2. Jedna wartość kluczowa: etykieta + duża liczba (`--fs-2xl`, granat) + różnica słowami („+5,7 pp wobec podobnych”).
3. Tabela porównania: wiersze = miary, kolumny = obiekty („Ten szpital”, „Podobne (12)”), liczby do prawej, cyfry tabelaryczne.
4. Najwyżej 2 sekcje z tytułem (`--fs-xs`, wersaliki).
5. Przypis metody (`--fs-sm`, `--color-text-tertiary`).

- Granice: szerokość 280–340 px, do 10 wierszy razem, tekst min. 12 px.
  Więcej treści = panel boczny albo profil, nie dymek.
- Zachowanie: najechanie pokazuje; kliknięcie przypina (dopiero wtedy linki są klikalne); Esc i klik obok zamykają.
  Telefon: dotknięcie otwiera arkusz od dołu (wzór: `AreaStatsPopover`, nagłówek mobilny).
- Pozycja: jedna funkcja `placeTooltip` (`src/lib/tooltipPosition.ts`) z prostokąta obiektu (`plotlyObjectBox`:
  punkt, słupek, kafel). Dymek po pierwszej stronie, na której się mieści, nigdy poza oknem.
- Kolory: wartości grafitem, wartość kluczowa granatem, różnica w kolorze lejka ze znakiem (+ `#B4441B`, − `#2856A3`).
  Zieleń tylko dla linku. Wybrany szpital według 6.2a, nie czerwień błędu.
- Komponent: `ChartTooltip` (`src/components/ChartTooltip.tsx`) z częściami `TooltipHead`, `TooltipKeyValue`,
  `TooltipCompareTable`, `TooltipSection`, `TooltipNote`. Klasy `.hospital-peer-tooltip-*` zostały tylko w odłączonym
  `HospitalComparisonLegacyTab`.

### 6.4 Osie, liczby i zero

| Wartość | Na osi | W dymku | Ustawienie |
|---|---|---|---|
| Liczba całkowita | 1 800 · 10 000 | 1 245 | `separators: ", "` w każdym layoucie (`chartLayout`), `tickformat: ",.0f"` |
| Duża liczba (≥ 100 000) | 150 · 300, tytuł osi „(tys.)” | 142 tys. | przeliczenie wartości; bez skrótów SI („150k”) |
| Udział, śmiertelność | 0% · 10% · 20% | 11,5% (2 miejsca, gdy < 1%) | `percentAxis` (krok 1/2/5 × 10ᵏ, miejsca z kroku) |
| Różnica udziałów | −2 pp · +2 pp | +1,4 pp | minus `−`, znak „+” przy dodatnich (`formatSigned`) |
| Kwota | 0 · 2 · 4 mln zł | 1,49 mld zł | jednostka w tytule osi lub `ticksuffix` |

Krawędzie i zero:

1. Oś wartości od −6% rozpiętości do +10% nad maksimum: `countAxis`, `percentAxis`. Ten sam margines na obu osiach wykresu punktowego.
2. Siatka i podstawa pod danymi. `zeroline: false`; podstawę rysuje `baselineShape()` (`layer: "below"`, `--color-border-strong`).
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
| Kafelek faktu | `HomePage` `.fact` | Ikona w kaflu + liczba `--fs-2xl` + podpis `--fs-md`. Szacunek konserwatywny (metoda min) jako dolna granica: „ponad 49 mln” (`formatAtLeastCount`) |
| Ścieżka | `HomePage` `.path` | Numer tylko, gdy kolejność coś znaczy |
| Wiersz działu | `HomePage` `.sectionRow` | Ikona, nazwa, opis, strzałka. Planowany moduł: bez `href`, plakietka „Planowane” |
| Plakietka „szacunek” | `portal/EstimateBadge` | Wersaliki `--fs-xs`, tokeny `--color-estimate-*`, `--radius-badge` |
| Dymek rozszerzony | `ChartTooltip` | 6.3; pozycja z `placeTooltip` |
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

Punkty 1–17 z wersji 0.1 są wdrożone (branch `feature/design-cleanup`): jedna rodzina szarości i jeden kolor tekstu,
tokeny danych, sygnału, plakietki, promieni i cieni na `:root`, `EstimateBadge`, jedna metoda liczenia na stronie głównej (min),
wspólny motyw Plotly, jasne dymki z jedną funkcją pozycji, „podobne szpitale” zamiast „peer”, grafitowe wyróżnienie na lejku.

1. **Motyw ciemny:** na później. Tokeny są już w jednym miejscu (`:root` w `globals.css` i `CHART_COLORS`), więc ciemny
   motyw to drugi zestaw wartości pod `@media (prefers-color-scheme: dark)` i wariant `CHART_COLORS`.
2. **Przypięcie dymka rozszerzonego** (kliknięcie przypina, Esc zamyka, arkusz od dołu na telefonie z przewinięciem wykresu)
   z 6.3 — jeszcze nie ma; dziś dymek tylko podąża za najechaniem, a na telefonie stoi przy dolnej krawędzi.
