import { biggestChanges, buildJgpCatalog } from "@/lib/jgpCatalog";
import { cartogramCells, type CartogramCell, type RegionsMap } from "@/lib/jgpCard";
import { regionalBreakdown } from "@/lib/regions";
import type { StaticDataset, TrendsDataset } from "@/lib/staticData";

/** Rok na wykresach strony głównej (wszystkie grupy JGP, metoda konserwatywna jak w eksploratorze). */
export interface HomeYear {
  year: string;
  hospitalizations: number;
  /** Udziały trybów przyjęcia w % (nagłe: tryb 2 i 3, planowe: tryb 6, reszta: pozostałe). */
  urgentPct: number;
  plannedPct: number;
  otherPct: number;
  /** Liczba miesięcy z danymi (rok niepełny ma mniej niż 12). */
  months: number;
}

/** Grupa JGP na liście strony głównej. */
export interface HomeGroup {
  code: string;
  name: string;
  latest: number;
  previous: number;
  changePct: number | null;
}

/** Liczby do sekcji „Liczby, które warto znać”. Liczone podczas budowania. */
export interface HomeStats {
  latestYear: string;
  previousYear: string | null;
  years: HomeYear[];
  topGroups: HomeGroup[];
  changes: { up: HomeGroup[]; down: HomeGroup[] };
  /** Mapa województw w najnowszym roku (na 100 tys. mieszkańców); `null`, gdy brak granic albo ludności. */
  regions: { map: RegionsMap; cells: CartogramCell[]; national: number } | null;
}

const share = (part: number, total: number) => (total ? (part / total) * 100 : 0);

function homeYears(trends: TrendsDataset): HomeYear[] {
  const totals = new Map(trends.years.map((year) => [year, { h: 0, urgent: 0, planned: 0, months: new Set<number>() }]));
  for (const [year, month, , group, , hMin] of trends.monthly) {
    const total = totals.get(year);
    if (!total) continue;
    total.h += hMin;
    if (group === "u") total.urgent += hMin;
    else if (group === "p") total.planned += hMin;
    if (hMin > 0) total.months.add(month);
  }
  return trends.years.map((year) => {
    const { h, urgent, planned, months } = totals.get(year)!;
    const urgentPct = share(urgent, h);
    const plannedPct = share(planned, h);
    return { year, hospitalizations: h, urgentPct, plannedPct, otherPct: h ? 100 - urgentPct - plannedPct : 0, months: months.size };
  });
}

const toGroup = ({ code, name, latest, previous, changePct }: HomeGroup): HomeGroup => ({ code, name, latest, previous, changePct });

/**
 * Liczby strony głównej: hospitalizacje i tryb przyjęcia w latach, najczęstsze grupy JGP,
 * największe zmiany r/r i mapa województw. `latest`: zbiór najnowszego roku (słownik województw i ludność).
 */
export function buildHomeStats(trends: TrendsDataset, latest: StaticDataset, map: RegionsMap | null, topLimit = 6): HomeStats {
  const catalog = buildJgpCatalog(trends);
  const active = catalog.rows.filter((row) => !row.discontinued);
  const changes = biggestChanges(catalog.rows, 1000, 3);
  const allProducts = trends.products.map(([code]) => code);
  const breakdown = regionalBreakdown(trends, allProducts, catalog.latestYear, "min", latest.regions, latest.populations);
  const { cells, scale } = cartogramCells(breakdown);
  const hasPopulation = cells.some((cell) => cell.population > 0);
  return {
    latestYear: catalog.latestYear,
    previousYear: catalog.previousYear,
    years: homeYears(trends),
    topGroups: active.slice(0, topLimit).map(toGroup),
    changes: { up: changes.up.map(toGroup), down: changes.down.map(toGroup) },
    regions: map && hasPopulation ? { map, cells, national: scale.national } : null,
  };
}
