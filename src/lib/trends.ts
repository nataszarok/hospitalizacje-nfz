import type { ProductTrend, TrendPoint, TrendsDataset } from "@/lib/staticData";

/** Podsumowanie trendu dla najnowszego roku, w którym wybrane produkty występują. */
export interface TrendSummary {
  year: string;
  previousYear: string | null;
  hospitalizations: number;
  /** Zmiana r/r w %; `null`, gdy nie ma poprzedniego roku z danymi albo był zerowy. */
  changePct: number | null;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

/**
 * `coverage`: produkty spoza części lat (`incompleteCoverage`). Gdy zestaw grup różni się między
 * porównywanymi latami, zmiana r/r porównywałaby różne zakresy — wtedy `changePct` = `null`.
 */
export function trendSummary(trend: ProductTrend, coverage: ProductCoverage[] = []): TrendSummary | null {
  const points = trend.yearly.filter((point): point is TrendPoint => point !== null);
  const current = points.at(-1);
  if (!current) return null;
  const previous = points.at(-2) ?? null;
  const share = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;
  return {
    year: current.year,
    previousYear: previous?.year ?? null,
    hospitalizations: current.hospitalizations,
    changePct: previous && previous.hospitalizations > 0
      && coverage.every((product) => product.years.includes(current.year) === product.years.includes(previous.year))
      ? ((current.hospitalizations - previous.hospitalizations) / previous.hospitalizations) * 100
      : null,
    deaths: current.deaths,
    mortalityPct: share(current.deaths, current.hospitalizations),
    urgentPct: share(current.urgent, current.hospitalizations),
  };
}

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

export interface MonthlySeriesPoint {
  /** Data w formacie `RRRR-MM-01` (oś czasu Plotly). */
  date: string;
  year: string;
  month: number;
  /** `null` = brak produktu w katalogu w tym roku (przerwa na wykresie, nie zero). */
  point: TrendPoint | null;
}

/** Pełna oś miesięcy dla wszystkich lat; miesiące bez hospitalizacji mają zera, lata spoza katalogu `null`. */
export function monthlySeries(trend: ProductTrend, years: string[]): MonthlySeriesPoint[] {
  const presentYears = new Set(trend.yearly.filter((p): p is TrendPoint => p !== null).map((p) => p.year));
  const byKey = new Map(trend.monthly.map((p) => [`${p.year}|${p.month}`, p]));
  return years.flatMap((year) => Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const point = presentYears.has(year)
      ? byKey.get(`${year}|${month}`) ?? { year, month, hospitalizations: 0, deaths: 0, planned: 0, urgent: 0 }
      : null;
    return { date: `${year}-${String(month).padStart(2, "0")}-01`, year, month, point };
  }));
}
