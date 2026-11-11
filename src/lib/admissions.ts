import type { AdmissionRow } from "@/lib/types";

export type AdmissionDisplayRow = AdmissionRow & {
  productCodes: string[];
};

export function aggregateAdmissionRowsByProvider(rows: AdmissionRow[]): AdmissionDisplayRow[] {
  const grouped = new Map<string, AdmissionDisplayRow>();

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
    existing.plannedAdmissions += row.plannedAdmissions;
    existing.urgentAdmissions += row.urgentAdmissions;
    existing.totalAdmissions += row.totalAdmissions;

    if (!existing.productCodes.includes(row.productCode)) {
      existing.productCodes.push(row.productCode);
    }
  });

  return [...grouped.values()].map((row) => ({
    ...row,
    hospitalizationsPer100k: row.population > 0
      ? (row.hospitalizations / row.population) * 100_000
      : 0,
    plannedAdmissionsPer100k: row.population > 0
      ? (row.plannedAdmissions / row.population) * 100_000
      : 0,
    urgentAdmissionsPer100k: row.population > 0
      ? (row.urgentAdmissions / row.population) * 100_000
      : 0,
  }));
}

export function admissionRowsPerJgp(rows: AdmissionRow[]): AdmissionDisplayRow[] {
  return rows.map((row) => ({
    ...row,
    productCodes: [row.productCode],
  }));
}

/** Udział przyjęć nagłych (2+3) we wszystkich hospitalizacjach, % (jak na karcie grupy JGP). */
export const urgentSharePct = (row: Pick<AdmissionRow, "hospitalizations" | "urgentAdmissions">) =>
  row.hospitalizations > 0 ? (row.urgentAdmissions / row.hospitalizations) * 100 : 0;

/** Średni udział przyjęć nagłych wszystkich wierszy, % (linia „średnia” na wykresie). */
export function urgentMeanPct(rows: readonly Pick<AdmissionRow, "hospitalizations" | "urgentAdmissions">[]) {
  const hospitalizations = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  return hospitalizations ? (rows.reduce((sum, row) => sum + row.urgentAdmissions, 0) / hospitalizations) * 100 : 0;
}
