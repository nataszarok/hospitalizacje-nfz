import { describe, expect, it } from "vitest";
import {
  aggregateMortalityRowsByProvider,
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
