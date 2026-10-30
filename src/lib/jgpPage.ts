import type { StaticDataset, TrendsDataset } from "@/lib/staticData";
import { regionalBreakdown, type RegionRow } from "@/lib/regions";
import { productCodesForJgp } from "@/lib/trends";
import type { EstimationMethod } from "@/lib/types";

/** Grupy JGP ze stroną `/jgp/[kod]`. Na start jedna grupa; docelowo cały katalog. */
export const JGP_PAGE_CODES = ["E10"] as const;

export interface JgpProviderRow {
  key: string;
  owNfz: string;
  nip: string;
  name: string;
  city: string;
  voivodeship: string;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

export interface JgpPageData {
  jgpCode: string;
  name: string;
  productCodes: string[];
  /** Lata, w których grupa występuje w danych. */
  catalogYears: string[];
  /** Rok rankingu świadczeniodawców (najnowszy). */
  year: string;
  providerCount: number;
  hospitalizations: number;
  topProviders: JgpProviderRow[];
  /** Województwa w najnowszym roku, od największej liczby na 100 tys. mieszkańców. */
  regions: RegionRow[];
}

/** Dane strony grupy JGP: zakres lat z trendów, ranking świadczeniodawców z najnowszego roku. */
export function buildJgpPageData(trends: TrendsDataset, latest: StaticDataset, jgpCode: string, method: EstimationMethod = "min", limit = 15): JgpPageData | null {
  const productCodes = productCodesForJgp(trends, jgpCode);
  if (!productCodes.length) return null;
  const products = trends.products.filter(([code]) => productCodes.includes(code));
  const catalogYears = trends.years.filter((year) => products.some(([, , , years]) => years.includes(year)));
  // Nazwa z najnowszego produktu, w którym grupa występuje.
  const name = products.at(-1)?.[2]?.trim() ?? jgpCode;

  const selected = new Set(productCodes);
  const facilities = new Map(latest.facilities.map(([ow, nip, facilityName, city]) => [`${ow}|${nip}`, { name: facilityName, city }]));
  const regions = new Map(latest.regions);
  const grouped = new Map<string, { ow: string; nip: string; h: number; d: number; urgent: number }>();
  for (const [ow, nip, product, , admission, hSim, hMin, dSim, dMin] of latest.facts) {
    if (!selected.has(product)) continue;
    const key = `${ow}|${nip}`;
    const row = grouped.get(key) ?? { ow, nip, h: 0, d: 0, urgent: 0 };
    const h = method === "sim" ? hSim : hMin;
    row.h += h;
    row.d += method === "sim" ? dSim : dMin;
    if (admission === "2" || admission === "3") row.urgent += h;
    grouped.set(key, row);
  }

  const rows = [...grouped.entries()].map(([key, row]): JgpProviderRow => ({
    key,
    owNfz: row.ow,
    nip: row.nip,
    name: facilities.get(key)?.name ?? key,
    city: facilities.get(key)?.city.trim() ?? "",
    voivodeship: regions.get(row.ow) ?? row.ow,
    hospitalizations: row.h,
    deaths: row.d,
    mortalityPct: row.h ? (row.d / row.h) * 100 : 0,
    urgentPct: row.h ? (row.urgent / row.h) * 100 : 0,
  })).sort((a, b) => b.hospitalizations - a.hospitalizations || a.name.localeCompare(b.name, "pl"));

  return {
    jgpCode,
    name,
    productCodes,
    catalogYears,
    year: latest.analysisYear,
    providerCount: rows.length,
    hospitalizations: rows.reduce((sum, row) => sum + row.hospitalizations, 0),
    topProviders: rows.slice(0, limit),
    regions: regionalBreakdown(trends, productCodes, latest.analysisYear, method, latest.regions, latest.populations),
  };
}
