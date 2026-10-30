import { describe, expect, it } from "vitest";
import {
  aggregateMortalityRowsByProvider,
  mortalityInsights,
  mortalityRowsPerJgp,
} from "@/lib/mortality";
import type { MortalityRow } from "@/lib/types";

function row(overrides: Partial<MortalityRow> = {}): MortalityRow {
  return {
    owNfz: "07",
    nip: "1234567890",
    productCode: "P1",
    providerName: "Szpital Testowy",
    city: "WARSZAWA",
    voivodeship: "Mazowieckie",
    population: 1_000_000,
    hospitalizations: 100,
    deaths: 5,
    mortalityPct: 5,
    hospitalizationsPer100k: 10,
    ...overrides,
  };
}

describe("aggregateMortalityRowsByProvider", () => {
  it("combines JGP rows for the same provider and recalculates derived metrics", () => {
    const result = aggregateMortalityRowsByProvider([
      row(),
      row({
        productCode: "P2",
        hospitalizations: 50,
        deaths: 10,
        mortalityPct: 20,
        hospitalizationsPer100k: 5,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      owNfz: "07",
      nip: "1234567890",
      hospitalizations: 150,
      deaths: 15,
      productCodes: ["P1", "P2"],
    });
    expect(result[0].mortalityPct).toBeCloseTo(10);
    expect(result[0].hospitalizationsPer100k).toBeCloseTo(15);
  });

  it("does not duplicate a JGP code when the source contains multiple rows for it", () => {
    const result = aggregateMortalityRowsByProvider([
      row(),
      row({ hospitalizations: 20, deaths: 1 }),
    ]);

    expect(result[0].productCodes).toEqual(["P1"]);
    expect(result[0].hospitalizations).toBe(120);
  });

  it("keeps providers from different NFZ regions separate", () => {
    const result = aggregateMortalityRowsByProvider([
      row(),
      row({ owNfz: "08", voivodeship: "Pomorskie" }),
    ]);

    expect(result).toHaveLength(2);
  });

  it("returns zero derived rates when their denominator is zero", () => {
    const result = aggregateMortalityRowsByProvider([
      row({ population: 0, hospitalizations: 0, deaths: 0 }),
    ]);

    expect(result[0].mortalityPct).toBe(0);
    expect(result[0].hospitalizationsPer100k).toBe(0);
  });
});

describe("mortalityRowsPerJgp", () => {
  it("keeps one display row per source JGP row", () => {
    const result = mortalityRowsPerJgp([
      row(),
      row({ productCode: "P2" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.productCodes)).toEqual([["P1"], ["P2"]]);
  });
});

describe("mortalityInsights", () => {
  const row = (nip: string, productCode: string, hospitalizations: number, deaths: number) => ({
    owNfz: "07", nip, productCode, providerName: nip, city: "", voivodeship: "", population: 0,
    hospitalizations, deaths, mortalityPct: 0, hospitalizationsPer100k: 0,
  });

  it("liczy średnią śmiertelność, koncentrację i śmiertelność według wielkości ośrodka", () => {
    const rows = [
      ...Array.from({ length: 11 }, (_, i) => row(`L${i}`, "P1", 100, 2)),
      row("S1", "P1", 5, 1),
      row("S1", "P2", 5, 1),
      row("S2", "P1", 4, 0),
    ];
    const insights = mortalityInsights(rows)!;
    expect(insights).toMatchObject({ providers: 13, hospitalizations: 1114, deaths: 24, topCount: 10, medianHospitalizations: 100 });
    expect(insights.topSharePct).toBeCloseTo((1000 / 1114) * 100);
    expect(insights.smallMortalityPct).toBeCloseTo((2 / 14) * 100);
    expect(insights.largeMortalityPct).toBeCloseTo(2);
  });

  it("nie dzieli na małe i duże ośrodki przy jednym świadczeniodawcy", () => {
    expect(mortalityInsights([row("A", "P1", 10, 1)])).toMatchObject({ topCount: 1, topSharePct: 100, smallMortalityPct: null, largeMortalityPct: null });
    expect(mortalityInsights([])).toBeNull();
  });
});
