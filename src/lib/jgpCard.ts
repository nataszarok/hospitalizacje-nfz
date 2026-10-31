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
  /** Położenie na skali koloru 0–1 (liniowo od minimum do maksimum bez wartości odstających). */
  scale: number;
  /** Wartość skrajnie odstająca w górę (powyżej Q3 + 3 × IQR): osobny, najciemniejszy kolor spoza skali. */
  outlier: boolean;
}

export interface CartogramScale { min: number; max: number }

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * (position - lower);
}

/**
 * Komórki kartogramu województw. Kolor zależy liniowo od wskaźnika na 100 tys. mieszkańców,
 * ale skala kończy się na największej wartości nieodstającej — jedno województwo z bardzo wysokim
 * wynikiem nie spłaszcza różnic między pozostałymi.
 */
export function cartogramCells(regions: RegionRow[]): { cells: CartogramCell[]; scale: CartogramScale } {
  const sorted = regions.map((row) => row.per100k).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  // 3 × IQR: tylko wartości skrajnie odstające (np. lubuskie w E10), nie zwykłe różnice regionalne.
  const fence = q3 + 3 * (q3 - q1);
  const inRange = sorted.filter((value) => value <= fence);
  const min = inRange[0] ?? 0;
  const max = inRange.at(-1) ?? 0;
  const cells = regions.flatMap((row) => {
    const layout = CARTOGRAM_LAYOUT[row.owNfz];
    if (!layout) return [];
    const outlier = row.per100k > fence;
    const scale = outlier ? 1 : max > min ? (row.per100k - min) / (max - min) : 0.5;
    return [{ ...row, column: layout[0], row: layout[1], shortName: layout[2], scale, outlier }];
  });
  return { cells, scale: { min, max } };
}

// Skala dla wartości nieodstających kończy się na średnim niebieskim; wartości odstające mają
// wyraźnie ciemniejszy kolor, żeby nie wyglądały jak maksimum skali.
const LIGHT = [225, 233, 245];
const DARK = [40, 86, 163];
export const OUTLIER_COLOR = "rgb(10, 27, 61)";

/** Kolor kafelka dla położenia na skali 0–1 (od jasnego do średniego niebieskiego). */
export function scaleColor(scale: number): string {
  const t = Math.min(1, Math.max(0, scale));
  const [r, g, b] = LIGHT.map((value, i) => Math.round(value + (DARK[i] - value) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Kolor komórki kartogramu: wartość odstająca ma własny kolor spoza skali. */
export function cellColor(cell: Pick<CartogramCell, "scale" | "outlier">): string {
  return cell.outlier ? OUTLIER_COLOR : scaleColor(cell.scale);
}
