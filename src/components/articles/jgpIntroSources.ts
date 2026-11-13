/**
 * Źródła artykułu „Czym są grupy JGP?”. Kolejność = numer przypisu (pierwsze użycie w tekście).
 * Każde źródło sprawdzone przy pisaniu tekstu; `note` mówi, co dokładnie potwierdza.
 */
export interface ArticleSource {
  id: string;
  /** Opis źródła w przypisie. */
  title: string;
  /** Co potwierdza (krótko, dla czytelnika). */
  note: string;
  /** Adres zewnętrzny albo ścieżka w serwisie. */
  href?: string;
}

export const JGP_INTRO_SOURCES = [
  {
    id: "algorytm",
    title: "NFZ, „Opis działania algorytmu JGP”, wersja 1.1.2026, Warszawa, kwiecień 2026 r. (plik DOCX na stronie komunikatu)",
    note: "definicje hospitalizacji, grupy zabiegowej i zachowawczej, kroki grupera, rangi procedur, wiek, czas pobytu, typy umów, osobodni ponad ryczałt, jedna JGP na pobyt i sumowanie świadczeń, wyłączenie OAiIT z grupowania, historia od 2008 r.",
    href: "https://www.nfz.gov.pl/dla-swiadczeniodawcy/jednorodne-grupy-pacjentow/komunikaty-jgp/informacja-dotyczaca-publikacji-opisu-algorytmu-jgp,54.html",
  },
  {
    id: "statystyki",
    title: "NFZ, Statystyki JGP (katalog 1a), grupy G25F i G26F, dane za 2024 r.",
    note: "najczęstsze rozpoznania i procedury w grupach: w G25F rozpoznanie K80.2 ma 50% pobytów, procedurę 51.239 — 95%; K80.0 występuje także w G26F",
    href: "https://statystyki.nfz.gov.pl/",
  },
  {
    id: "zarzadzenie",
    title: "Zarządzenie nr 101/2025/DSOZ Prezesa NFZ z 23 grudnia 2025 r. w sprawie określenia warunków zawierania i realizacji umów w rodzaju leczenie szpitalne oraz leczenie szpitalne — świadczenia wysokospecjalistyczne",
    note: "obowiązujące zarządzenie szpitalne: katalog JGP (wyceny) i charakterystyka JGP",
    href: "https://www.nfz.gov.pl/zarzadzenia-prezesa/zarzadzenia-prezesa-nfz/zarzadzenie-nr-1012025dsoz,7902.html",
  },
  {
    id: "wyceny",
    title: "Katalog JGP z wycenami punktowymi (załącznik do zarządzenia szpitalnego) — wersja w danych serwisu",
    note: "punkty za hospitalizację, hospitalizację planową, liczba dni w wycenie i punkty za osobodzień ponad ryczałt dla grup G25E, G25F, G26E, G26F",
    href: "/jgp",
  },
  {
    id: "krew",
    title: "NFZ, „Komunikat dla Świadczeniodawców i dostawców oprogramowania”, 16.12.2025",
    note: "przetoczenia krwi i jej składników rozliczane jako osobne świadczenia jednostkowe, np. 5.53.01.0001512 „Przetoczenie koncentratu krwinek czerwonych z krwi pełnej”",
    href: "https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/komunikat-dla-swiadczeniodawcow-i-dostawcow-oprogramowania,8867.html",
  },
  {
    id: "oait",
    title: "NFZ, „Sprawozdawanie czynności wykonywanych w opiece nad pacjentem w oddziale anestezjologii i intensywnej terapii (OAiIT)”, 9.11.2018",
    note: "produkty OAiIT wyznaczane odrębnie dla każdego dnia pobytu według skali TISS-28",
    href: "https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/sprawozdawanie-czynnosci-wykonywanych-w-opiece-nad-pacjentem-w-oddziale-anestezjologii-i-intensywnej-terapii-oait,7239.html",
  },
  {
    id: "sor",
    title: "NFZ, „Zwiększenie stawek ryczałtów dobowych dla SOR i IP”, 26.07.2019",
    note: "SOR i izby przyjęć finansowane stawką ryczałtu dobowego",
    href: "https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/zwiekszenie-stawek-ryczaltow-dobowych-dla-sor-i-ip,7412.html",
  },
  {
    id: "chemio",
    title: "NFZ, „Komunikat DGL”, 28.10.2026",
    note: "osobne zarządzenia: chemioterapia (nr 71/2025/DGL) i programy lekowe (nr 75/2026/DGL)",
    href: "https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/komunikat-dgl,9045.html",
  },
  {
    id: "dane",
    title: "Otwarte dane NFZ o hospitalizacjach rozliczonych w grupach JGP (dane.gov.pl); wartości <5 liczone jako 1",
    note: "liczba grup z hospitalizacjami i liczba operacji usunięcia pęcherzyka (G25E i G25F) w najnowszym roku",
    href: "/o-danych",
  },
] as const satisfies readonly ArticleSource[];

export type JgpIntroSourceId = (typeof JGP_INTRO_SOURCES)[number]["id"];

/** Numer przypisu (od 1) dla źródła. */
export function sourceNumber(id: JgpIntroSourceId): number {
  return JGP_INTRO_SOURCES.findIndex((source) => source.id === id) + 1;
}
