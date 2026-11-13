import { describe, expect, it } from "vitest";
import { buildHospitalHomeStats, buildHospitalMapStats, type FinancialRecordSummary, type HospitalProfileSummary } from "@/lib/hospitalHomeStats";
import { CATALOG_DOT_RADIUS } from "@/lib/hospitalCatalog";
import type { RegionsMap } from "@/lib/jgpCard";
import type { CitiesMap, FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";
import type { JgpPeerPair } from "@/lib/jgpPage";

const profile = (ow: string, nip: string, beds: number | null, sor = 0): HospitalProfileSummary =>
  ({ oz_nfz: ow, nip, core: beds === null ? null : { beds }, capabilities: sor ? { sor: { count: sor } } : null });

const profiles = [profile("04", "1", 50, 1), profile("04", "2", 150), profile("07", "3", 250, 1), profile("07", "4", 900), profile("07", "5", null)];

const finance = (nip: string, year: number, net: number | null, revenue: number | null = 100): FinancialRecordSummary =>
  ({ nip, years: [{ year, revenue, net_result: net, net_margin: net === null || revenue === null ? null : net / revenue }] });

const financial = [finance("1", 2025, -20), finance("2", 2025, -3), finance("3", 2025, 4), finance("4", 2025, 12), finance("5", 2025, null), finance("6", 2024, 1)];

const pair = (a: string, b: string, distance: number): JgpPeerPair => ({ a, b, peer_grade_pred: distance <= 10.01 ? "A" : "B", distance_score: distance });
const pairs = [pair("04|1", "04|2", 4), pair("04|1", "07|3", 2.5), pair("04|1", "07|4", 15), pair("07|3", "07|4", 9)];

const psz = new Set(["1", "2", "3", "4", "5", "6"]);

const facilities = [["04", "1", "SZPITAL A", "NOWA SÓL"], ["04", "2", "SZPITAL B", "ZIELONA GÓRA"], ["07", "3", "SZPITAL C", "WARSZAWA"]] as const;

describe("buildHospitalHomeStats", () => {
  const stats = buildHospitalHomeStats(profiles, financial, pairs, facilities, psz, "04|1");

  it("liczy placówki według łóżek (osobno bez łóżek), medianę szpitali z łóżkami i oddziały SOR", () => {
    expect(stats).toMatchObject({ profiles: 5, withBeds: 4, medianBeds: 200, withSor: 2, sorUnits: 2 });
    expect(stats.beds.map((bin) => [bin.label, bin.count])).toEqual([["bez łóżek", 1], ["1–99", 1], ["100–199", 1], ["200–299", 1], ["300–499", 0], ["500–799", 0], ["800+", 1]]);
    const twoSor = buildHospitalHomeStats([...profiles, profile("08", "6", 300, 2)], financial, pairs, facilities, psz);
    expect(twoSor).toMatchObject({ withSor: 3, sorUnits: 4 });
  });

  it("bierze rok z największą liczbą wyników netto i liczy straty oraz marże", () => {
    expect(stats.finance).toMatchObject({ year: 2025, reported: 4, loss: 2, netResult: -7 });
    const margins = stats.finance!.margins;
    // Przedziały po 2,5 p.p. od −20 do 15 i dwa skrajne: < −20 i ≥ 15.
    expect(margins).toHaveLength(16);
    expect(margins[0]).toMatchObject({ label: "< −20", to: -20, negative: true });
    expect(margins.at(-1)).toMatchObject({ label: "≥ 15", from: 15, negative: false });
    const counts = Object.fromEntries(margins.filter((bin) => bin.count).map((bin) => [bin.label, bin.count]));
    // Marże: −20%, −3%, 4%, 12%.
    expect(counts).toEqual({ "−20…−17,5": 1, "−5…−2,5": 1, "2,5…5": 1, "10…12,5": 1 });
    expect(margins.find((bin) => bin.label === "−2,5…0")?.negative).toBe(true);
    expect(margins.find((bin) => bin.label === "0…2,5")?.negative).toBe(false);
    expect(buildHospitalHomeStats(profiles, [], pairs, facilities, psz).finance).toBeNull();
  });

  it("liczy finanse tylko dla szpitali z sieci PSZ", () => {
    const onlyPsz = buildHospitalHomeStats(profiles, financial, pairs, facilities, new Set(["1", "4"])).finance;
    // NIP 1: −20, NIP 4: +12; pozostałe poza PSZ.
    expect(onlyPsz).toMatchObject({ reported: 2, loss: 1, netResult: -8 });
    expect(buildHospitalHomeStats(profiles, financial, pairs, facilities, new Set()).finance).toBeNull();
  });

  it("liczy pary klasy A i pokazuje przykład z najbliższymi szpitalami", () => {
    expect(stats.comparison).toMatchObject({ pairsA: 3, hospitalsWithPeers: 4 });
    expect(stats.comparison.example).toEqual({
      key: "04|1", name: "SZPITAL A", city: "NOWA SÓL", peerCount: 2,
      peers: [{ key: "07|3", name: "SZPITAL C", city: "WARSZAWA", distance: 2.5 }, { key: "04|2", name: "SZPITAL B", city: "ZIELONA GÓRA", distance: 4 }],
    });
  });

  it("bez wybranego szpitala w parach bierze szpital z największą liczbą par A", () => {
    const example = buildHospitalHomeStats(profiles, financial, pairs, facilities, psz, "99|0").comparison.example!;
    expect(example.key).toBe("04|1");
    expect(buildHospitalHomeStats(profiles, financial, [], facilities, psz).comparison.example).toBeNull();
  });
});

describe("buildHospitalMapStats", () => {
  const index: FacilityYearsIndex = {
    version: 1,
    years: ["2024", "2025"],
    facilities: [["07", "1", "A", "WARSZAWA"], ["07", "2", "B", "WARSZAWA"], ["07", "3", "C", "RADOM"], ["07", "4", "D", "WIEŚ"], ["07", "5", "E", "RADOM"]],
    active: [3, 3, 3, 2, 1],
  };
  // Dwie sekcje: hospitalizacje szpitala sumują się po sekcjach; rok 0 (2024) nie liczy się do mapy.
  const section = (rows: [number, number, number][]): FacilityYearsSection => ({
    version: 2,
    products: ["X"],
    rows: { product: rows.map(() => 0), facility: rows.map(([f]) => f), year: rows.map(([, y]) => y), hMin: rows.map(([, , h]) => h), hSim: rows.map(([, , h]) => h + 1), dMin: rows.map(() => 0), dSim: rows.map(() => 0) },
  });
  const sections = [section([[0, 1, 300], [1, 1, 100], [2, 1, 40], [3, 1, 20], [4, 0, 500]]), section([[0, 1, 100]])];
  const cities: CitiesMap = { version: 1, source: "test", viewBox: [1000, 946], cities: [["WARSZAWA", "07", 600.04, 400.06, 1, "2021"], ["RADOM", "07", 620, 520, 1, "2021"]] };
  const map: RegionsMap = { version: 1, source: "test", viewBox: [1000, 946], regions: [["07", "Mazowieckie", "M0 0h10v10z", [5, 5]]] };

  it("kropka na szpital z hospitalizacjami w najnowszym roku (metoda min), jak na mapie katalogu", () => {
    const stats = buildHospitalMapStats(index, sections, cities, map, new Set(["1", "3"]))!;
    expect(stats).toMatchObject({ year: "2025", viewBox: [1000, 946], regions: ["M0 0h10v10z"], hospitals: 4, inPsz: 2, missing: 1 });
    // Szpital E ma hospitalizacje tylko w 2024 r., szpital D ma siedzibę spoza słownika miast: bez kropki.
    expect(stats.dots).toHaveLength(3);
    // Poza siecią pod spodem, sieć PSZ na wierzchu.
    expect(stats.dots.map((dot) => dot[3])).toEqual([0, 1, 1]);
    // Największy szpital (A: 400) w punkcie miasta, z promieniem maksymalnym; współrzędne zaokrąglone do 0,1.
    expect(stats.dots).toContainEqual([600, 400.1, CATALOG_DOT_RADIUS.max, 1]);
    for (const dot of stats.dots) for (const value of dot.slice(0, 3)) expect(Math.round(value * 10) / 10).toBe(value);
  });

  it("bez mapy województw albo bez lat zwraca null", () => {
    expect(buildHospitalMapStats(index, sections, cities, null, new Set())).toBeNull();
    expect(buildHospitalMapStats({ ...index, years: [] }, sections, cities, map, new Set())).toBeNull();
  });
});
