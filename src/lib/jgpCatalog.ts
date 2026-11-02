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
  /** Hospitalizacje miesięcznie we wszystkich latach trendu. */
  series: number[];
  /** Grupa nie występuje w najnowszym roku (wycofana z katalogu). */
  discontinued: boolean;
  /** Grupa nowa w najnowszym roku. */
  added: boolean;
}

export interface JgpCatalog {
  years: string[];
  latestYear: string;
  previousYear: string | null;
  rows: JgpCatalogRow[];
  totals: { groups: number; latest: number; previous: number; added: number; discontinued: number };
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
    return {
      code,
      name: entry.name.replace(/\s*\*\s*$/, ""),
      procedural: isProceduralJgpName(entry.name),
      previous,
      latest,
      changePct: previous ? ((latest - previous) / previous) * 100 : null,
      mortalityPct: latest ? (entry.deaths / latest) * 100 : 0,
      series: entry.series,
      discontinued: !entry.years.has(latestYear),
      added: Boolean(previousYear) && entry.years.has(latestYear) && !entry.years.has(previousYear!),
    };
  }).sort((a, b) => b.latest - a.latest || a.code.localeCompare(b.code));
  return {
    years,
    latestYear,
    previousYear,
    rows,
    totals: {
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
