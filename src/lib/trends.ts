import { productTrend, type ProductTrend, type TrendPoint, type TrendsDataset } from "@/lib/staticData";
import type { EstimationMethod } from "@/lib/types";

export interface ProductCoverage {
  code: string;
  jgpCode: string | null;
  name: string | null;
  /** Lata, w których produkt występuje w danych. */
  years: string[];
}

/** Wybrane produkty, których nie ma we wszystkich latach (zmiana katalogu JGP). */
export function incompleteCoverage(t: TrendsDataset, productCodes: string[]): ProductCoverage[] {
  const selected = new Set(productCodes);
  return t.products
    .filter(([code, , , years]) => selected.has(code) && years.length < t.years.length)
    .map(([code, jgpCode, name, years]) => ({ code, jgpCode, name, years }));
}

/** Kody produktów przypisane do grupy JGP we wszystkich latach. */
export function productCodesForJgp(t: TrendsDataset, jgpCode: string): string[] {
  return t.products.filter(([, jgp]) => jgp === jgpCode).map(([code]) => code);
}

/** Seria wykresu w czasie w formacie `GroupLineChart` (karta grupy JGP): wartości miesięcy i opcjonalny mianownik. */
export interface TrendChartLine {
  key: string;
  name: string;
  values: number[];
  /** Mianownik udziału (hospitalizacje): wykres pokazuje `values / base` w %. */
  base?: number[];
}

export type TrendChartMetric = "hospitalizations" | "mortality" | "urgent";

/**
 * Miesiące wykresu „RRRR-MM”: od pierwszego do ostatniego roku, w którym występuje któraś z wybranych grup;
 * w ostatnim roku danych tylko miesiące, które są w pliku (rok może być niepełny).
 */
export function trendMonths(t: TrendsDataset, productCodes: string[]): string[] {
  const selected = new Set(productCodes);
  const present = new Set(t.products.filter(([code]) => selected.has(code)).flatMap(([, , , years]) => years));
  const years = t.years.filter((year) => present.has(year));
  if (!years.length) return [];
  const lastDataYear = t.years.at(-1)!;
  const lastMonth = Math.max(1, ...t.monthly.filter(([year]) => year === lastDataYear).map(([, month]) => month));
  const from = t.years.indexOf(years[0]), to = t.years.indexOf(years.at(-1)!);
  return t.years.slice(from, to + 1).flatMap((year) => Array.from({ length: year === lastDataYear ? lastMonth : 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));
}

/** Wartości miary w podanych miesiącach (brak danych = 0). Udziały mają mianownik w `base`. */
function lineValues(trend: ProductTrend, months: string[], metric: TrendChartMetric): Pick<TrendChartLine, "values" | "base"> {
  const byMonth = new Map(trend.monthly.map((p) => [`${p.year}-${String(p.month).padStart(2, "0")}`, p]));
  const pick = (read: (p: TrendPoint) => number) => months.map((month) => { const p = byMonth.get(month); return p ? read(p) : 0; });
  const hospitalizations = pick((p) => p.hospitalizations);
  if (metric === "hospitalizations") return { values: hospitalizations };
  return { values: pick((p) => metric === "mortality" ? p.deaths : p.urgent), base: hospitalizations };
}

/**
 * Serie wykresu „W czasie”: jedna seria dla wszystkich wybranych grup razem albo (`perGroup`) osobna seria
 * dla każdej grupy JGP, podpisana kodem JGP.
 */
export function trendChartLines(
  t: TrendsDataset,
  productCodes: string[],
  method: EstimationMethod,
  metric: TrendChartMetric,
  perGroup: boolean,
  months: string[],
): TrendChartLine[] {
  if (!perGroup) return [{ key: "all", name: "Wybrane grupy JGP", ...lineValues(productTrend(t, productCodes, method), months, metric) }];
  const jgpCodes = new Map(t.products.map(([code, jgpCode]) => [code, jgpCode]));
  return productCodes.map((code) => ({ key: code, name: jgpCodes.get(code) ?? code, ...lineValues(productTrend(t, [code], method), months, metric) }));
}

/**
 * Zmiana hospitalizacji rok do roku (%) dla `year`; `null`, gdy nie ma poprzedniego roku z danymi, był zerowy
 * albo zestaw grup JGP różni się między porównywanymi latami (zmiana katalogu).
 */
export function yearChangePct(trend: ProductTrend, years: string[], year: string, coverage: ProductCoverage[] = []): number | null {
  const index = years.indexOf(year);
  const current = index >= 0 ? trend.yearly[index] : null;
  const previous = index > 0 ? trend.yearly[index - 1] : null;
  if (!current || !previous || previous.hospitalizations <= 0) return null;
  if (!coverage.every((product) => product.years.includes(year) === product.years.includes(previous.year))) return null;
  return ((current.hospitalizations - previous.hospitalizations) / previous.hospitalizations) * 100;
}

/**
 * Dane wykresu „W czasie” z filtrem długości pobytu (`durationYears`): tylko lata, bez miesięcy.
 * Format `GroupLineChart` wymaga miesięcy, więc wartość roku dzielimy równo na 12 miesięcy — wykres w trybie
 * „Lata” sumuje je z powrotem do wartości roku (udziały: licznik i mianownik dzielone tak samo, udział bez zmian).
 */
export function durationChartData(
  series: Map<string, ({ year: string; hospitalizations: number; deaths: number; urgent: number } | null)[]>,
  years: string[],
  metric: TrendChartMetric,
  perGroup: boolean,
  names: Map<string, string | null>,
): { months: string[]; lines: TrendChartLine[] } {
  const present = years.map((_, i) => [...series.values()].some((points) => points[i] !== null));
  const first = present.indexOf(true), last = present.lastIndexOf(true);
  if (first < 0) return { months: [], lines: [] };
  const shownYears = years.slice(first, last + 1);
  const months = shownYears.flatMap((year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));
  const spread = (values: number[]) => values.flatMap((value) => Array.from({ length: 12 }, () => value / 12));
  const lineOf = (key: string, name: string, points: ({ hospitalizations: number; deaths: number; urgent: number } | null)[]): TrendChartLine => {
    const yearly = points.slice(first, last + 1);
    const hospitalizations = spread(yearly.map((p) => p?.hospitalizations ?? 0));
    if (metric === "hospitalizations") return { key, name, values: hospitalizations };
    return { key, name, values: spread(yearly.map((p) => (metric === "mortality" ? p?.deaths : p?.urgent) ?? 0)), base: hospitalizations };
  };
  if (perGroup) return { months, lines: [...series].map(([code, points]) => lineOf(code, names.get(code) ?? code, points)) };
  const combined = years.map((year, i) => {
    const parts = [...series.values()].map((points) => points[i]).filter((p): p is NonNullable<typeof p> => p !== null);
    return parts.length ? { year, hospitalizations: parts.reduce((s, p) => s + p.hospitalizations, 0), deaths: parts.reduce((s, p) => s + p.deaths, 0), urgent: parts.reduce((s, p) => s + p.urgent, 0) } : null;
  });
  return { months, lines: [lineOf("all", "Wybrane grupy JGP", combined)] };
}
