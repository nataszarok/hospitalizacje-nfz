import { describe, expect, it } from "vitest";
import { admissionsFromDataset, mortalityFromDataset, referenceFromDataset } from "@/lib/staticData";

type Dataset = Parameters<typeof referenceFromDataset>[0];

function dataset(): Dataset {
  return {
    version: 1,
    analysisYear: "2024",
    defaultProductCode: "P1",
    products: [
      ["P1", "A01", "Produkt 1"],
      ["P2", "A02", "Produkt 2"],
    ],
    regions: [["07", "Mazowieckie"], ["12", "Małopolskie"]],
    facilities: [
      ["07", "111", "Szpital A", "Warszawa"],
      ["07", "222", "Szpital B", "Radom"],
      ["12", "333", "Szpital C", "Kraków"],
    ],
    populations: [["07", 1_000_000], ["12", 500_000]],
    facts: [
      // ow, nip, product, duration, admission, hSim, hMin, dSim, dMin
      ["07", "111", "P1", "0-1", "6", 12, 10, 2, 1],
      ["07", "111", "P1", "2-3", "2", 7, 5, 1, 1],
      ["07", "111", "P2", "0-1", "3", 5, 4, 0, 0],
      ["07", "222", "P1", "0-1", "6", 4, 3, 0, 0],
      ["12", "333", "P1", "0-1", "9", 100, 90, 10, 9], // ignored by admissions
    ],
  } as Dataset;
}

describe("referenceFromDataset", () => {
  it("creates labels, sorted cities and duration options", () => {
    const reference = referenceFromDataset(dataset());
    expect(reference.products[0]).toMatchObject({ code: "P1", jgpCode: "A01", label: "A01 — Produkt 1" });
    expect(reference.cities).toEqual(["Kraków", "Radom", "Warszawa"]);
    expect(reference.durations).toEqual(["0-1", "2-3"]);
  });
});

describe("mortalityFromDataset", () => {
  it("uses min estimates, selected products and durations", () => {
    const result = mortalityFromDataset(dataset(), { products: ["P1"], durations: ["0-1"], method: "min", minHosp: 0 });
    expect(result.rows.map((r) => [r.nip, r.hospitalizations, r.deaths])).toEqual([
      ["333", 90, 9],
      ["111", 10, 1],
      ["222", 3, 0],
    ]);
    expect(result.current).toMatchObject({ facilities: 3, hospitalizations: 103, deaths: 10 });
  });

  it("switches consistently to sim estimates", () => {
    const result = mortalityFromDataset(dataset(), { products: ["P1"], durations: ["0-1"], method: "sim", minHosp: 0 });
    expect(result.current.hospitalizations).toBe(116);
    expect(result.current.deaths).toBe(12);
  });

  it("applies minHosp at provider level across selected products", () => {
    const result = mortalityFromDataset(dataset(), { products: ["P1", "P2"], durations: ["0-1"], method: "min", minHosp: 12 });
    expect(result.rows.map((r) => [r.nip, r.productCode])).toEqual([
      ["333", "P1"],
      ["111", "P1"],
      ["111", "P2"],
    ]);
    expect(result.current.facilities).toBe(2);
  });

  it("baseline ignores duration and minHosp but keeps selected products and method", () => {
    const result = mortalityFromDataset(dataset(), { products: ["P1"], durations: ["0-1"], method: "min", minHosp: 50 });
    expect(result.current.facilities).toBe(1);
    expect(result.baseline.facilities).toBe(3);
    expect(result.baseline.hospitalizations).toBe(108); // 10 + 5 + 3 + 90
    expect(result.hasComparison).toBe(true);
  });

  it("returns empty rows safely when no products are selected", () => {
    const result = mortalityFromDataset(dataset(), { products: [], durations: [], method: "min", minHosp: 0 });
    expect(result.rows).toEqual([]);
    expect(result.current.hospitalizations).toBe(0);
  });
});

describe("admissionsFromDataset", () => {
  it("maps admission 6 to planned and 2+3 to urgent, ignoring other codes", () => {
    const result = admissionsFromDataset(dataset(), { products: ["P1", "P2"], durations: [], method: "min", minHosp: 0 });
    const aP1 = result.rows.find((r) => r.nip === "111" && r.productCode === "P1");
    const aP2 = result.rows.find((r) => r.nip === "111" && r.productCode === "P2");
    expect(aP1).toMatchObject({ plannedAdmissions: 10, urgentAdmissions: 5, totalAdmissions: 15 });
    expect(aP2).toMatchObject({ plannedAdmissions: 0, urgentAdmissions: 4, totalAdmissions: 4 });
    expect(result.rows.some((r) => r.nip === "333")).toBe(false);
  });

  it("applies duration, method and provider-level minHosp", () => {
    const result = admissionsFromDataset(dataset(), { products: ["P1", "P2"], durations: ["0-1"], method: "sim", minHosp: 15 });
    expect(result.rows.map((r) => [r.nip, r.productCode, r.totalAdmissions])).toEqual([
      ["111", "P1", 12],
      ["111", "P2", 5],
    ]);
  });

  it("returns empty geography stats for empty product selection", () => {
    expect(admissionsFromDataset(dataset(), { products: [], durations: [], method: "min", minHosp: 0 })).toEqual({
      rows: [],
      areaStats: { regions: [], cities: [] },
    });
  });
});
