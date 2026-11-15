import type { ArticleSource } from "./jgpIntroSources";

/**
 * Źródła artykułu „H55. Historia jednego kodu”. Kolejność = numer przypisu (pierwsze użycie w tekście).
 * `note` mówi, co dokładnie źródło potwierdza.
 */
export const H55_SOURCES = [
  {
    id: "api",
    title: "NFZ, API statystyk JGP (api.nfz.gov.pl/app-stat-api-jgp, v1.1, katalog 1a), grupa H55, tabele „Dane ogólne”, „Procedury ICD 9 — kody listy kierunkowej”, „Pobyty w zakresach umów” i „Długość pobytu”, lata 2017–2024",
    note: "liczba hospitalizacji H55 w Polsce w latach 2017–2024 (dane ogólne grupy), odsetek hospitalizacji z procedurą 03.96 „Przezskórne odnerwienie powierzchni stawowej wyrostka kręgu”, długość pobytów i pobyty rozliczone w zakresach „zespół chirurgii jednego dnia”",
    href: "https://api.nfz.gov.pl/app-stat-api-jgp/",
  },
  {
    id: "rozliczenia",
    title: "NFZ, zestawienie świadczeń rozliczonych w latach 2019–2026 (wartość i liczba punktów według świadczeniodawcy, zakresu i produktu)",
    note: "kwoty rozliczone za H55 w Polsce i w szpitalach w latach; przeciętna wartość punktu w H55 i HK14",
    href: "/o-danych",
  },
  {
    id: "kontrole",
    title: "NFZ, „Szczegółowe informacje o wynikach kontroli przeprowadzonych przez Departament Kontroli Narodowego Funduszu Zdrowia” (BIP NFZ; układy z zarządzeń nr 122/2022/DK i 15/2020/DK)",
    note: "25 kontroli, w których temat albo zakres wymienia H55 lub procedurę 03.96: daty, okresy objęte kontrolą, oceny, stwierdzone nieprawidłowości i kwoty skutków finansowych",
  },
  {
    id: "aotmit",
    title: "AOTMiT, „Zmiana technologii medycznej w zakresie świadczeń AOS obejmujących zniszczenie nerwów czaszkowych lub obwodowych – neuroliza chemiczna, termolezja, kriolezja”, raport WS.4212.1.2025, czerwiec 2025",
    note: "w AOS termolezję (04.25) rozlicza produkt Z13 „Świadczenia zabiegowe – grupa 13”: 1039 pkt, ok. 1787 zł; liczba pacjentów AOS z termolezją w latach 2019–2023 według rodzaju poradni; uwaga ekspertów, że ta sama procedura w AOS jest wyceniana „niewspółmiernie niżej” niż w szpitalu",
    href: "https://bip.aotm.gov.pl/assets/files/zlecenia_mz/2025/092/RPT/2025%2006%2025%20Raport%20ZTM%20zniszczenie%20nerw%C3%B3w.pdf",
  },
  {
    id: "aos-limity",
    title: "„Rząd ma pomysł na rozładowanie kolejek do lekarzy”, Rzeczpospolita, 12.11.2024",
    note: "limity w ambulatoryjnej opiece specjalistycznej nie obowiązują od 1 lipca 2021 r.; NFZ płaci za świadczenia AOS bez względu na ich liczbę w roku",
    href: "https://www.rp.pl/ochrona-zdrowia/art41422821-rzad-ma-pomysl-na-rozladowanie-kolejek-do-lekarzy",
  },
  {
    id: "wyceny",
    title: "Katalog grup JGP z wycenami punktowymi (załącznik 1a): 2025 r. (dane serwisu) i 2026 r. (zarządzenie nr 46/2026/DSOZ Prezesa NFZ, tekst ujednolicony z 23.09.2026; zarządzenie nr 32/2026/DSOZ — wycena od 1 stycznia 2026 r.)",
    note: "punkty za pobyty w grupie H55 (2025 r.) i w grupie HK14 (2026 r.)",
    href: "https://baw.nfz.gov.pl/NFZ/document/43868/Zarzadzenie-46_2026_DSOZ",
  },
  {
    id: "dane",
    title: "Otwarte dane NFZ o hospitalizacjach rozliczonych w grupach JGP, 2017–2025 (dane.gov.pl)",
    note: "liczba hospitalizacji H55 w Polsce i w placówkach, miesiąc po miesiącu",
    href: "/o-danych",
  },
  {
    id: "pismo",
    title: "NFZ, Departament Kontroli, odpowiedź z 29.10.2026 r. (znak NFZ-DK-WP.090.41.2026) na pytania autora o przebieg kontroli rozliczania JGP",
    note: "kontroli podlega wytypowana próba; skutki kontroli dotyczą jedynie kontrolowanej próby; metodyka kontroli i typowania próby nie jest informacją publiczną",
  },
  {
    id: "wp-spine",
    title: "M. Janczura, S. Jadczak, „Zarabiali nawet 26 tys. zł za godzinę. Ujawniamy kolejne zuchwałe metody spółki neurochirurgów”, Wirtualna Polska",
    note: "powiązania szpitali w Wągrowcu, Mogilnie i Miastku z działalnością spółki Spine",
    href: "https://wiadomosci.wp.pl/zarabiali-nawet-26-tys-zl-za-godzine-ujawniamy-kolejne-zuchwale-metody-spolki-neurochirurgow-7304628127377760a",
  },
  {
    id: "wagrowiec",
    title: "ZOZ w Wągrowcu, komunikat z 14 lipca 2026 r.",
    note: "współpraca szpitala ze spółką Spine od stycznia 2023 do kwietnia 2024 r.",
    href: "https://szpitalwagrowiec.pl/blog/2026/07/14/komunikat/",
  },
  {
    id: "wp-pisz",
    title: "M. Janczura, S. Jadczak, „Afera neurochirurgów. Szpital ukarany za zabiegi lekarza celebryty”, Wirtualna Polska",
    note: "wątek szpitala w Piszu i zabiegów neurochirurga; lekarz kwestionował zarzuty",
    href: "https://wiadomosci.wp.pl/afera-neurochirurgow-szpital-ukarany-za-zabiegi-lekarza-celebryty-7335815913711904a",
  },
  {
    id: "icd",
    title: "NFZ, „Zestawienie 2: liczba pacjentów według rozpoznania ICD-10 i procedury ICD-9”, według świadczeniodawcy, lata 2024 i 2025 (wszystkie rodzaje świadczeń)",
    note: "liczba pacjentów z procedurą 03.96 (termolezja stawów kręgosłupa, szpital) i 04.25 (termolezja nerwów, kod używany w AOS) w Polsce i u świadczeniodawców",
  },
  {
    id: "rpwdl",
    title: "Rejestr Podmiotów Wykonujących Działalność Leczniczą (RPWDL), eksport z 12.09.2026: komórki „Poradnia neurochirurgiczna”, „Poradnia leczenia bólu”, „Oddział neurochirurgiczny” z datami rozpoczęcia i zakończenia działalności; NFZ, API „Umowy” (umowy AOS w zakresie neurochirurgii)",
    note: "czy świadczeniodawca miał w danym roku poradnię neurochirurgiczną, poradnię leczenia bólu lub oddział neurochirurgii",
    href: "https://rpwdl.ezdrowie.gov.pl/",
  },
  {
    id: "gruper",
    title: "Zasady grupowania JGP, wersja 104.5: procedura ICD-9 03.96 (jgp.uhc.com.pl)",
    note: "od 2026 r. procedura 03.96 kwalifikuje do grupy HK14; część procedur dawnej H55 w innych grupach, m.in. HK08",
    href: "https://jgp.uhc.com.pl/doc/104.5/icd9/03.96.html",
  },
  {
    id: "wp-miastko",
    title: "M. Janczura, S. Jadczak, „Pacjentów odsyłano, przyjmowano tych, którzy byli opłacalni. Nowy skandal w szpitalu”, Wirtualna Polska",
    note: "nieprawidłowości w szpitalu w Miastku",
    href: "https://wiadomosci.wp.pl/pacjentow-odsylano-przyjmowano-tych-ktorzy-byli-oplacalni-nowy-skandal-w-szpitalu-7317285552900192a",
  },
] as const satisfies readonly ArticleSource[];

export type H55SourceId = (typeof H55_SOURCES)[number]["id"];

/** Numer przypisu (od 1) dla źródła. */
export function h55SourceNumber(id: H55SourceId): number {
  return H55_SOURCES.findIndex((source) => source.id === id) + 1;
}
