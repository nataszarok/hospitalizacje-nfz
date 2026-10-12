import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  HospitalAnalysis, HospitalCodeStat, HospitalDirectoryEntry, HospitalPeer,
  HospitalPeerBenchmark,
} from "@/lib/types";
import type { HospitalPeerSelectionEntry } from "@/lib/staticData";
import { hospitalAnalysisFromDataset, hospitalPeerBenchmarkFromDataset } from "@/lib/staticData";
import { hospitalDataset, hospitalRpwdl } from "./fixtures/hospitalDataset";

describe("typy szpitali — kontrakty TypeScript", () => {
  it("wymaga stabilnej tożsamości i danych lokalizacji w katalogu", () => {
    const entry: HospitalDirectoryEntry = {
      key: "07|111", owNfz: "07", nip: "111", name: "Szpital", city: "Warszawa",
    };
    expect(entry.key).toBe(`${entry.owNfz}|${entry.nip}`);
    expectTypeOf<HospitalDirectoryEntry["key"]>().toEqualTypeOf<string>();
  });

  it("utrzymuje wymagane metryki profilu oraz nullable JGP", () => {
    expectTypeOf<HospitalAnalysis["codes"]>().toEqualTypeOf<HospitalCodeStat[]>();
    expectTypeOf<HospitalCodeStat["jgpCode"]>().toEqualTypeOf<string | null>();
    expectTypeOf<HospitalAnalysis["admissions"]["other"]>().toEqualTypeOf<number>();
    expectTypeOf<HospitalAnalysis["proceduralSharePct"]>().toEqualTypeOf<number>();
    const result: HospitalAnalysis | null = hospitalAnalysisFromDataset(hospitalDataset(), "07|111-111", "min");
    expect(result?.codes[0].jgpCode).toBe("A01");
  });

  it("ogranicza klasy peerów do A/B i pozwala na brak opcjonalnych pól z modelu", () => {
    expectTypeOf<HospitalPeer["peerGrade"]>().toEqualTypeOf<"A" | "B" | undefined>();
    expectTypeOf<HospitalPeer["distanceScore"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<HospitalPeer["pairMetrics"]>().toEqualTypeOf<
      | {
          targetHospitalizations: number; peerHospitalizations: number;
          targetDeaths: number; peerDeaths: number;
          targetCoreBeds: number; peerCoreBeds: number;
          targetCoreTypes: number; peerCoreTypes: number;
          targetCoreXSupported: number; peerCoreXSupported: number;
          targetClinics: number; peerClinics: number;
          sharedCoreTypes: number; sharedJgp: number;
          targetJgpOver10: number; peerJgpOver10: number;
          coreTypeSetSimilarity: number; jgpSetSimilarity: number; jgpSharedVolumeSimilarity: number;
          bedCosineSimilarity: number; bedWeightedJaccardSimilarity: number;
        }
      | undefined
    >();
    expectTypeOf<HospitalPeerSelectionEntry["similarityPct"]>().toEqualTypeOf<number>();
    expectTypeOf<HospitalPeerSelectionEntry["peerGrade"]>().toEqualTypeOf<"A" | "B" | undefined>();
  });

  it("utrzymuje osobne kontrakty wyników benchmarku i diagnostyki JGP", () => {
    expectTypeOf<HospitalPeerBenchmark["selected"]["coreBeds"]>().toEqualTypeOf<number>();
    expectTypeOf<HospitalPeerBenchmark["mortalityOutliers"][number]["expectedDeaths"]>().toEqualTypeOf<number>();
    expectTypeOf<HospitalPeerBenchmark["mortalityOutliers"][number]["peerPoints"]>().toEqualTypeOf<
      { key: string; name: string; hospitalizations: number; deaths: number; mortalityPct: number }[] | undefined
    >();
    expectTypeOf<HospitalPeerBenchmark["jgpMortalityDistribution"][number]["peerMortalityPct"]>().toEqualTypeOf<number | null>();
    expectTypeOf<HospitalPeerBenchmark["mortalityVolumeBuckets"]["selectedHosp"]>().toEqualTypeOf<number[]>();
    const result: HospitalPeerBenchmark | null = hospitalPeerBenchmarkFromDataset(
      hospitalDataset(), "07|111-111", "min", hospitalRpwdl, 0,
    );
    expect(result?.selected.hospitalizations).toBe(150);
  });
});
