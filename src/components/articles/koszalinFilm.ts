import type { ArticleSource } from "./jgpIntroSources";

/**
 * Źródła artykułu „Koszalin: H52 i H53 miesiąc po miesiącu” (film: scena 6 filmu o Szpitalu Wojewódzkim w Koszalinie).
 * Kolejność = numer przypisu (pierwsze użycie we wstępie). Liczby są w filmie na stałe, więc wstęp też ma stałe liczby.
 */

export const KOSZALIN_FILM_SOURCES = [
  {
    id: "jgp",
    title: "Otwarte dane NFZ o hospitalizacjach (dane.gov.pl) i zestawienie świadczeń rozliczonych przez NFZ, grupy H52 i H53, 2017–2025",
    note: "hospitalizacje H52 i H53 w Szpitalu Wojewódzkim w Koszalinie miesiąc po miesiącu, średnia 10 kolejnych szpitali, wartość świadczeń H52",
    href: "/jgp/H52",
  },
  {
    id: "pobyty",
    title: "Otwarte dane NFZ o hospitalizacjach (dane.gov.pl), długość pobytu, grupy H52 i H53; obliczenia funduszdanych.pl",
    note: "pobyty z wypisem w dniu przyjęcia (0 dni) w Koszalinie i w pozostałych szpitalach",
    href: "/o-danych",
  },
  {
    id: "kontrole",
    title: "NFZ, „Szczegółowe informacje o wynikach kontroli przeprowadzonych przez Departament Kontroli Narodowego Funduszu Zdrowia” (BIP NFZ)",
    note: "daty i zakres obu kontroli w Koszalinie (DK.TWK-X.4840.006.2024 i DK.TWK-X.4840.026.2025), w tym H52 za I–VIII 2023 r., skutki finansowe",
  },
  {
    id: "pytania",
    title: "funduszdanych.pl, „Zabiegi na kręgosłupie: pytania do NFZ”",
    note: "wykres H52 i H53 w Koszalinie z okresami kontroli, pytania o rozliczenia i o model kontroli",
    href: "/artykuly/pytania-zabiegi-kregoslup",
  },
] as const satisfies readonly ArticleSource[];

export type KoszalinFilmSourceId = (typeof KOSZALIN_FILM_SOURCES)[number]["id"];

/** Numer przypisu (od 1) dla źródła. */
export function koszalinFilmSourceNumber(id: KoszalinFilmSourceId): number {
  return KOSZALIN_FILM_SOURCES.findIndex((source) => source.id === id) + 1;
}
