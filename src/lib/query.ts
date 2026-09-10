import type { AdmissionAreaStatGroup, AdmissionGeographyStats, AdmissionRow, AreaStatGroup, EstimationMethod, GeographyStats, KpiSummary, MortalityRow } from "@/lib/types";

export function parseCsvParam(value: string | null, max = 100): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, max);
}

export function parseMethod(value: string | null): EstimationMethod {
  return value === "sim" ? "sim" : "min";
}

export function parseMinHosp(value: string | null): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function summarize(rows: MortalityRow[]): KpiSummary {
  const facilities = new Set(rows.map((row) => `${row.owNfz}|${row.nip}`)).size;
  const hospitalizations = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  return {
    facilities,
    hospitalizations,
    deaths,
    mortalityPct: hospitalizations > 0 ? (deaths / hospitalizations) * 100 : 0,
  };
}

function summarizeAreaSubset(rows: MortalityRow[], productCode: string | null, includePopulationRate: boolean) {
  const facilities = new Set(rows.map((row) => `${row.owNfz}|${row.nip}`)).size;
  const hospitalizations = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const populations = [...new Set(rows.map((row) => row.population).filter((value) => value > 0))];
  const population = includePopulationRate && populations.length === 1 ? populations[0] : null;

  return {
    productCode,
    hospitalizations,
    deaths,
    mortalityPct: hospitalizations > 0 ? (deaths / hospitalizations) * 100 : 0,
    hospitalizationsPerFacility: facilities > 0 ? hospitalizations / facilities : 0,
    hospitalizationsPer100k: population ? hospitalizations / population * 100_000 : null,
    facilities,
  };
}

function buildAreaGroups(rows: MortalityRow[], mode: "regions" | "cities"): AreaStatGroup[] {
  const grouped = new Map<string, MortalityRow[]>();
  for (const row of rows) {
    const key = mode === "regions" ? row.owNfz : row.city.trim();
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([key, areaRows]) => {
    const products = [...new Set(areaRows.map((row) => row.productCode))];
    const statRows = [summarizeAreaSubset(areaRows, null, mode === "regions")];
    if (products.length > 1) {
      for (const productCode of products) {
        statRows.push(summarizeAreaSubset(areaRows.filter((row) => row.productCode === productCode), productCode, mode === "regions"));
      }
    }
    return {
      key,
      name: mode === "regions" ? areaRows[0]?.voivodeship ?? key : key,
      rows: statRows,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function summarizeGeographies(rows: MortalityRow[]): GeographyStats {
  return {
    regions: buildAreaGroups(rows, "regions"),
    cities: buildAreaGroups(rows, "cities"),
  };
}

function buildAdmissionAreaGroups(rows: AdmissionRow[], mode: "regions" | "cities"): AdmissionAreaStatGroup[] {
  const grouped = new Map<string, AdmissionRow[]>();
  for (const row of rows) {
    const key = mode === "regions" ? row.owNfz : row.city.trim();
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([key, areaRows]) => {
    const plannedAdmissions = areaRows.reduce((sum, row) => sum + row.plannedAdmissions, 0);
    const urgentAdmissions = areaRows.reduce((sum, row) => sum + row.urgentAdmissions, 0);
    const facilities = new Set(areaRows.map((row) => `${row.owNfz}|${row.nip}`)).size;

    return {
      key,
      name: mode === "regions" ? areaRows[0]?.voivodeship ?? key : key,
      plannedAdmissions,
      urgentAdmissions,
      totalAdmissions: plannedAdmissions + urgentAdmissions,
      facilities,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function summarizeAdmissionGeographies(rows: AdmissionRow[]): AdmissionGeographyStats {
  return {
    regions: buildAdmissionAreaGroups(rows, "regions"),
    cities: buildAdmissionAreaGroups(rows, "cities"),
  };
}
