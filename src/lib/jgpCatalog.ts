import { isProceduralJgpName, type TrendsDataset } from "@/lib/staticData";

/** Wiersz katalogu grup JGP (`/jgp`), liczony podczas budowania z `trends.json.gz` (metoda konserwatywna). */
export interface JgpCatalogRow {
  code: string;
  name: string;
  procedural: boolean;
  /** Hospitalizacje w poprzednim i najnowszym roku. */
  previous: number;
  latest: number;
  /** Zmiana r/r (%) albo `null`, gdy grupy nie było w poprzednim roku. */
  changePct: number | null;
  /** Śmiertelność w najnowszym roku (%). */
  mortalityPct: number;
  /** Hospitalizacje miesięcznie we wszystkich latach trendu; `null` w miesiącach, gdy kodu nie było w katalogu. */
  series: (number | null)[];
  /** Grupa nie występuje w najnowszym roku (wycofana z katalogu). */
  discontinued: boolean;
  /** Grupa nowa w najnowszym roku. */
  added: boolean;
  /** Okresy obecności kodu w katalogu: pary [rok od, rok do], np. `[["2017", "2019"], ["2022", "2025"]]`. */
  ranges: [string, string][];
  /** Hospitalizacje w ostatnim roku obecności kodu (dla grup wycofanych: rok wycofania). */
  lastYearTotal: number;
}

export interface JgpCatalog {
  years: string[];
  latestYear: string;
  previousYear: string | null;
  rows: JgpCatalogRow[];
  totals: { all: number; groups: number; latest: number; previous: number; added: number; discontinued: number };
}

/** Czy kod był w katalogu w danym roku. */
export const inCatalogYear = (row: Pick<JgpCatalogRow, "ranges">, year: string | null) =>
  Boolean(year) && row.ranges.some(([from, to]) => from <= year! && year! <= to);

/** Okresy kolejnych lat, w których kod był w katalogu. */
export function activeRanges(years: string[], activeYears: Set<string>): [string, string][] {
  const ranges: [string, string][] = [];
  years.forEach((year, i) => {
    if (!activeYears.has(year)) return;
    if (i > 0 && activeYears.has(years[i - 1])) ranges[ranges.length - 1][1] = year;
    else ranges.push([year, year]);
  });
  return ranges;
}

/**
 * Etykieta dostępności kodu: „od 2019”, „do 2021”, „2018–2021” albo kilka okresów po przecinku.
 * `null`, gdy kod był w katalogu przez cały zakres danych.
 */
export function availabilityLabel(ranges: [string, string][], years: string[]): string | null {
  const first = years[0];
  const last = years.at(-1);
  if (!ranges.length) return null;
  if (ranges.length === 1) {
    const [from, to] = ranges[0];
    if (from === first && to === last) return null;
    if (from === first) return `do ${to}`;
    if (to === last) return `od ${from}`;
    return from === to ? from : `${from}–${to}`;
  }
  return ranges.map(([from, to]) => (from === to ? from : `${from}–${to}`)).join(", ");
}

/**
 * Miesiące, w których kod istniał: lata z katalogu grupy, a w roku wejścia i wycofania kodu
 * bez pustych miesięcy przed pierwszą i po ostatniej hospitalizacji (kod zmieniony w trakcie roku).
 * Pierwszego i ostatniego roku trendu nie przycinamy — kod mógł istnieć przed i po zakresie danych.
 */
export function limitSeriesToActiveYears(series: number[], years: string[], activeYears: Set<string>): (number | null)[] {
  const result: (number | null)[] = years.flatMap((year, y) => series.slice(y * 12, y * 12 + 12).map((value) => (activeYears.has(year) ? value : null)));
  years.forEach((year, y) => {
    if (!activeYears.has(year)) return;
    const months = result.slice(y * 12, y * 12 + 12) as number[];
    if (y > 0 && !activeYears.has(years[y - 1])) {
      const first = months.findIndex((value) => value > 0);
      for (let m = 0; m < (first < 0 ? 12 : first); m += 1) result[y * 12 + m] = null;
    }
    if (y < years.length - 1 && !activeYears.has(years[y + 1])) {
      let last = 11;
      while (last >= 0 && !(months[last] > 0)) last -= 1;
      for (let m = last + 1; m < 12; m += 1) result[y * 12 + m] = null;
    }
  });
  return result;
}

/** Katalog grup: jeden wiersz na kod JGP, od największej liczby hospitalizacji w najnowszym roku. */
export function buildJgpCatalog(trends: TrendsDataset): JgpCatalog {
  const years = trends.years;
  const latestYear = years.at(-1) ?? "";
  const previousYear = years.length > 1 ? years[years.length - 2] : null;
  const byCode = new Map<string, { name: string; years: Set<string>; series: number[]; deaths: number }>();
  const groupOf = trends.products.map(([, jgp, name, productYears]) => {
    if (!jgp) return null;
    const entry = byCode.get(jgp) ?? { name: (name ?? jgp).trim(), years: new Set<string>(), series: years.flatMap(() => Array<number>(12).fill(0)), deaths: 0 };
    for (const year of productYears) entry.years.add(year);
    // Nazwa z najnowszego produktu grupy.
    if (productYears.includes(latestYear) && name) entry.name = name.trim();
    byCode.set(jgp, entry);
    return entry;
  });
  for (const [year, month, product, , , hMin, , dMin] of trends.monthly) {
    const entry = groupOf[product];
    const yearIndex = years.indexOf(year);
    if (!entry || yearIndex < 0) continue;
    entry.series[yearIndex * 12 + month - 1] += hMin;
    if (year === latestYear) entry.deaths += dMin;
  }
  const sumYear = (series: number[], year: string | null) => {
    const i = year ? years.indexOf(year) : -1;
    return i < 0 ? 0 : series.slice(i * 12, i * 12 + 12).reduce((sum, value) => sum + value, 0);
  };
  const rows = [...byCode.entries()].map(([code, entry]): JgpCatalogRow => {
    const latest = sumYear(entry.series, latestYear);
    const previous = sumYear(entry.series, previousYear);
    const ranges = activeRanges(years, entry.years);
    return {
      code,
      name: entry.name.replace(/\s*\*\s*$/, ""),
      procedural: isProceduralJgpName(entry.name),
      previous,
      latest,
      changePct: previous ? ((latest - previous) / previous) * 100 : null,
      mortalityPct: latest ? (entry.deaths / latest) * 100 : 0,
      series: limitSeriesToActiveYears(entry.series, years, entry.years),
      discontinued: !entry.years.has(latestYear),
      added: Boolean(previousYear) && entry.years.has(latestYear) && !entry.years.has(previousYear!),
      ranges,
      lastYearTotal: sumYear(entry.series, ranges.at(-1)?.[1] ?? null),
    };
  }).sort((a, b) => b.latest - a.latest || a.code.localeCompare(b.code));
  return {
    years,
    latestYear,
    previousYear,
    rows,
    totals: {
      all: rows.length,
      groups: rows.filter((row) => !row.discontinued).length,
      latest: rows.reduce((sum, row) => sum + row.latest, 0),
      previous: rows.reduce((sum, row) => sum + row.previous, 0),
      added: rows.filter((row) => row.added).length,
      discontinued: rows.filter((row) => row.discontinued).length,
    },
  };
}

/** Największe wzrosty i spadki r/r wśród grup z co najmniej `minPrevious` hospitalizacji w poprzednim roku. */
export function biggestChanges(rows: JgpCatalogRow[], minPrevious = 1000, limit = 3) {
  const eligible = rows.filter((row) => row.previous >= minPrevious && row.changePct !== null && !row.discontinued);
  const byChange = [...eligible].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  return { up: byChange.slice(0, limit), down: byChange.reverse().slice(0, limit) };
}
