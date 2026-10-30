import type { JgpPageData, JgpProviderRow } from "@/lib/jgpPage";
import type { RegionRow } from "@/lib/regions";

/** Zakres porównania na karcie grupy: wszyscy świadczeniodawcy albo szpitale podobne do wybranego. */
export type CompareScope = "all" | "peers";

export interface CardFilter {
  selectedKey: string | null;
  scope: CompareScope;
  /** Kod OW NFZ wybrany na mapie albo `null`. */
  region: string | null;
}

/** Indeks wybranego świadczeniodawcy w rankingu albo -1. */
export function selectedIndex(data: JgpPageData, key: string | null): number {
  return key ? data.providers.findIndex((row) => row.key === key) : -1;
}

/**
 * Świadczeniodawcy widoczni po filtrach karty, w kolejności rankingu.
 * „Podobne szpitale” = wybrany + jego pary z modelu; województwo = OW NFZ rozliczenia.
 */
export function providerPool(data: JgpPageData, filter: CardFilter): JgpProviderRow[] {
  const selected = selectedIndex(data, filter.selectedKey);
  let rows = data.providers;
  if (filter.scope === "peers" && selected >= 0) {
    const allowed = new Set([selected, ...data.providers[selected].peers]);
    rows = rows.filter((_, i) => allowed.has(i));
  }
  if (filter.region) rows = rows.filter((row) => row.owNfz === filter.region);
  return rows;
}

/** Suma hospitalizacji miesięcznie dla grupy świadczeniodawców. */
export function sumSeries(rows: JgpProviderRow[], length: number): number[] {
  const out = Array.from({ length }, () => 0);
  for (const row of rows) row.series.forEach((value, i) => { out[i] += value; });
  return out;
}

/** Wskaźniki grupy świadczeniodawców (do porównania wybranego szpitala). */
export function poolStats(rows: JgpProviderRow[]) {
  const hospitalizations = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const urgent = rows.reduce((sum, row) => sum + (row.urgentPct / 100) * row.hospitalizations, 0);
  return {
    providers: rows.length,
    hospitalizations,
    deaths,
    mortalityPct: hospitalizations ? (deaths / hospitalizations) * 100 : 0,
    urgentPct: hospitalizations ? (urgent / hospitalizations) * 100 : 0,
  };
}

/** Udział `top` największych świadczeniodawców w hospitalizacjach grupy (%). */
export function topShare(rows: JgpProviderRow[], top = 25): number {
  const total = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const head = rows.slice(0, top).reduce((sum, row) => sum + row.hospitalizations, 0);
  return total ? (head / total) * 100 : 0;
}

/** Zmiana rok do roku (%) albo `null`, gdy brak poprzedniego roku. */
export function yearChangePct(current: number, previous: number | null): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

// Kafelki kartogramu: przybliżone położenie województw na siatce 5 × 4 (kolumna, wiersz, skrót).
const CARTOGRAM_LAYOUT: Record<string, [number, number, string]> = {
  "16": [2, 1, "Zach.-pom."], "11": [3, 1, "Pomorskie"], "14": [4, 1, "Warm.-maz."],
  "08": [2, 3, "Opolskie"], "04": [1, 2, "Lubuskie"], "15": [2, 2, "Wielkopol."], "02": [3, 2, "Kuj.-pom."],
  "07": [4, 2, "Mazowieckie"], "10": [5, 2, "Podlaskie"], "01": [1, 3, "Dolnośl."], "05": [3, 3, "Łódzkie"],
  "13": [4, 3, "Świętokrz."], "03": [5, 3, "Lubelskie"], "12": [3, 4, "Śląskie"], "06": [4, 4, "Małopolskie"], "09": [5, 4, "Podkarpackie"],
};

export interface CartogramCell extends RegionRow {
  column: number;
  row: number;
  shortName: string;
  /** Klasa koloru 1–5 (kwintyle wartości na 100 tys. mieszkańców). */
  level: number;
}

/** Komórki kartogramu województw z klasą koloru według kwintyli wskaźnika na 100 tys. mieszkańców. */
export function cartogramCells(regions: RegionRow[]): CartogramCell[] {
  const sorted = regions.map((row) => row.per100k).sort((a, b) => a - b);
  const cut = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const thresholds = [cut(0.2), cut(0.4), cut(0.6), cut(0.8)];
  return regions.flatMap((row) => {
    const layout = CARTOGRAM_LAYOUT[row.owNfz];
    if (!layout) return [];
    const level = 1 + thresholds.filter((threshold) => row.per100k >= threshold).length;
    return [{ ...row, column: layout[0], row: layout[1], shortName: layout[2], level: Math.min(level, 5) }];
  });
}
