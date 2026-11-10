import { describe, expect, it } from "vitest";
import {
  cityBreakdown, cityProviders, citySection, cityYearPoints, cityYearTotals, durationYears, facilityDots, facilityYearDeaths, facilityYearTotals, packCircles, regionalBreakdown, separateDots, median,
  type CitiesMap, type DurationYearsSection, type FacilityYearsIndex, type FacilityYearsSection,
} from "@/lib/regions";
import { latestDatasetFixture as dataset, trendsFixture as trends } from "./fixtures/trendsFixture";

describe("regionalBreakdown", () => {
  it("liczy województwa w wybranym roku i sortuje według liczby na 100 tys.", () => {
    const rows = regionalBreakdown(trends, ["P1"], "2025", "sim", dataset.regions, dataset.populations);
    expect(rows).toEqual([
      { owNfz: "12", name: "Śląskie", population: 4_300_000, hospitalizations: 20, per100k: (20 / 4_300_000) * 100_000, deaths: 3, mortalityPct: 15, urgentPct: 100 },
      { owNfz: "07", name: "Mazowieckie", population: 5_500_000, hospitalizations: 14, per100k: (14 / 5_500_000) * 100_000, deaths: 2, mortalityPct: (2 / 14) * 100, urgentPct: 0 },
    ]);
  });

  it("uwzględnia tylko wybrany rok, produkty i metodę", () => {
    expect(regionalBreakdown(trends, ["P1"], "2024", "min", dataset.regions, dataset.populations).map((row) => row.hospitalizations)).toEqual([8, 0]);
    expect(regionalBreakdown(trends, ["P1", "P3"], "2025", "min", dataset.regions, dataset.populations)[0]).toMatchObject({ owNfz: "12", hospitalizations: 68 });
  });

  it("zostawia województwa bez hospitalizacji i bez ludności z zerami", () => {
    const rows = regionalBreakdown(trends, ["P2"], "2025", "min", [...dataset.regions, ["99", "Testowe"]], dataset.populations);
    expect(rows.map((row) => [row.name, row.hospitalizations, row.per100k])).toEqual([["Mazowieckie", 0, 0], ["Śląskie", 0, 0], ["Testowe", 0, 0]]);
  });
});

describe("cityBreakdown", () => {
  it("sumuje hospitalizacje według miasta siedziby, od największej liczby", () => {
    const rows = cityBreakdown(dataset, ["P1", "P3"], "min");
    expect(rows.map((row) => [row.city, row.hospitalizations, row.providers])).toEqual([["GLIWICE", 50, 1], ["KATOWICE", 18, 1], ["WARSZAWA", 12, 1]]);
    expect(rows[2]).toMatchObject({ regions: ["07"], deaths: 1, urgentPct: (4 / 12) * 100 });
  });

  it("zawęża miasta do jednego OW NFZ", () => {
    expect(cityBreakdown(dataset, ["P1"], "sim", "12").map((row) => row.city)).toEqual(["KATOWICE"]);
    expect(cityBreakdown(dataset, ["P1"], "sim", "99")).toEqual([]);
  });
});

describe("placówki w latach", () => {
  // Placówki: 0 = Katowice (12), 1 = Gliwice (12, poza słownikiem miast), 2 = Warszawa (07), 3 = Katowice bez wybranych grup.
  const index: FacilityYearsIndex = {
    version: 1,
    years: ["2024", "2025"],
    facilities: [["12", "222", "Szpital Beta", "KATOWICE"], ["12", "333", "Szpital Gamma", "GLIWICE"], ["07", "111", "Szpital Alfa", "WARSZAWA"], ["12", "444", "Przychodnia", "KATOWICE"]],
    active: [0b11, 0b10, 0b11, 0b10],
  };
  const section: FacilityYearsSection = {
    version: 2,
    products: ["P1", "P2"],
    // P1: Beta 10 → 40, Alfa 0 → 20, Gamma 5 w 2025. P2 (niewybrany): Beta 99 w 2025.
    rows: { product: [0, 0, 0, 0, 1], facility: [0, 0, 2, 1, 0], year: [0, 1, 1, 1, 1], hMin: [10, 40, 20, 5, 99], hSim: [11, 41, 21, 6, 99], dMin: [1, 4, 0, 0, 9], dSim: [1, 5, 0, 0, 9] },
  };
  const map: CitiesMap = { version: 1, source: "test", viewBox: [1000, 946], cities: [["KATOWICE", "12", 450, 750, 200_000, "2024"], ["WARSZAWA", "07", 650, 350, 1_000_000, "2024"]] };

  it("facilityYearTotals i cityYearTotals: wybrane produkty w latach, sumy miast z placówek", () => {
    const totals = facilityYearTotals(index, [section], ["P1"], "min");
    expect(Object.fromEntries(totals)).toEqual({ 0: [10, 40], 1: [0, 5], 2: [0, 20] });
    expect(facilityYearTotals(index, [section], ["P1"], "sim").get(0)).toEqual([11, 41]);
    // Zgony tych samych produktów (dymek mapy).
    expect(Object.fromEntries(facilityYearDeaths(index, [section], ["P1"], "min"))).toEqual({ 0: [1, 4], 1: [0, 0], 2: [0, 0] });
    expect(facilityYearDeaths(index, [section], ["P1"], "sim").get(0)).toEqual([1, 5]);
    expect(Object.fromEntries(cityYearTotals(index, totals))).toEqual({ KATOWICE: [10, 40], GLIWICE: [0, 5], WARSZAWA: [0, 20] });
  });

  it("cityYearPoints: punkty roku i skala wspólna dla wszystkich lat", () => {
    const totals = cityYearTotals(index, facilityYearTotals(index, [section], ["P1"], "min"));
    const year2024 = cityYearPoints(totals, map, 0);
    expect(year2024.points.map((point) => point.city)).toEqual(["KATOWICE"]);
    expect(year2024.maxHospitalizations).toBe(40);
    // Wskaźniki: Katowice 5 i 20, Warszawa 2 na 100 tys. → mediana 5.
    expect(year2024.medianPer100k).toBe(5);
    const year2025 = cityYearPoints(totals, map, 1);
    expect(year2025.points.map((point) => [point.city, point.owNfz, point.per100k])).toEqual([["KATOWICE", "12", 20], ["WARSZAWA", "07", 2]]);
    expect(year2025.missing).toEqual([{ city: "GLIWICE", hospitalizations: 5 }]);
  });

  it("facilityDots: tylko placówki z ≥ 10 hospitalizacjami w roku i z miastem w słowniku; placówki miasta ciasno obok siebie", () => {
    const totals = facilityYearTotals(index, [section], ["P1"], "min");
    const radius = (value: number) => Math.sqrt(value);
    // 2025: Beta 40 (Katowice), Alfa 20 (Warszawa); Gamma 5 — poniżej progu i bez miasta w słowniku; Delta bez wybranych grup.
    const dots2025 = facilityDots(index, totals, map, 1, radius);
    expect(dots2025.map((dot) => [dot.name, dot.hospitalizations]).sort()).toEqual([["Szpital Alfa", 20], ["Szpital Beta", 40]]);
    expect(dots2025.find((dot) => dot.nip === "222")).toMatchObject({ x: 450, y: 750, r: Math.sqrt(40) });
    // 2024: Beta 10 = próg (jest), Alfa 0 (nie ma).
    expect(facilityDots(index, totals, map, 0, radius).map((dot) => dot.name)).toEqual(["Szpital Beta"]);
  });

  it("packCircles: koła stykają się bez nakładania, największe w środku, reszta blisko niego", () => {
    const radii = [10, 6, 6, 4, 4, 4, 3, 3, 2, 2];
    const points = packCircles(radii, 0.8);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    for (let a = 0; a < radii.length; a++) {
      for (let b = a + 1; b < radii.length; b++) {
        expect(Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y)).toBeGreaterThanOrEqual(radii[a] + radii[b] + 0.8 - 1e-6);
      }
    }
    // Ciasno: wszystkie koła w promieniu 2,5 × promień największego (luźna spirala dawała ok. 4 ×).
    expect(Math.max(...points.map((p, i) => Math.hypot(p.x, p.y) + radii[i]))).toBeLessThan(10 * 2.5);
  });

  it("separateDots: rozsuwa koła sąsiednich miast, mniejsze przesuwa dalej; koła bez kolizji zostają", () => {
    // Duże koło „Warszawy” i małe koło sąsiedniego miasta 5 jednostek dalej; trzecie daleko.
    const dots = [{ x: 0, y: 0, r: 20 }, { x: 5, y: 0, r: 5 }, { x: 200, y: 200, r: 5 }];
    const out = separateDots(dots);
    for (let a = 0; a < out.length; a++) {
      for (let b = a + 1; b < out.length; b++) {
        expect(Math.hypot(out[a].x - out[b].x, out[a].y - out[b].y)).toBeGreaterThanOrEqual(out[a].r + out[b].r + 0.5 - 1e-3);
      }
    }
    expect(Math.abs(out[0].x)).toBeLessThan(Math.abs(out[1].x - 5));
    expect(out[2]).toEqual(dots[2]);
    // Wejście bez zmian (kopie kół).
    expect(dots[1]).toEqual({ x: 5, y: 0, r: 5 });
  });

  it("median: środek posortowanych wartości, średnia dwóch środkowych, 0 bez wartości", () => {
    expect(median([40, 10, 20])).toBe(20);
    expect(median([10, 40, 20, 30])).toBe(25);
    expect(median([])).toBe(0);
  });

  it("citySection: pierwsza litera kodu JGP, „_” bez kodu", () => {
    expect(citySection("h52")).toBe("H");
    expect(citySection(null)).toBe("_");
  });

  it("cityProviders: placówki z siedzibą w mieście od największej liczby hospitalizacji", () => {
    const rows = cityProviders(dataset, ["P1"], "min", "KATOWICE");
    expect(rows).toEqual([expect.objectContaining({ owNfz: "12", nip: "222", name: "Szpital Beta", hospitalizations: 18 })]);
    expect(rows[0].urgentPct).toBe(100);
    expect(cityProviders(dataset, ["P1"], "min", "WARSZAWA")[0]).toMatchObject({ hospitalizations: 12, deaths: 1 });
  });});

describe("durationYears", () => {
  const section: DurationYearsSection = {
    version: 1, years: ["2024", "2025"], durations: ["0 dni", "6 i więcej dni"], products: ["P1"],
    rows: {
      product: [0, 0, 0, 0], year: [0, 1, 1, 1], ow: ["07", "07", "12", "07"], duration: [0, 0, 1, 1],
      hMin: [5, 4, 10, 3], hSim: [5, 4, 10, 3], dMin: [0, 0, 1, 1], dSim: [0, 0, 1, 1], uMin: [1, 0, 5, 3], uSim: [1, 0, 5, 3],
    },
  };

  it("liczy lata z wybranymi przedziałami długości pobytu, dla kraju albo sumy województw", () => {
    const all = durationYears([section], ["2024", "2025"], ["P1"], "min", ["6 i więcej dni"], []);
    // 2024: produkt jest w danych, ale bez pobytów 6+ dni → zero, nie przerwa.
    expect(all.get("P1")).toEqual([{ year: "2024", hospitalizations: 0, deaths: 0, urgent: 0 }, { year: "2025", hospitalizations: 13, deaths: 2, urgent: 8 }]);
    const mazowieckie = durationYears([section], ["2024", "2025"], ["P1"], "min", ["0 dni", "6 i więcej dni"], ["07"]);
    expect(mazowieckie.get("P1")!.map((point) => point?.hospitalizations)).toEqual([5, 7]);
  });
});
