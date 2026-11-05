/**
 * Treści redakcyjne kart grup JGP, na razie dla grup z nową kartą (E10, H52, H55).
 * Słownik NFZ podaje tylko nazwy grup, więc opisy są pisane ręcznie na podstawie nazw i katalogu.
 * Rodziny to warianty, między którymi przesuwa się kodowanie tego samego problemu (decyzja: lista ręczna).
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

/** Krótki opis grupy (1–2 zdania): co obejmuje i czym różni się od innych wariantów rodziny. */
export const JGP_DESCRIPTIONS: Record<string, string> = {
  E10: "Hospitalizacja z powodu ostrego zespołu wieńcowego, w której wykonano diagnostykę inwazyjną (zwykle koronarografię), ale nie zabieg udrożnienia tętnic. Inne warianty rodziny OZW obejmują leczenie inwazyjne (np. angioplastykę) i leczenie zachowawcze.",
  H52: "Operacje kręgosłupa z użyciem implantów, np. stabilizacji albo implantów międzytrzonowych. Tańsze warianty rodziny to zabiegi bez implantów (H53) i zabiegi przezskórne lub artroskopowe (H55); najbardziej złożone korekcje to H51.",
  H55: "Małoinwazyjne zabiegi na kręgosłupie wykonywane przezskórnie albo artroskopowo, np. zabiegi przeciwbólowe w okolicy nerwów i stawów kręgosłupa. Większość pobytów kończy się tego samego dnia (pobyty „0 dni”).",
};
