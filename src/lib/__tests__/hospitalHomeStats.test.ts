import { describe, expect, it } from "vitest";
import { buildHospitalHomeStats, type FinancialRecordSummary, type HospitalProfileSummary } from "@/lib/hospitalHomeStats";
import type { JgpPeerPair } from "@/lib/jgpPage";

const profile = (ow: string, nip: string, beds: number | null, sor = 0): HospitalProfileSummary =>
  ({ oz_nfz: ow, nip, core: beds === null ? null : { beds }, capabilities: sor ? { sor: { count: sor } } : null });

const profiles = [profile("04", "1", 50, 1), profile("04", "2", 150), profile("07", "3", 250, 1), profile("07", "4", 900), profile("07", "5", null)];

const finance = (nip: string, year: number, net: number | null, revenue: number | null = 100): FinancialRecordSummary =>
  ({ nip, years: [{ year, revenue, net_result: net, net_margin: net === null || revenue === null ? null : net / revenue }] });

const financial = [finance("1", 2025, -20), finance("2", 2025, -3), finance("3", 2025, 4), finance("4", 2025, 12), finance("5", 2025, null), finance("6", 2024, 1)];

const pair = (a: string, b: string, distance: number): JgpPeerPair => ({ a, b, peer_grade_pred: distance <= 10.01 ? "A" : "B", distance_score: distance });
const pairs = [pair("04|1", "04|2", 4), pair("04|1", "07|3", 2.5), pair("04|1", "07|4", 15), pair("07|3", "07|4", 9)];

const facilities = [["04", "1", "SZPITAL A", "NOWA SÓL"], ["04", "2", "SZPITAL B", "ZIELONA GÓRA"], ["07", "3", "SZPITAL C", "WARSZAWA"]] as const;

describe("buildHospitalHomeStats", () => {
  const stats = buildHospitalHomeStats(profiles, financial, pairs, facilities, "04|1");

  it("liczy szpitale według łóżek, medianę i szpitale z SOR (bez profili bez łóżek)", () => {
    expect(stats).toMatchObject({ profiles: 5, withBeds: 4, medianBeds: 200, withSor: 2 });
    expect(stats.beds.map((bin) => [bin.label, bin.count])).toEqual([["<100", 1], ["100–199", 1], ["200–299", 1], ["300–499", 0], ["500–799", 0], ["800+", 1]]);
  });

  it("bierze rok z największą liczbą wyników netto i liczy straty oraz marże", () => {
    expect(stats.finance).toMatchObject({ year: 2025, reported: 4, loss: 2, netResult: -7 });
    expect(stats.finance!.margins.map((bin) => [bin.label, bin.count, bin.negative])).toEqual([
      ["< −15", 1, true], ["−15…−10", 0, true], ["−10…−5", 0, true], ["−5…0", 1, true], ["0…5", 1, false], ["5…10", 0, false], ["≥ 10", 1, false],
    ]);
    expect(buildHospitalHomeStats(profiles, [], pairs, facilities).finance).toBeNull();
  });

  it("liczy pary klasy A i pokazuje przykład z najbliższymi szpitalami", () => {
    expect(stats.comparison).toMatchObject({ pairsA: 3, hospitalsWithPeers: 4 });
    expect(stats.comparison.example).toEqual({
      key: "04|1", name: "SZPITAL A", city: "NOWA SÓL", peerCount: 2,
      peers: [{ key: "07|3", name: "SZPITAL C", city: "WARSZAWA", distance: 2.5 }, { key: "04|2", name: "SZPITAL B", city: "ZIELONA GÓRA", distance: 4 }],
    });
  });

  it("bez wybranego szpitala w parach bierze szpital z największą liczbą par A", () => {
    const example = buildHospitalHomeStats(profiles, financial, pairs, facilities, "99|0").comparison.example!;
    expect(example.key).toBe("04|1");
    expect(buildHospitalHomeStats(profiles, financial, [], facilities).comparison.example).toBeNull();
  });
});
