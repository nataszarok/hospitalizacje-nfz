import { describe, expect, it } from "vitest";
import {
  hospitalAnalysisFromDataset,
  hospitalDirectoryFromDataset,
  hospitalPeerBenchmarkFromDataset,
  type HospitalPeerSelectionEntry,
} from "@/lib/staticData";
import { hospitalDataset, hospitalRpwdl } from "./fixtures/hospitalDataset";

const TARGET = "07|111-111";
const A = "07|222";
const B = "12|333";
const assertDefined = <T>(value: T | null): T => {
  expect(value).not.toBeNull();
  if (value === null) throw new Error("Oczekiwano wyniku szpitala");
  return value;
};

const chosenPeers = () => new Map<string, HospitalPeerSelectionEntry>([
  [A, {
    similarityPct: 65, distanceScore: 5, peerGrade: "B",
    targetCoreBeds: 140, peerCoreBeds: 125, targetCoreTypes: 3, peerCoreTypes: 3,
    targetCoreXSupported: 12, peerCoreXSupported: 10,
    targetClinics: 4, peerClinics: 3, sharedCoreTypes: 3,
    sharedJgp: 2, targetJgp: 2, peerJgp: 2,
    clinicalPct: 82, structuralPct: 75,
  }],
  [B, {
    similarityPct: 95, distanceScore: 2, peerGrade: "A",
    targetCoreBeds: 140, peerCoreBeds: 60, targetCoreTypes: 3, peerCoreTypes: 1,
    sharedJgp: 2, targetJgp: 2, peerJgp: 2,
  }],
]);

describe("hospitalDirectoryFromDataset", () => {
  it("buduje stabilny, unikatowy klucz OW NFZ|NIP i zachowuje kolejność placówek", () => {
    const entries = hospitalDirectoryFromDataset(hospitalDataset());
    expect(entries).toHaveLength(6);
    expect(entries[0]).toEqual({
      key: TARGET, owNfz: "07", nip: "111-111", name: "Szpital docelowy", city: "Warszawa",
    });
    expect(entries[2].key).toBe(B);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
  });

  it("działa dla pustej listy szpitali", () => {
    const d = hospitalDataset();
    d.facilities = [];
    expect(hospitalDirectoryFromDataset(d)).toEqual([]);
  });
});

describe("hospitalAnalysisFromDataset", () => {
  it("zwraca null dla nieistniejącego klucza", () => {
    expect(hospitalAnalysisFromDataset(hospitalDataset(), "07|brak", "min")).toBeNull();
  });

  it("agreguje pobyty, zgony, udziały JGP i tryby przyjęć metodą min", () => {
    const result = assertDefined(hospitalAnalysisFromDataset(hospitalDataset(), TARGET, "min"));
    expect(result).toMatchObject({
      key: TARGET, owNfz: "07", nip: "111-111", providerName: "Szpital docelowy",
      city: "Warszawa", voivodeship: "Mazowieckie",
      hospitalizations: 150, deaths: 12, mortalityPct: 8,
      uniqueJgp: 2, uniqueJgpOver10: 2,
      proceduralHospitalizations: 30, proceduralSharePct: 20,
      admissions: { planned: 90, urgent: 30, other: 30, total: 150 },
    });
    expect(result.nationalSharePct).toBeCloseTo(150 / 499 * 100, 8);
    expect(result.codes).toEqual([
      { productCode: "P1", jgpCode: "A01", hospitalizations: 120, deaths: 12, mortalityPct: 10, sharePct: 80 },
      { productCode: "P2", jgpCode: "B02", hospitalizations: 30, deaths: 0, mortalityPct: 0, sharePct: 20 },
    ]);
  });

  it("przełącza spójnie wszystkie wielkości z min na sim", () => {
    const result = assertDefined(hospitalAnalysisFromDataset(hospitalDataset(), TARGET, "sim"));
    expect(result).toMatchObject({
      hospitalizations: 176, deaths: 14,
      proceduralHospitalizations: 40,
      admissions: { planned: 100, urgent: 36, other: 40, total: 176 },
    });
    expect(result.mortalityPct).toBeCloseTo(14 / 176 * 100);
    expect(result.nationalSharePct).toBeCloseTo(176 / 550 * 100);
    expect(result.codes.map((x) => x.hospitalizations)).toEqual([136, 40]);
  });

  it("granicę >10 JGP interpretuje ściśle, nie >=10", () => {
    const d = hospitalDataset();
    const row = d.facts.find(([ow, nip, product]) => ow === "07" && nip === "111-111" && product === "P2");
    if (!row) throw new Error("Brak wiersza testowego");
    row[6] = 10;
    const result = assertDefined(hospitalAnalysisFromDataset(d, TARGET, "min"));
    expect(result.uniqueJgp).toBe(2);
    expect(result.uniqueJgpOver10).toBe(1);
    expect(result.proceduralHospitalizations).toBe(10);
  });

  it("rozpoznaje zabiegowość wyłącznie po gwiazdce na końcu nazwy", () => {
    const d = hospitalDataset();
    d.products[1][2] = "Chirurgia bez gwiazdki";
    const result = assertDefined(hospitalAnalysisFromDataset(d, TARGET, "min"));
    expect(result.proceduralHospitalizations).toBe(0);
    expect(result.proceduralSharePct).toBe(0);
  });

  it("nie dzieli przez zero dla istniejącej placówki bez hospitalizacji", () => {
    const result = assertDefined(hospitalAnalysisFromDataset(hospitalDataset(), "07|666", "min"));
    expect(result).toMatchObject({
      hospitalizations: 0, deaths: 0, mortalityPct: 0, nationalSharePct: 0,
      uniqueJgp: 0, uniqueJgpOver10: 0, proceduralSharePct: 0,
      codes: [], admissions: { planned: 0, urgent: 0, other: 0, total: 0 },
    });
  });

  it("klucz identyfikuje OW i NIP łącznie, nie tylko NIP", () => {
    const d = hospitalDataset();
    d.facilities.push(["12", "111-111", "Inny szpital", "Zakopane"]);
    const result = assertDefined(hospitalAnalysisFromDataset(d, "12|111-111", "min"));
    expect(result.hospitalizations).toBe(0);
    expect(result.providerName).toBe("Inny szpital");
  });
});

describe("hospitalPeerBenchmarkFromDataset", () => {
  it("zwraca null dla nieznanego szpitala lub placówki bez pobytów", () => {
    const d = hospitalDataset();
    expect(hospitalPeerBenchmarkFromDataset(d, "07|brak", "min", hospitalRpwdl)).toBeNull();
    expect(hospitalPeerBenchmarkFromDataset(d, "07|666", "min", hospitalRpwdl)).toBeNull();
  });

  it("oblicza bazę wybranego szpitala, normalizuje NIP RPWDL i pomija łóżka nieostre", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 0));
    expect(result.selected).toMatchObject({
      providerName: "Szpital docelowy", hospitalizations: 150, mortalityPct: 8,
      proceduralSharePct: 20, urgentSharePct: 20, uniqueJgpOver10: 2,
      coreBeds: 140, coreWards: 3, cellCount: 12, clinicCount: 4,
    });
    // 200 łóżek ZOL (kod 5160) nie może zawyżać liczby łóżek CORE.
    expect(result.selected.coreBeds).not.toBe(340);
  });

  it("w automatycznym doborze odrzuca zbyt małe szpitale i brak struktury RPWDL", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 0));
    expect(result.peers.map((peer) => peer.key)).toEqual([A]);
    expect(result.peers[0]).toMatchObject({
      hospitalizations: 140, mortalityPct: 5, urgentSharePct: 40 / 140 * 100,
      proceduralSharePct: 40 / 140 * 100, coreBeds: 125,
    });
    expect(result.peers[0].similarityPct).toBeGreaterThan(0);
    expect(result.peers[0].similarityPct).toBeLessThanOrEqual(100);
  });

  it("filtruje peerów końcowym progiem podobieństwa", () => {
    const d = hospitalDataset();
    const low = assertDefined(hospitalPeerBenchmarkFromDataset(d, TARGET, "min", hospitalRpwdl, 0));
    const high = assertDefined(hospitalPeerBenchmarkFromDataset(d, TARGET, "min", hospitalRpwdl, 100));
    expect(low.peers).toHaveLength(1);
    expect(high.peers).toEqual([]);
    expect(high.median).toEqual({
      hospitalizations: 0, mortalityPct: 0, proceduralSharePct: 0,
      urgentSharePct: 0, uniqueJgpOver10: 0,
    });
    expect(high.mortalityOutliers).toEqual([]);
    expect(high.totalExcessDeaths).toBe(0);
  });

  it("bez RPWDL nie wyklucza kandydatów wyłącznie za brak profilu oddziałów", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", undefined, 0));
    expect(result.peers.map((x) => x.key)).toEqual([A, "07|555"]);
  });

  it("wybrane jawnie pary omijają preselekcję i są sortowane po distanceScore", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 90, chosenPeers()));
    expect(result.peers.map((peer) => peer.key)).toEqual([B, A]);
    expect(result.peers.map((peer) => peer.peerGrade)).toEqual(["A", "B"]);
    expect(result.peers.map((peer) => peer.similarityPct)).toEqual([95, 65]);
    expect(result.peers[1]).toMatchObject({
      distanceScore: 5, coreBeds: 125, coreWards: 3, cellCount: 10, clinicCount: 3,
      similarityBreakdown: { clinicalPct: 82, structuralPct: 75 },
      pairMetrics: {
        targetHospitalizations: 150, peerHospitalizations: 140,
        targetDeaths: 12, peerDeaths: 7,
        targetCoreBeds: 140, peerCoreBeds: 125, sharedJgp: 2,
      },
    });
  });

  it("oblicza mediany i ważone wyniki śmiertelności tylko dla wybranych peerów", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 90, chosenPeers()));
    expect(result.median.hospitalizations).toBe(110); // mediana [80, 140]
    expect(result.median.mortalityPct).toBeCloseTo((5 + 6 / 80 * 100) / 2);
    const p1 = result.mortalityOutliers.find((item) => item.productCode === "P1");
    const p2 = result.mortalityOutliers.find((item) => item.productCode === "P2");
    expect(p1).toMatchObject({
      targetHospitalizations: 120, targetDeaths: 12,
      peerHospitalizations: 160, peerDeaths: 11, peerHospitals: 2,
    });
    expect(p1?.expectedDeaths).toBeCloseTo(120 * 11 / 160);
    expect(p1?.excessDeaths).toBeCloseTo(3.75);
    expect(p2?.expectedDeaths).toBeCloseTo(1);
    expect(p2?.excessDeaths).toBeCloseTo(-1);
    expect(result.totalExcessDeaths).toBeCloseTo(2.75);
  });

  it("wylicza rozkład śmiertelności JGP na ważonych wolumenach i punkty peerów", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 90, chosenPeers()));
    expect(result.jgpMortalityDistribution).toHaveLength(1); // tylko P1 przekracza 100 pobytów u celu
    expect(result.jgpMortalityDistribution[0]).toMatchObject({
      productCode: "P1", jgpCode: "A01",
      targetHospitalizations: 120, targetDeaths: 12,
      peerHospitalizations: 160, peerDeaths: 11,
    });
    expect(result.jgpMortalityDistribution[0].peerPoints.map((p) => p.key)).toEqual([B, A]);
    expect(result.jgpMortalityDistribution[0].peerMortalityPct).toBeCloseTo(11 / 160 * 100);
  });

  it("klasyfikuje wolumen JGP do koszyków śmiertelności z zachowaniem sum", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 90, chosenPeers()));
    expect(result.mortalityVolumeBuckets.labels).toEqual(["0–1%", "1–2%", "2–5%", "5%+"]);
    expect(result.mortalityVolumeBuckets.selectedHosp).toEqual([30, 0, 0, 120]);
    expect(result.mortalityVolumeBuckets.peerHosp).toEqual([20, 0, 0, 200]);
    expect(result.mortalityVolumeBuckets.selected.reduce((a,b) => a+b, 0)).toBeCloseTo(100);
    expect(result.mortalityVolumeBuckets.peers.reduce((a,b) => a+b, 0)).toBeCloseTo(100);
  });

  it("liczy benchmark metodą sim niezależnie od danych min", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "sim", hospitalRpwdl, 90, chosenPeers()));
    expect(result.selected.hospitalizations).toBe(176);
    expect(result.selected.mortalityPct).toBeCloseTo(14 / 176 * 100);
    expect(result.peers.find((p) => p.key === A)?.hospitalizations).toBe(160);
    expect(result.mortalityOutliers.find((p) => p.productCode === "P1")?.targetHospitalizations).toBe(136);
  });

  it("zachowuje bezpieczne struktury wynikowe przy jawnie pustym zbiorze peerów", () => {
    const result = assertDefined(hospitalPeerBenchmarkFromDataset(hospitalDataset(), TARGET, "min", hospitalRpwdl, 75, new Map()));
    expect(result.peers).toEqual([]);
    expect(result.mortalityOutliers).toEqual([]);
    expect(result.jgpMortalityDistribution).toEqual([]);
    expect(result.mortalityVolumeBuckets.peerHosp).toEqual([0, 0, 0, 0]);
    expect(result.mortalityVolumeBuckets.peers).toEqual([0, 0, 0, 0]);
  });
});
