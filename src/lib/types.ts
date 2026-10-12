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

export interface AdmissionRow {
  owNfz: string;
  nip: string;
  productCode: string;
  providerName: string;
  city: string;
  voivodeship: string;
  population: number;
  plannedAdmissions: number;
  urgentAdmissions: number;
  totalAdmissions: number;
  plannedAdmissionsPer100k: number;
  urgentAdmissionsPer100k: number;
}

export interface AdmissionAreaStatGroup {
  key: string;
  name: string;
  plannedAdmissions: number;
  urgentAdmissions: number;
  totalAdmissions: number;
  facilities: number;
  plannedToUrgentRatioPct: number | null;
}

export interface AdmissionGeographyStats {
  regions: AdmissionAreaStatGroup[];
  cities: AdmissionAreaStatGroup[];
}

export interface AdmissionPayload {
  rows: AdmissionRow[];
  areaStats: AdmissionGeographyStats;
}

export interface HospitalDirectoryEntry {
  key: string;
  owNfz: string;
  nip: string;
  name: string;
  city: string;
}

export interface HospitalCodeStat {
  productCode: string;
  jgpCode: string | null;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  sharePct: number;
}

export interface HospitalAnalysis {
  key: string;
  owNfz: string;
  nip: string;
  providerName: string;
  city: string;
  voivodeship: string;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  nationalSharePct: number;
  uniqueJgp: number;
  uniqueJgpOver10: number;
  proceduralHospitalizations: number;
  proceduralSharePct: number;
  codes: HospitalCodeStat[];
  admissions: { planned: number; urgent: number; other: number; total: number };
}


export interface HospitalPeer {
  key: string;
  providerName: string;
  city: string;
  voivodeship: string;
  similarityPct: number;
  distanceScore?: number;
  peerGrade?: "A" | "B";
  pairMetrics?: {
    targetHospitalizations:number; peerHospitalizations:number;
    targetDeaths:number; peerDeaths:number;
    targetCoreBeds:number; peerCoreBeds:number;
    targetCoreTypes:number; peerCoreTypes:number;
    targetCoreXSupported:number; peerCoreXSupported:number;
    targetClinics:number; peerClinics:number;
    sharedCoreTypes:number; sharedJgp:number;
    targetJgpOver10:number; peerJgpOver10:number;
    coreTypeSetSimilarity:number; jgpSetSimilarity:number; jgpSharedVolumeSimilarity:number;
    bedCosineSimilarity:number; bedWeightedJaccardSimilarity:number;
  };
  hospitalizations: number;
  mortalityPct: number;
  proceduralSharePct: number;
  urgentSharePct: number;
  uniqueJgpOver10: number;
  coreBeds: number;
  coreWards: number;
  cellCount: number;
  clinicCount: number;
  similarityBreakdown: {
    structuralPct: number; clinicalPct: number;
    wardTypesPct: number; wardBedsPct: number;
    cellCountPct: number; clinicTypesPct: number; clinicCountPct: number;
    hospitalScalePct: number;
    bedScalePct: number;
    scalePct: number;
    wardCountScalePct: number;
    cellCountScalePct: number;
    complexityPct: number;
    jgpSetPct: number; jgpRankPct: number; jgpProportionPct: number;
    urgentModePct: number;
    sharedJgp: number; targetJgp: number; peerJgp: number;
  };
}

export interface HospitalPeerBenchmark {
  peers: HospitalPeer[];
  median: {
    hospitalizations: number;
    mortalityPct: number;
    proceduralSharePct: number;
    urgentSharePct: number;
    uniqueJgpOver10: number;
  };
  selected: {
    providerName: string;
    hospitalizations: number;
    mortalityPct: number;
    proceduralSharePct: number;
    urgentSharePct: number;
    uniqueJgpOver10: number;
    coreBeds: number;
    coreWards: number;
    cellCount: number;
    clinicCount: number;
  };
  mortalityOutliers: {
    productCode: string; jgpCode: string; name: string | null;
    targetHospitalizations: number; targetDeaths: number; targetMortalityPct: number;
    peerHospitalizations: number; peerDeaths: number; peerHospitals: number; peerMortalityPct: number;
    expectedDeaths: number; excessDeaths: number;
    peerPoints?: {
      key: string; name: string;
      hospitalizations: number; deaths: number; mortalityPct: number;
    }[];
  }[];
  totalExcessDeaths: number;
  jgpMortalityDistribution: {
    productCode: string; jgpCode: string; name: string | null;
    targetHospitalizations: number; targetDeaths: number; targetMortalityPct: number;
    peerPoints: {
      key: string; name: string;
      hospitalizations: number; deaths: number; mortalityPct: number;
    }[];
    peerHospitalizations: number; peerDeaths: number; peerMortalityPct: number | null;
  }[];
  mortalityVolumeBuckets: {
    labels: string[];
    selected: number[];
    peers: number[];
    selectedHosp: number[];
    peerHosp: number[];
  };
}
