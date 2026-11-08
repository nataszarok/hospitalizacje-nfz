import type { StaticDataset, TrendsDataset } from "@/lib/staticData";
import type { EstimationMethod } from "@/lib/types";

export interface RegionRow {
  owNfz: string;
  name: string;
  population: number;
  hospitalizations: number;
  per100k: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

/**
 * Hospitalizacje wybranych produktów w województwach (OW NFZ świadczeniodawcy) w jednym roku.
 * Wszystkie województwa ze słownika, także te bez hospitalizacji. Kolejność: najwięcej na 100 tys.
 */
export function regionalBreakdown(
  t: TrendsDataset,
  productCodes: string[],
  year: string,
  method: EstimationMethod,
  regions: [string, string][],
  populations: [string, number][],
): RegionRow[] {
  const selected = new Set(productCodes);
  const included = new Set(t.products.flatMap(([code], index) => selected.has(code) ? [index] : []));
  const totals = new Map<string, { h: number; d: number; urgent: number }>();
  for (const [rowYear, ow, product, group, hSim, hMin, dSim, dMin] of t.regional) {
    if (rowYear !== year || !included.has(product)) continue;
    const total = totals.get(ow) ?? { h: 0, d: 0, urgent: 0 };
    const h = method === "sim" ? hSim : hMin;
    total.h += h;
    total.d += method === "sim" ? dSim : dMin;
    if (group === "u") total.urgent += h;
    totals.set(ow, total);
  }
  const population = new Map(populations);
  return regions.map(([owNfz, name]): RegionRow => {
    const total = totals.get(owNfz) ?? { h: 0, d: 0, urgent: 0 };
    const people = population.get(owNfz) ?? 0;
    return {
      owNfz,
      name,
      population: people,
      hospitalizations: total.h,
      per100k: people ? (total.h / people) * 100_000 : 0,
      deaths: total.d,
      mortalityPct: total.h ? (total.d / total.h) * 100 : 0,
      urgentPct: total.h ? (total.urgent / total.h) * 100 : 0,
    };
  }).sort((a, b) => b.per100k - a.per100k || a.name.localeCompare(b.name, "pl"));
}

export interface CityRow {
  city: string;
  /** Województwa (OW NFZ), w których świadczeniodawcy z miasta mają hospitalizacje. */
  regions: string[];
  providers: number;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

/**
 * Hospitalizacje wybranych produktów według miasta siedziby świadczeniodawcy (jeden rok).
 * `owNfz`: tylko hospitalizacje rozliczone w tym OW. Kolejność: najwięcej hospitalizacji.
 * Danych o liczbie mieszkańców miast nie ma, więc nie liczymy wskaźnika na 100 tys.
 */
export function cityBreakdown(d: StaticDataset, productCodes: string[], method: EstimationMethod, owNfz?: string): CityRow[] {
  const selected = new Set(productCodes);
  const cities = new Map(d.facilities.map(([ow, nip, , city]) => [`${ow}|${nip}`, city.trim()]));
  const totals = new Map<string, { h: number; d: number; urgent: number; providers: Set<string>; regions: Set<string> }>();
  for (const [ow, nip, product, , admission, hSim, hMin, dSim, dMin] of d.facts) {
    if (!selected.has(product) || (owNfz && ow !== owNfz)) continue;
    const city = cities.get(`${ow}|${nip}`);
    if (!city) continue;
    const total = totals.get(city) ?? { h: 0, d: 0, urgent: 0, providers: new Set<string>(), regions: new Set<string>() };
    const h = method === "sim" ? hSim : hMin;
    total.h += h;
    total.d += method === "sim" ? dSim : dMin;
    if (admission === "2" || admission === "3") total.urgent += h;
    total.providers.add(`${ow}|${nip}`);
    total.regions.add(ow);
    totals.set(city, total);
  }
  return [...totals.entries()].map(([city, total]): CityRow => ({
    city,
    regions: [...total.regions].sort(),
    providers: total.providers.size,
    hospitalizations: total.h,
    deaths: total.d,
    mortalityPct: total.h ? (total.d / total.h) * 100 : 0,
    urgentPct: total.h ? (total.urgent / total.h) * 100 : 0,
  })).sort((a, b) => b.hospitalizations - a.hospitalizations || a.city.localeCompare(b.city, "pl"));
}
