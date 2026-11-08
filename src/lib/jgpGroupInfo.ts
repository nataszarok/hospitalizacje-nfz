/**
 * Rodziny grup JGP: warianty, między którymi przesuwa się kodowanie tego samego problemu (decyzja: lista ręczna).
 * Opis grupy powstaje z danych NFZ w `jgpDescription.ts` (dawne opisy redakcyjne usunięte, etap 4c).
 */

export interface JgpFamilyDefinition {
  id: string;
  name: string;
  /** Kody JGP w kolejności katalogu NFZ. */
  codes: string[];
  /** Kody, które świadomie nie należą do rodziny, z powodem (dla czytelnika). */
  note?: string;
}

export const JGP_FAMILIES: JgpFamilyDefinition[] = [
  {
    id: "ozw",
    name: "Ostry zespół wieńcowy (OZW)",
    codes: ["E10", "E11", "E12G", "E15", "E16", "E17G"],
    note: "Wszystkie grupy katalogu z nazwą „OZW”: leczenie zachowawcze, diagnostyka inwazyjna i warianty leczenia inwazyjnego.",
  },
  {
    id: "kregoslup-zabiegi",
    name: "Zabiegi na kręgosłupie",
    codes: ["H51", "H52", "H53", "H55"],
    note: "Bez zespołów bólowych kręgosłupa (H56C, H56D): to grupy zachowawcze, bez zabiegu.",
  },
];

/** Rodzina, do której należy grupa, albo `null`. */
export function familyFor(jgpCode: string): JgpFamilyDefinition | null {
  return JGP_FAMILIES.find((family) => family.codes.includes(jgpCode)) ?? null;
}
