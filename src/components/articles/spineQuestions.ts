import type { ArticleSource } from "./jgpIntroSources";

/**
 * Źródła listy pytań „Zabiegi na kręgosłupie: pytania do NFZ”. Kolejność = numer przypisu (pierwsze użycie w tekście).
 * Liczby H55 pochodzą z artykułu „H55. Historia jednego kodu” (te same dane i kontrole: `h55Controls.ts`).
 * Liczby H52 i H53 dla Szpitala Wojewódzkiego w Koszalinie (16|6691044410): hospitalizacje i kwoty z plików grup
 * `build-data/jgp/H52.json.gz` i `H53.json.gz` (metoda min; kwoty z zestawienia rozliczeń NFZ). Udział pobytów z wypisem
 * w dniu przyjęcia: kolumna długości pobytu („0 dni”) w plikach `data/hospitalizacje_<rok>.csv`, metoda min, policzone
 * jednorazowo do tego tekstu (plik grupy nie ma długości pobytu).
 * Liczby krajowe (hospitalizacje w Polsce, pobyty 0-dniowe w Polsce) — z API statystyk JGP NFZ (2017–2024; tabele
 * „Dane ogólne” i „Długość pobytu”, cache `data/nfz_jgp_stats/tabele/<rok>/`), bo otwarte dane zaniżają je przez „<5”.
 * Rok 2025 (bez API): szacunek — H52 i H53: otwarte dane przeliczone według relacji API do otwartych danych w 2024 r.;
 * H55: szacunek z artykułu o H55 (z punktów).
 */
export const SPINE_QUESTION_SOURCES = [
  {
    id: "posel",
    title: "R. Komarewicz, wpis w serwisie X z 14.11.2026 r.",
    note: "zapowiedź wniosku do Prezesa NFZ o kompleksowy audyt rozliczeń zabiegów kręgosłupa",
    href: "https://x.com/RKomarewicz/status/2121534812611657808",
  },
  {
    id: "h55",
    title: "funduszdanych.pl, „H55. Historia jednego kodu”",
    note: "liczby H55 w Polsce i w szpitalach, wycena w szpitalu i w poradni, 25 kontroli NFZ: okresy, skutki, miesiące objęte kontrolą, placówki bez kontroli",
    href: "/artykuly/historia-h55",
  },
  {
    id: "jgp",
    title: "Otwarte dane NFZ o hospitalizacjach i zestawienie świadczeń rozliczonych przez NFZ, grupy H52, H53 i H55, 2017–2025",
    note: "kwoty H52, H53 i H55 w Polsce w latach 2019–2025; hospitalizacje i kwoty H52 i H53 w Szpitalu Wojewódzkim w Koszalinie, miesiąc po miesiącu",
    href: "/jgp/H52",
  },
  {
    id: "api",
    title: "NFZ, API statystyk JGP (api.nfz.gov.pl/app-stat-api-jgp, v1.1, katalog 1a), grupy H52, H53 i H55, tabele „Dane ogólne” i „Długość pobytu”, lata 2017–2024",
    note: "liczba hospitalizacji w Polsce i liczba pobytów z wypisem w dniu przyjęcia (0 dni) w Polsce; API nie ma jeszcze danych za 2025 r.",
    href: "https://api.nfz.gov.pl/app-stat-api-jgp/",
  },
  {
    id: "pismo",
    title: "NFZ, Departament Kontroli, odpowiedź z 29.10.2026 r. (znak NFZ-DK-WP.090.41.2026) na pytania autora",
    note: "kontroli podlega wytypowana próba; skutki dotyczą tylko tej próby; metodyka typowania próby nie jest informacją publiczną",
  },
  {
    id: "kontrole",
    title: "NFZ, „Szczegółowe informacje o wynikach kontroli przeprowadzonych przez Departament Kontroli Narodowego Funduszu Zdrowia” (BIP NFZ)",
    note: "daty i zakres kontroli w Koszalinie (DK.TWK-X.4840.006.2024 i DK.TWK-X.4840.026.2025), w tym H52 za I–VIII 2023 r. i niewykonanie zaleceń",
  },
  {
    id: "pobyty",
    title: "Otwarte dane NFZ o hospitalizacjach (dane.gov.pl), długość pobytu, grupy H52 i H53, 2019–2025; obliczenia funduszdanych.pl",
    note: "pobyty z wypisem w dniu przyjęcia (0 dni) w Koszalinie i w pozostałych szpitalach",
    href: "/o-danych",
  },
] as const satisfies readonly ArticleSource[];

export type SpineQuestionSourceId = (typeof SPINE_QUESTION_SOURCES)[number]["id"];

/** Numer przypisu (od 1) dla źródła. */
export function spineSourceNumber(id: SpineQuestionSourceId): number {
  return SPINE_QUESTION_SOURCES.findIndex((source) => source.id === id) + 1;
}

/** Pytanie: treść (pytanie), fakty, na których się opiera, i źródła faktów. */
export interface SpineQuestion {
  question: string;
  facts: string;
  /** Fakty w punktach pod zdaniem `facts` (np. zestawienie kilku grup). */
  points?: string[];
  sources: SpineQuestionSourceId[];
}

export interface SpineQuestionSection {
  id: string;
  title: string;
  /** Teza przed pytaniami (opcjonalna). */
  lead?: string;
  /** Wykres przed pytaniami (opcjonalny): hospitalizacje H52 i H53 w Koszalinie. */
  figure?: "koszalin-h52-h53";
  questions: SpineQuestion[];
}

/** Pytania w częściach; numeracja pytań jest ciągła przez wszystkie części. */
export const SPINE_QUESTION_SECTIONS: readonly SpineQuestionSection[] = [
  {
    id: "skala",
    title: "Skala",
    questions: [
      {
        question: "Czy NFZ ma analizę, ile wzrostu rozliczeń zabiegów na kręgosłupie wynika z potrzeb zdrowotnych, a ile ze sposobu rozliczania?",
        facts: "W latach 2019–2025 NFZ zapłacił szpitalom za te trzy grupy razem 4520,2 mln zł, czyli 4,52 mld zł. Kwoty i liczba hospitalizacji w Polsce:",
        points: [
          "H52 (operacje kręgosłupa z implantami): 243,0 mln zł (0,24 mld zł) w 2019 r. i 673,8 mln zł (0,67 mld zł) w 2025 r. — 2,8 razy więcej; razem 3043,7 mln zł (3,04 mld zł). Hospitalizacje: 15 494 w 2017 r. i ok. 24 000 w 2025 r. (szacunek) — o ok. 55% więcej.",
          "H53 (operacje kręgosłupa bez implantów): 66,2 mln zł (0,07 mld zł) w 2019 r. i 175,7 mln zł (0,18 mld zł) w 2025 r. — 2,7 razy więcej; razem 732,8 mln zł (0,73 mld zł). Hospitalizacje: 7083 w 2017 r. i ok. 9300 w 2025 r. (szacunek) — o ok. 31% więcej.",
          "H55 (głównie termolezja): 31,4 mln zł (0,03 mld zł) w 2019 r. i 209,8 mln zł (0,21 mld zł) w 2025 r. — 6,7 razy więcej; razem 743,7 mln zł (0,74 mld zł). Hospitalizacje: 5395 w 2017 r. i ok. 30 900 w 2025 r. (szacunek) — 5,7 razy więcej.",
        ],
        sources: ["h55", "jgp", "api"],
      },
      {
        question: "Dlaczego NFZ przez lata płacił za termolezję głównie jako za hospitalizację, a nie jako za zabieg w poradni?",
        facts: "W poradni termolezja kosztuje ok. 1790 zł, w szpitalu jako H55 ok. 6780 zł (ok. 3,8 razy więcej). Od lipca 2021 r. NFZ płaci poradniom za wszystkie świadczenia, bez limitu.",
        sources: ["h55"],
      },
    ],
  },
  {
    id: "wiedza",
    title: "Co NFZ wiedział i co zrobił",
    questions: [
      {
        question: "Co NFZ zrobił w skali kraju z ustaleniami kontroli w Rawiczu (2021 r.) i w Poznaniu (2022 r.)?",
        facts: "Najpóźniej w lipcu 2021 r. NFZ miał na piśmie zarzut: szpital robił termolezję na oddziale, choć mógł w poradni. W 2022 r. ten sam wydział napisał to samo o drugiej placówce. W tym czasie liczba hospitalizacji H55 w Polsce wzrosła z 10 160 (2021 r.) do 17 937 (2022 r.).",
        sources: ["h55"],
      },
      {
        question: "Czy wydziały kontroli NFZ przekazują sobie ustalenia o tym samym kodzie JGP?",
        facts: "Jesienią 2023 r. trzy wydziały (Warszawa, Katowice, Białystok) w ciągu kilku tygodni weszły z kontrolą H55 do czterech szpitali. Z dokumentów nie wynika, czy wymieniały się ustaleniami.",
        sources: ["h55"],
      },
      {
        question: "Czy ustalenia kontroli zmieniły umowy, wyceny albo monitoring rozliczeń, zanim w 2026 r. termolezja przeszła do grupy HK14?",
        facts: "Od 2026 r. NFZ płaci za termolezję w HK14 o 36,5% mniej punktów niż w H55. Zmiana przyszła pięć lat po pierwszym jasnym zarzucie z kontroli.",
        sources: ["h55"],
      },
    ],
  },
  {
    id: "zakres",
    title: "Zakres kontroli",
    questions: [
      {
        question: "Kto i według jakich kryteriów wybiera okres, który obejmuje kontrola?",
        facts: "W 18 szpitalach skontrolowanych w latach 2023–2026 kontrolerzy sprawdzili 195 z 912 miesięcy, w których te szpitale rozliczały H55 (21%).",
        sources: ["h55"],
      },
      {
        question: "Dlaczego kontrole rozpoczęte w latach 2024–2025 badały najczęściej tylko 2022 r.?",
        facts: "W Gryficach, w Piszu i w Wągrowcu poza kontrolą zostały lata z największą liczbą zabiegów. Gryfice: 439 hospitalizacji H55 w 2022 r. (zbadany), 808 w 2023 r. i 993 w 2024 r. (niezbadane).",
        sources: ["h55"],
      },
      {
        question: "Jak NFZ wybiera próbę hospitalizacji do kontroli i czy może przenieść jej wynik na cały okres rozliczeń?",
        facts: "Według Departamentu Kontroli NFZ skutki kontroli dotyczą tylko wytypowanej próby. Metodyka typowania próby według NFZ nie jest informacją publiczną. Za zabiegi poza próbą szpital nie oddaje pieniędzy.",
        sources: ["pismo"],
      },
      {
        question: "Czy NFZ planuje odzyskać pieniądze za okresy, których kontrole nie objęły?",
        facts: "18 skontrolowanych szpitali wykazało od 2019 r. świadczenia H55 o wartości 172 mln zł. Kontrole objęły okresy warte 60,4 mln zł. Skutki finansowe to 25,7 mln zł (15% wartości wszystkich świadczeń H55 tych szpitali).",
        sources: ["h55"],
      },
    ],
  },
  {
    id: "koszalin",
    title: "Koszalin: H52 i H53",
    figure: "koszalin-h52-h53",
    questions: [
      {
        question: "Dlaczego druga kontrola w Koszalinie zbadała H52 tylko za styczeń–sierpień 2023 r., a nie lata 2021–2022?",
        facts: "W latach 2021–2023 Szpital Wojewódzki w Koszalinie rozliczył najwyższą kwotę H52 w Polsce: łącznie ~83 mln zł. Hospitalizacji H52 było 264 w 2020 r., 1089 w 2021 r. i 1558 w 2022 r.",
        sources: ["jgp", "kontrole"],
      },
      {
        question: "Jak to możliwe, że w latach 2021–2023 ponad 90% hospitalizacji H52 w Koszalinie kończyło się wypisem w dniu przyjęcia, a w pozostałych szpitalach — 3–4%?",
        facts: "H52 to operacje kręgosłupa z użyciem implantów. Wyceniona 5x lepiej niż kod H55. Wypis w dniu przyjęcia w Koszalinie w okresie I 2021- IV 2024 dotyczył 90% hospitalizacji. W pozostałych szpitalach w Polsce w tym samym okresie wyniósł 3,6%. Koszalin miał 5–8% hospitalizacji H52 w Polsce, ale 65% (2021 r.), 64% (2022 r.) i 49% (2023 r.) wszystkich pobytów H52 z wypisem w dniu przyjęcia.",
        sources: ["pobyty", "api"],
      },
      {
        question: "Dlaczego w maju 2024 r. Koszalin prawie przestał rozliczać H52, a w tym samym miesiącu zaczął rozliczać H53?",
        facts: "W kwietniu 2024 r. szpital rozliczył 96 hospitalizacji H52 i 5 H53, w maju — 11 H52 i 74 H53. Hospitalizacji H53 było 22 w 2023 r., 945 w 2024 r. i 1179 w 2025 r. Kwota H53: 0,4 mln zł w 2023 r., 16,8 mln zł w 2024 r. i 22,1 mln zł w 2025 r. — najwięcej w Polsce. Łączna kwota H52 i H53 prawie się nie zmieniła: 28,5 mln zł w 2023 r., 29,4 mln zł w 2024 r. i 28,9 mln zł w 2025 r. Zmiana nastąpiła zaraz po pierwszej kontroli H55 (luty–kwiecień 2024 r.).",
        sources: ["jgp", "kontrole"],
      },
      {
        question: "Czy NFZ zbadał, skąd wziął się nagły wzrost H53 w Polsce w 2024 r.?",
        facts: "Hospitalizacji H53 w Polsce było 7524 w 2023 r. i 8712 w 2024 r. (+1188). Sam Koszalin dodał 923, czyli 78% wzrostu. Kwota H53 w Polsce wzrosła ze 123,4 mln zł do 152,5 mln zł; Koszalin to 16,4 mln zł z tych 29,0 mln zł wzrostu (57%).",
        sources: ["jgp", "api"],
      },
      {
        question: "Jak to możliwe, że od 2024 r. 97% hospitalizacji H53 w Koszalinie kończy się wypisem w dniu przyjęcia?",
        facts: "Wypis w dniu przyjęcia w H53: Koszalin 97% w 2024 r. i 97% w 2025 r.; pozostałe szpitale w Polsce 10% w 2024 r. W 2024 r. Koszalin miał 11% hospitalizacji H53 w Polsce, ale 54% wszystkich pobytów H53 z wypisem w dniu przyjęcia. API NFZ nie ma jeszcze danych za 2025 r.",
        sources: ["pobyty", "api"],
      },
      {
        question: "Dlaczego druga kontrola nie objęła H53 z lat 2024–2025?",
        facts: "Druga kontrola (sierpień 2025 – marzec 2026 r.) objęła H52 za styczeń–sierpień 2023 r. i H55 z końca 2024 r. W latach 2024–2025 szpital rozliczył 2124 hospitalizacje H53 za 39,0 mln zł.",
        sources: ["jgp", "kontrole"],
      },
    ],
  },
  {
    id: "koszalin-h55",
    title: "Koszalin: H55 po pierwszej kontroli",
    questions: [
      {
        question: "Jak to możliwe, że Koszalin w trakcie drugiej kontroli nadal rozliczał H55, choć pierwsza kontrola oceniła rozliczanie H55 negatywnie?",
        facts: "Pierwsza kontrola (luty–kwiecień 2024 r.) zakończyła się oceną negatywną i skutkami 1,5 mln zł. NFZ zalecił przyjmować na oddział tylko pacjentów, których nie da się leczyć w poradni. Po kontroli zabiegów przybyło: rok 2025 był rekordowy, 1679 hospitalizacji H55 za 11,4 mln zł. Druga kontrola trwała od sierpnia 2025 do marca 2026 r. Do końca 2025 r. szpital rozliczył w tym czasie jeszcze 635 hospitalizacji H55.",
        sources: ["h55", "kontrole"],
      },
      {
        question: "Czy NFZ może wstrzymać albo ograniczyć płatności za kwestionowane świadczenia przed końcem kontroli? Jeśli tak, dlaczego tego nie zrobił w Koszalinie?",
        facts: "Między startem pierwszej kontroli (luty 2024 r.) a końcem drugiej (marzec 2026 r.) minęło ponad dwa lata. Przez cały ten czas szpital rozliczał H55.",
        sources: ["h55", "kontrole"],
      },
      {
        question: "Kto i kiedy sprawdza wykonanie zaleceń pokontrolnych?",
        facts: "Niewykonanie zaleceń z pierwszej kontroli wykazała dopiero druga kontrola, ponad rok po pierwszej. Skutki drugiej kontroli: 7,0 mln zł, razem z H52.",
        sources: ["h55", "kontrole"],
      },
    ],
  },
  {
    id: "bez-kontroli",
    title: "Placówki bez kontroli",
    questions: [
      {
        question: "Czy NFZ skontroluje placówki z krótkim, intensywnym okresem rozliczania H55?",
        facts: "14 placówek rozliczyło po kilkaset hospitalizacji H55 w najwyżej 12 miesięcy, a potem przestało. Żadna nie miała kontroli H55. 11 z nich zaczęło dopiero w latach 2024–2025.",
        sources: ["h55"],
      },
      {
        question: "Dlaczego placówki z poradnią rozliczały termolezję jako hospitalizację?",
        facts: "12 placówek bez kontroli, z gwałtownym wzrostem H55, miało poradnię neurochirurgiczną lub poradnię leczenia bólu. W 2025 r. zrobiły w poradni termolezję u najwyżej 9 pacjentów albo u żadnego.",
        sources: ["h55"],
      },
    ],
  },
  {
    id: "model",
    title: "Czy obecny model kontroli ma sens",
    lead: "Historia kodu H55 pokazuje, że obecny mechanizm kontroli nie działa. Kontrola bada zwykle okres sprzed dwóch lat i tylko próbę pobytów. Więcej kontrolerów nie zmieni tego mechanizmu: dalej będą sprawdzać przeszłość, a zabiegi przejdą do kolejnych szpitali.",
    questions: [
      {
        question: "Czy kontrola, która bada okres sprzed dwóch lat, może zapobiec stratom?",
        facts: "Od końca sprawdzanego okresu do startu kontroli mijało przeciętnie 14 miesięcy (mediana kontroli z lat 2023–2026), a kontrola trwała potem kilka miesięcy. W 8 z 18 szpitali rozliczanie H55 skończyło się przed wejściem kontrolerów. W Miastku skutki wyniosły 13,3 mln zł, ale kontrola przyszła, gdy szpital nie rozliczał już H55.",
        sources: ["h55"],
      },
      {
        question: "Czy NFZ rozważa zmianę modelu kontroli, a nie tylko zwiększenie liczby kontrolerów?",
        facts: "W Wągrowcu, Mogilnie i Miastku rozliczenia H55 przechodziły ze szpitala do szpitala. Kontrolerzy byli w jednym szpitalu, a w drugim zabiegów przybywało.",
        sources: ["h55"],
      },
      {
        question: "Dlaczego NFZ nie wykrywa automatycznie nagłych wzrostów rozliczeń danego kodu JGP w placówce?",
        facts: "NFZ dostaje rozliczenia co miesiąc. Wzrost z zera do kilkuset zabiegów w kilka miesięcy widać w danych od razu, nie po dwóch latach.",
        sources: ["h55"],
      },
      {
        question: "Czy NFZ ma dziś system, który pokazuje placówki z nagłym wzrostem rozliczeń? Jeśli tak, dlaczego nie zadziałał przy H55 i H52? Jeśli nie, kiedy NFZ go wdroży?",
        facts: "Wzory opisane wyżej (krótkie okresy rozliczeń, kilkukrotny wzrost w ciągu roku) widać w otwartych danych NFZ, które każdy może pobrać.",
        sources: ["h55", "jgp"],
      },
    ],
  },
];

/** Liczba wszystkich pytań (opis artykułu i test). */
export const SPINE_QUESTION_COUNT = SPINE_QUESTION_SECTIONS.reduce((total, section) => total + section.questions.length, 0);
