import type { MortalityRow } from "@/lib/types";

export type MortalityDisplayMode = "combined" | "per_jgp";

export type MortalityDisplayRow = MortalityRow & {
  productCodes: string[];
};

export function aggregateMortalityRowsByProvider(rows: MortalityRow[]): MortalityDisplayRow[] {
  const grouped = new Map<string, MortalityDisplayRow>();

  rows.forEach((row) => {
    const key = `${row.owNfz}::${row.nip}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...row,
        productCodes: [row.productCode],
      });
      return;
    }

    existing.hospitalizations += row.hospitalizations;
    existing.deaths += row.deaths;

    if (!existing.productCodes.includes(row.productCode)) {
      existing.productCodes.push(row.productCode);
    }
  });

  return [...grouped.values()].map((row) => ({
    ...row,
    mortalityPct: row.hospitalizations > 0 ? (row.deaths / row.hospitalizations) * 100 : 0,
    hospitalizationsPer100k: row.population > 0
      ? (row.hospitalizations / row.population) * 100_000
      : 0,
  }));
}

export function mortalityRowsPerJgp(rows: MortalityRow[]): MortalityDisplayRow[] {
  return rows.map((row) => ({
    ...row,
    productCodes: [row.productCode],
  }));
}

export interface MortalityInsights {
  providers: number;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  /** Liczba największych ośrodków w porównaniu (do 10). */
  topCount: number;
  /** Udział tych ośrodków w hospitalizacjach. */
  topSharePct: number;
  /** Mediana liczby hospitalizacji na świadczeniodawcę. */
  medianHospitalizations: number;
  /** Śmiertelność u świadczeniodawców poniżej mediany wolumenu (razem). */
  smallMortalityPct: number | null;
  /** Śmiertelność u świadczeniodawców od mediany wolumenu w górę (razem). */
  largeMortalityPct: number | null;
}

/** Krótka interpretacja wykresu „Kto leczy”: koncentracja wolumenu i śmiertelność według wielkości ośrodka. */
export function mortalityInsights(rows: MortalityRow[]): MortalityInsights | null {
  const providers = aggregateMortalityRowsByProvider(rows).sort((a, b) => b.hospitalizations - a.hospitalizations);
  if (!providers.length) return null;
  const hospitalizations = providers.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = providers.reduce((sum, row) => sum + row.deaths, 0);
  const topCount = Math.min(10, providers.length);
  const top = providers.slice(0, topCount).reduce((sum, row) => sum + row.hospitalizations, 0);
  const volumes = providers.map((row) => row.hospitalizations).sort((a, b) => a - b);
  const middle = Math.floor(volumes.length / 2);
  const median = volumes.length % 2 ? volumes[middle] : (volumes[middle - 1] + volumes[middle]) / 2;
  const rate = (list: typeof providers) => {
    const h = list.reduce((sum, row) => sum + row.hospitalizations, 0);
    return h > 0 ? (list.reduce((sum, row) => sum + row.deaths, 0) / h) * 100 : null;
  };
  return {
    providers: providers.length,
    hospitalizations,
    deaths,
    mortalityPct: hospitalizations > 0 ? (deaths / hospitalizations) * 100 : 0,
    topCount,
    topSharePct: hospitalizations > 0 ? (top / hospitalizations) * 100 : 0,
    medianHospitalizations: median,
    smallMortalityPct: providers.length > 1 ? rate(providers.filter((row) => row.hospitalizations < median)) : null,
    largeMortalityPct: providers.length > 1 ? rate(providers.filter((row) => row.hospitalizations >= median)) : null,
  };
}
