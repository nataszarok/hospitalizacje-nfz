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

    existing.plannedAdmissions += row.plannedAdmissions;
    existing.urgentAdmissions += row.urgentAdmissions;
    existing.totalAdmissions += row.totalAdmissions;

    if (!existing.productCodes.includes(row.productCode)) {
      existing.productCodes.push(row.productCode);
    }
  });

  return [...grouped.values()].map((row) => ({
    ...row,
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
