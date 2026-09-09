export type EstimationMethod = "min" | "sim";
export type AxisMode = "total" | "per_100k";
export type GeographyMode = "regions" | "cities";

export interface ProductOption {
  code: string;
  jgpCode: string | null;
  name: string | null;
  label: string;
}

export interface RegionOption {
  owNfz: string;
  name: string;
}

export interface ReferencePayload {
  analysisYear: string;
  defaultProductCode: string;
  products: ProductOption[];
  regions: RegionOption[];
  cities: string[];
  durations: string[];
}

export interface MortalityRow {
  owNfz: string;
  nip: string;
  productCode: string;
  providerName: string;
  city: string;
  voivodeship: string;
  population: number;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  hospitalizationsPer100k: number;
}

export interface KpiSummary {
  facilities: number;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
}

export interface AreaStatRow {
  productCode: string | null;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  hospitalizationsPerFacility: number;
  hospitalizationsPer100k: number | null;
  facilities: number;
}

export interface AreaStatGroup {
  key: string;
  name: string;
  rows: AreaStatRow[];
}

export interface GeographyStats {
  regions: AreaStatGroup[];
  cities: AreaStatGroup[];
}

export interface MortalityPayload {
  rows: MortalityRow[];
  current: KpiSummary;
  baseline: KpiSummary;
  hasComparison: boolean;
  areaStats: GeographyStats;
  baselineAreaStats: GeographyStats;
}
