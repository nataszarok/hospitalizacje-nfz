import { describe, expect, it } from "vitest";
import { buildHospitalHomeStats, buildHospitalMapStats, type HospitalProfileSummary } from "@/lib/hospitalHomeStats";
import { CATALOG_DOT_RADIUS } from "@/lib/hospitalCatalog";
import type { RegionsMap } from "@/lib/jgpCard";
import type { CitiesMap, FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";
import type { JgpPeerPair } from "@/lib/jgpPage";

const profile = (ow: string, nip: string, beds: number | null, sor = 0): HospitalProfileSummary =>
  ({ oz_nfz: ow, nip, core: beds === null ? null : { beds }, capabilities: sor ? { sor: { count: sor } } : null });

const profiles = [profile("04", "1", 50, 1), profile("04", "2", 150), profile("07", "3", 250, 1), profile("07", "4", 900), profile("07", "5", null)];

const pair = (a: string, b: string, distance: number): JgpPeerPair => ({ a, b, peer_grade_pred: distance <= 10.01 ? "A" : "B", distance_score: distance });
const pairs = [pair("04|1", "04|2", 4), pair("04|1", "07|3", 2.5), pair("04|1", "07|4", 15), pair("07|3", "07|4", 9)];

const facilities = [["04", "1", "SZPITAL A", "NOWA SÓL"], ["04", "2", "SZPITAL B", "ZIELONA GÓRA"], ["07", "3", "SZPITAL C", "WARSZAWA"]] as const;

describe("buildHospitalHomeStats", () => {
  const stats = buildHospitalHomeStats(profiles, pairs, facilities, "04|1");

  it("liczy placówki według łóżek (osobno bez łóżek), medianę szpitali z łóżkami i oddziały SOR", () => {
    expect(stats).toMatchObject({ profiles: 5, withBeds: 4, medianBeds: 200, withSor: 2, sorUnits: 2 });
    expect(stats.beds.map((bin) => [bin.label, bin.count])).toEqual([["bez łóżek", 1], ["1–99", 1], ["100–199", 1], ["200–299", 1], ["300–499", 0], ["500–799", 0], ["800+", 1]]);
    const twoSor = buildHospitalHomeStats([...profiles, profile("08", "6", 300, 2)], pairs, facilities);
    expect(twoSor).toMatchObject({ withSor: 3, sorUnits: 4 });
  });

  it("liczy pary klasy A i pokazuje przykład z najbliższymi szpitalami", () => {
    expect(stats.comparison).toMatchObject({ pairsA: 3, hospitalsWithPeers: 4 });
    expect(stats.comparison.example).toEqual({
      key: "04|1", name: "SZPITAL A", city: "NOWA SÓL", peerCount: 2,
      peers: [{ key: "07|3", name: "SZPITAL C", city: "WARSZAWA", distance: 2.5 }, { key: "04|2", name: "SZPITAL B", city: "ZIELONA GÓRA", distance: 4 }],
    });
  });

  it("bez wybranego szpitala w parach bierze szpital z największą liczbą par A", () => {
    const example = buildHospitalHomeStats(profiles, pairs, facilities, "99|0").comparison.example!;
    expect(example.key).toBe("04|1");
    expect(buildHospitalHomeStats(profiles, [], facilities).comparison.example).toBeNull();
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
