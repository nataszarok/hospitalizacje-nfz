import type { HospitalAnalysis, HospitalPeer, HospitalPeerBenchmark, ProductOption } from "@/lib/types";
import type { PeerPair } from "@/components/HospitalComparisonShared";

export const products: ProductOption[] = [
  { code: "P1", jgpCode: "A01", name: "Diagnostyka", label: "A01 · Diagnostyka" },
  { code: "P2", jgpCode: "B02", name: "Zabieg *", label: "B02 · Zabieg" },
];

export function sampleAnalysis(overrides: Partial<HospitalAnalysis> = {}): HospitalAnalysis {
  return {
    key: "07|1234567890", owNfz: "07", nip: "1234567890", providerName: "SZPITAL MIEJSKI W WARSZAWIE",
    city: "Warszawa", voivodeship: "Mazowieckie", hospitalizations: 9000, deaths: 90,
    mortalityPct: 1, nationalSharePct: 3, uniqueJgp: 2, uniqueJgpOver10: 2,
    proceduralHospitalizations: 4500, proceduralSharePct: 50,
    codes: [
      { productCode: "P1", jgpCode: "A01", hospitalizations: 4500, deaths: 30, mortalityPct: 0.67, sharePct: 50 },
      { productCode: "P2", jgpCode: "B02", hospitalizations: 4500, deaths: 60, mortalityPct: 1.33, sharePct: 50 },
    ],
    admissions: { planned: 6000, urgent: 3000, other: 0, total: 9000 },
    ...overrides,
  };
}

export function samplePeer(overrides: Partial<HospitalPeer> = {}): HospitalPeer {
  return {
    key: "07|2222222222", providerName: "SZPITAL PORÓWNAWCZY", city: "Radom", voivodeship: "Mazowieckie",
    similarityPct: 86, distanceScore: 2, peerGrade: "A", hospitalizations: 5000, mortalityPct: 2,
    proceduralSharePct: 30, urgentSharePct: 20, uniqueJgpOver10: 3,
    coreBeds: 100, coreWards: 4, cellCount: 14, clinicCount: 7,
    similarityBreakdown: {
      structuralPct: 85, clinicalPct: 83, wardTypesPct: 82, wardBedsPct: 84,
      cellCountPct: 81, clinicTypesPct: 80, clinicCountPct: 88,
      hospitalScalePct: 87, bedScalePct: 90, scalePct: 84,
      wardCountScalePct: 82, cellCountScalePct: 84, complexityPct: 83,
      jgpSetPct: 82, jgpRankPct: 86, jgpProportionPct: 84, urgentModePct: 89,
      sharedJgp: 2, targetJgp: 3, peerJgp: 4,
    },
    ...overrides,
  };
}

export function sampleBenchmark(peers: HospitalPeer[] = [samplePeer()]): HospitalPeerBenchmark {
  return {
    peers,
    median: { hospitalizations: 5000, mortalityPct: 2, proceduralSharePct: 30, urgentSharePct: 20, uniqueJgpOver10: 3 },
    selected: {
      providerName: "SZPITAL MIEJSKI W WARSZAWIE", hospitalizations: 9000, mortalityPct: 1,
      proceduralSharePct: 50, urgentSharePct: 25, uniqueJgpOver10: 2,
      coreBeds: 200, coreWards: 5, cellCount: 20, clinicCount: 6,
    },
    mortalityOutliers: [], totalExcessDeaths: 0, jgpMortalityDistribution: [],
    mortalityVolumeBuckets: { labels: [], selected: [], peers: [], selectedHosp: [], peerHosp: [] },
  };
}

export function samplePair(overrides: Partial<PeerPair> = {}): PeerPair {
  return {
    a: "07|1234567890", b: "07|2222222222", peer_grade_pred: "A", p_peer: 0.95,
    distance_score: 2,
    hospitalizations_a: 9000, hospitalizations_b: 5000,
    hospitalizations_sim_a: 9000, hospitalizations_sim_b: 5000,
    hospitalizations_min_a: 8500, hospitalizations_min_b: 4800,
    deaths_sim_a: 90, deaths_sim_b: 80, deaths_min_a: 85, deaths_min_b: 70,
    core_types_a: 5, core_types_b: 4, core_beds_a: 200, core_beds_b: 100,
    core_x_supported_count_a: 4, core_x_supported_count_b: 3,
    clinics_a: 6, clinics_b: 7, jgp_gt10_a: 2, jgp_gt10_b: 3,
    zrm_a: 1, zrm_b: 1, urgent_other_a: 20, urgent_other_b: 25,
    core_types_shared: 3, jgp_shared: 2,
    core_type_set_similarity: 0.8, jgp_shared_volume_similarity: 0.7, jgp_set_similarity: 0.75,
    bed_cosine_similarity: 0.9, bed_weighted_jaccard_similarity: 0.85,
    jgp_family_weighted_jaccard: 0.8, d_jgp_set: 0.25, d_jgp_family_weighted_jaccard: 0.2,
    ...overrides,
  } as PeerPair;
}
