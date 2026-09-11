import { describe, expect, it } from "vitest";
import {
  parseCsvParam,
  parseMethod,
  parseMinHosp,
  summarize,
  summarizeAdmissionGeographies,
  summarizeGeographies,
} from "@/lib/query";
import type { AdmissionRow, MortalityRow } from "@/lib/types";

const mortalityRow = (overrides: Partial<MortalityRow> = {}): MortalityRow => ({
  owNfz: "07",
  nip: "111",
  productCode: "P1",
  providerName: "Szpital A",
  city: "Warszawa",
  voivodeship: "Mazowieckie",
  population: 1_000_000,
  hospitalizations: 100,
  deaths: 5,
  mortalityPct: 5,
  hospitalizationsPer100k: 10,
  ...overrides,
});

const admissionRow = (overrides: Partial<AdmissionRow> = {}): AdmissionRow => ({
  owNfz: "07",
  nip: "111",
  productCode: "P1",
  providerName: "Szpital A",
  city: "Warszawa",
  voivodeship: "Mazowieckie",
  population: 1_000_000,
  plannedAdmissions: 20,
  urgentAdmissions: 10,
  totalAdmissions: 30,
  plannedAdmissionsPer100k: 2,
  urgentAdmissionsPer100k: 1,
  ...overrides,
});

describe("query parsers", () => {
  it("deduplicates, trims and limits CSV values", () => {
    expect(parseCsvParam(" A, B,A, ,C ", 2)).toEqual(["A", "B"]);
  });

  it("falls back safely for invalid method and minHosp", () => {
    expect(parseMethod("sim")).toBe("sim");
    expect(parseMethod("other")).toBe("min");
    expect(parseMinHosp("25")).toBe(25);
    expect(parseMinHosp("-5")).toBe(0);
    expect(parseMinHosp("abc")).toBe(0);
  });
});

describe("mortality summaries", () => {
  it("counts unique providers across multiple products", () => {
    const rows = [
      mortalityRow({ productCode: "P1", hospitalizations: 100, deaths: 5 }),
      mortalityRow({ productCode: "P2", hospitalizations: 50, deaths: 5 }),
      mortalityRow({ nip: "222", productCode: "P1", hospitalizations: 50, deaths: 0 }),
    ];
    expect(summarize(rows)).toEqual({
      facilities: 2,
      hospitalizations: 200,
      deaths: 10,
      mortalityPct: 5,
    });
  });

  it("returns zero mortality instead of NaN when hospitalizations are zero", () => {
    expect(summarize([mortalityRow({ hospitalizations: 0, deaths: 0 })]).mortalityPct).toBe(0);
  });

  it("builds region totals and product subrows only for multi-product areas", () => {
    const stats = summarizeGeographies([
      mortalityRow({ productCode: "P1", hospitalizations: 100, deaths: 5 }),
      mortalityRow({ productCode: "P2", hospitalizations: 50, deaths: 5 }),
    ]);
    expect(stats.regions).toHaveLength(1);
    expect(stats.regions[0].rows).toHaveLength(3);
    expect(stats.regions[0].rows[0]).toMatchObject({
      productCode: null,
      hospitalizations: 150,
      deaths: 10,
      facilities: 1,
    });

    expect(stats.regions[0].rows[0].hospitalizationsPer100k).toBeCloseTo(15);
  });

  it("does not invent per-100k city rates", () => {
    const stats = summarizeGeographies([mortalityRow()]);
    expect(stats.cities[0].rows[0].hospitalizationsPer100k).toBeNull();
  });
});

describe("admission summaries", () => {
  it("aggregates planned and urgent admissions and ratio", () => {
    const stats = summarizeAdmissionGeographies([
      admissionRow({ plannedAdmissions: 20, urgentAdmissions: 10, totalAdmissions: 30 }),
      admissionRow({ nip: "222", plannedAdmissions: 10, urgentAdmissions: 5, totalAdmissions: 15 }),
    ]);
    expect(stats.regions[0]).toMatchObject({
      plannedAdmissions: 30,
      urgentAdmissions: 15,
      totalAdmissions: 45,
      facilities: 2,
      plannedToUrgentRatioPct: 200,
    });
  });

  it("returns null planned/urgent ratio when urgent admissions are zero", () => {
    const stats = summarizeAdmissionGeographies([admissionRow({ urgentAdmissions: 0 })]);
    expect(stats.regions[0].plannedToUrgentRatioPct).toBeNull();
  });
});
