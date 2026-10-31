import type { JgpAdmissionYear, JgpPageData, JgpProviderRow } from "@/lib/jgpPage";
import type { RegionRow } from "@/lib/regions";

/** Mapa województw z `scripts/build_regions_map.py`: ścieżki SVG gotowe do narysowania. */
export interface RegionsMap {
  version: 1;
  source: string;
  viewBox: [number, number];
  /** [kod OW NFZ, nazwa, ścieżka SVG, [x, y] podpisu] */
  regions: [string, string, string, [number, number]][];
}

/** Zakres porównania na karcie grupy: wszyscy świadczeniodawcy albo szpitale podobne do wybranego. */
export type CompareScope = "all" | "peers";

export interface CardFilter {
  selectedKey: string | null;
  scope: CompareScope;
  /** Kody OW NFZ wybrane na mapie (pusta lista = cała Polska). */
  regions: string[];
}

/** Najwięcej województw zaznaczonych naraz (tyle kolorów linii na wykresie). */
export const MAX_REGIONS = 6;

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
  if (filter.regions.length) {
    const allowed = new Set(filter.regions);
    rows = rows.filter((row) => allowed.has(row.owNfz));
  }
  return rows;
}

/**
 * Średnia krocząca z `window` ostatnich miesięcy. Na początku serii średnia z dostępnych miesięcy,
 * jeśli jest ich co najmniej `minPeriods` (domyślnie 1: pierwszy miesiąc = jego wartość).
 */
export function movingAverage(values: number[], window = 3, minPeriods = 1): (number | null)[] {
  return values.map((_, i) => {
    const part = values.slice(Math.max(0, i + 1 - window), i + 1);
    return part.length < minPeriods ? null : part.reduce((sum, value) => sum + value, 0) / part.length;
  });
}

/** Tryb przyjęcia w latach dla grupy świadczeniodawców (suma ich struktur rocznych). */
export function poolAdmissions(rows: JgpProviderRow[]): JgpAdmissionYear[] {
  const years = new Map<string, JgpAdmissionYear>();
  for (const row of rows) {
    for (const point of row.yearly) {
      const sum = years.get(point.year) ?? { year: point.year, total: 0, planned: 0, urgent: 0, other: 0 };
      sum.total += point.total;
      sum.planned += point.planned;
      sum.urgent += point.urgent;
      sum.other += point.other;
      years.set(point.year, sum);
    }
  }
  return [...years.values()].sort((a, b) => a.year.localeCompare(b.year));
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
  /** Wskaźnik województwa jako wielokrotność średniej Polski (1 = średnia). */
  ratio: number;
  /** Położenie na skali koloru od −1 (½ średniej i mniej) przez 0 (średnia) do 1 (2 × średnia i więcej). */
  position: number;
}

export interface CartogramScale {
  /** Hospitalizacje na 100 tys. mieszkańców w całej Polsce — środek skali. */
  national: number;
  /** Wielokrotność średniej na końcach skali (2 → od ½ × do 2 ×). */
  limit: number;
}

/** Końce skali kolorów: połowa i dwukrotność średniej Polski. */
export const RATIO_LIMIT = 2;

/**
 * Komórki mapy województw. Kolor pokazuje odchylenie od średniej Polski w skali logarytmicznej:
 * ½ × i 2 × średniej są równo oddalone od środka, a skala jest taka sama dla każdej grupy JGP —
 * niezależnie od tego, czy wskaźniki wynoszą 20 czy 150 na 100 tys. Wartości od 2 × wzwyż
 * (i od ½ × w dół) mają kolor końca skali; dokładną wartość pokazuje podpis.
 */
export function cartogramCells(regions: RegionRow[]): { cells: CartogramCell[]; scale: CartogramScale } {
  const people = regions.reduce((sum, row) => sum + row.population, 0);
  const national = people ? (regions.reduce((sum, row) => sum + row.hospitalizations, 0) / people) * 100_000 : 0;
  const limit = Math.log2(RATIO_LIMIT);
  const cells = regions.flatMap((row) => {
    const layout = CARTOGRAM_LAYOUT[row.owNfz];
    if (!layout) return [];
    const ratio = national ? row.per100k / national : 1;
    const position = ratio > 0 ? Math.max(-1, Math.min(1, Math.log2(ratio) / limit)) : -1;
    return [{ ...row, column: layout[0], row: layout[1], shortName: layout[2], ratio, position }];
  });
  return { cells, scale: { national, limit: RATIO_LIMIT } };
}

// Jedna barwa jak wcześniej: od jasnoniebieskiego (½ × średniej i mniej) przez średni niebieski
// (średnia Polski) do granatowego (2 × średniej i więcej).
const STOPS: [number, number[]][] = [[-1, [225, 233, 245]], [0, [110, 145, 204]], [1, [16, 42, 92]]];

function rgbAt(position: number): number[] {
  const t = Math.min(1, Math.max(-1, position));
  const [[p0, c0], [p1, c1]] = t <= 0 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const k = (t - p0) / (p1 - p0);
  return c0.map((value, i) => Math.round(value + (c1[i] - value) * k));
}

/** Kolor dla położenia na skali −1…1. */
export function scaleColor(position: number): string {
  const [r, g, b] = rgbAt(position);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Kolor komórki mapy. */
export function cellColor(cell: Pick<CartogramCell, "position">): string {
  return scaleColor(cell.position);
}

/** Czy podpis na komórce ma być ciemny (jasne tło). */
export function darkLabel(cell: Pick<CartogramCell, "position">): boolean {
  const [r, g, b] = rgbAt(cell.position);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}
