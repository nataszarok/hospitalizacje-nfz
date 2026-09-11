import type { MortalityRow } from "@/lib/types";

export type MortalityDisplayRow = MortalityRow & {
  productCodes: string[];
};

export function aggregateMortalityRowsByProvider(rows: MortalityRow[]): MortalityDisplayRow[] {
  const grouped = new Map<string, MortalityDisplayRow>();

  rows.forEach((row) => {
    // owNfz + NIP is also the facility identity used by the repository layer.
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
    hospitalizationsPer100k: row.population > 0 ? (row.hospitalizations / row.population) * 100_000 : 0,
  }));
}

export function mortalityRowsPerJgp(rows: MortalityRow[]): MortalityDisplayRow[] {
  return rows.map((row) => ({ ...row, productCodes: [row.productCode] }));
}
