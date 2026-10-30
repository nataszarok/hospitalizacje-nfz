import type { SearchIndex } from "@/lib/search";

/** Mały indeks wyszukiwarki: E10 ma kartę, pozostałe grupy prowadzą do eksploratora. */
export const searchIndexFixture: SearchIndex = {
  version: 1,
  year: "2025",
  groups: [
    ["E11", "OZW - leczenie inwazyjne dwuetapowe > 3 dni", 9888],
    ["E10", "OZW - diagnostyka inwazyjna", 8326],
    ["E27", "Koronarografia i inne zabiegi inwazyjne", 92405],
    ["N01", "Poród", 126576],
  ],
  hospitals: [
    ["07|5220002529", "UNIWERSYTECKIE CENTRUM KLINICZNE WARSZAWSKIEGO UNIWERSYTETU MEDYCZNEGO", "WARSZAWA", "07", 83747],
    ["04|9251723350", "WIELOSPECJALISTYCZNY SZPITAL W NOWEJ SOLI", "NOWA SÓL", "04", 18506],
    ["12|6751209442", "SCANMED", "WARSZAWA", "12", 9000],
    ["05|6751209442", "SCANMED", "WARSZAWA", "05", 5000],
    ["06|6751199442", "SZPITAL UNIWERSYTECKI W KRAKOWIE", "KRAKÓW", "06", 60993],
    ["04|9252028623", "NIEPUBLICZNY ZAKŁAD OPIEKI ZDROWOTNEJ ARS MEDICA", "NOWA SÓL", "04", 300],
  ],
  regions: [["04", "Lubuskie"], ["05", "Łódzkie"], ["06", "Małopolskie"], ["07", "Mazowieckie"], ["12", "Śląskie"], ["02", "Kujawsko-Pomorskie"]],
};
