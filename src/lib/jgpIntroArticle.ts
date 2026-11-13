import { formatJgpName } from "@/lib/formatters";
import type { JgpCatalog } from "@/lib/jgpCatalog";
import type { DatasetHighlights } from "@/lib/staticData";
import type { JgpValuation } from "@/lib/valuations";

/**
 * Grupy w przykładzie artykułu „Czym są grupy JGP?” (kamica pęcherzyka żółciowego):
 * wycięcie pęcherzyka (G25F do 65 lat, G25E powyżej 65 lat) i leczenie bez operacji (G26F, G26E).
 */
export const GALLBLADDER_CODES = ["G25F", "G25E", "G26F", "G26E"] as const;
export type GallbladderCode = (typeof GALLBLADDER_CODES)[number];

export interface ExampleGroupFact {
  code: string;
  name: string;
  /** Kod produktu z katalogu wycen; `null`, gdy grupy nie ma w katalogu. */
  productCode: string | null;
  /** Wycena hospitalizacji (pkt) w katalogu `valuationYear`. */
  points: number | null;
  /** Wycena hospitalizacji planowej (pkt); `null`, gdy katalog jej nie podaje. */
  plannedPoints: number | null;
  /** Liczba dni pobytu w wycenie grupy; `null`, gdy katalog jej nie podaje. */
  daysFinanced: number | null;
  /** Punkty za każdy dzień ponad tę liczbę. */
  extraDayPoints: number | null;
  /** Hospitalizacje w najnowszym roku danych (metoda konserwatywna). */
  hospitalizations: number;
}

export interface JgpIntroFacts {
  latestYear: string;
  valuationYear: string;
  /** Grupy JGP w danych najnowszego roku (jak na stronie głównej: `datasetHighlights`). */
  groupsInLatestYear: number;
  /** Hospitalizacje w najnowszym roku (metoda konserwatywna, `datasetHighlights`). */
  hospitalizationsInLatestYear: number;
  groups: Record<GallbladderCode, ExampleGroupFact>;
}

/**
 * Liczby do artykułu „Czym są grupy JGP?”, liczone podczas budowania: sumy roku z pliku roku (to samo źródło co strona główna),
 * grupy przykładu z katalogu `/jgp` (trendy) i z katalogu wycen.
 */
export function buildJgpIntroFacts(
  catalog: JgpCatalog,
  valuations: { year: string; rows: JgpValuation[] },
  latestYear: Pick<DatasetHighlights, "hospitalizations" | "jgpGroups">,
): JgpIntroFacts {
  const rows = new Map(catalog.rows.map((row) => [row.code, row]));
  const prices = new Map(valuations.rows.map((row) => [row.kod_jgp, row]));
  const group = (code: GallbladderCode): ExampleGroupFact => {
    const row = rows.get(code);
    const price = prices.get(code);
    return {
      code,
      name: row ? formatJgpName(row.name) : code,
      productCode: price?.kod_produktu ?? null,
      points: price?.pkt_hospitalizacja ?? null,
      plannedPoints: price?.pkt_hospitalizacja_planowa ?? null,
      daysFinanced: price?.dni_finansowane_grupa ?? null,
      extraDayPoints: price?.pkt_osobodzien_ponad_ryczalt ?? null,
      hospitalizations: row?.latest ?? 0,
    };
  };
  return {
    latestYear: catalog.latestYear,
    valuationYear: valuations.year,
    groupsInLatestYear: latestYear.jgpGroups,
    hospitalizationsInLatestYear: latestYear.hospitalizations,
    groups: Object.fromEntries(GALLBLADDER_CODES.map((code) => [code, group(code)])) as Record<GallbladderCode, ExampleGroupFact>,
  };
}

/**
 * Wycena pobytu dłuższego niż liczba dni w wycenie grupy: punkty grupy + punkty za każdy dzień ponad limit
 * (w uproszczeniu: dni pobytu − dni w wycenie). `null`, gdy katalog nie podaje którejś wartości.
 */
export function longStayPoints(group: Pick<ExampleGroupFact, "points" | "daysFinanced" | "extraDayPoints">, stayDays: number): number | null {
  if (group.points === null || group.daysFinanced === null || group.extraDayPoints === null) return null;
  return group.points + Math.max(0, stayDays - group.daysFinanced) * group.extraDayPoints;
}
