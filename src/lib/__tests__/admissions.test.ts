import { describe, expect, it } from "vitest";
import {
  admissionRowsPerJgp,
  aggregateAdmissionRowsByProvider,
} from "@/lib/admissions";
import type { AdmissionRow } from "@/lib/types";

function row(overrides: Partial<AdmissionRow> = {}): AdmissionRow {
  return {
    owNfz: "07",
    nip: "123",
    productCode: "P1",
    providerName: "Szpital",
    city: "Warszawa",
    voivodeship: "Mazowieckie",
    population: 1_000_000,
    plannedAdmissions: 100,
    urgentAdmissions: 20,
    totalAdmissions: 120,
    plannedAdmissionsPer100k: 10,
    urgentAdmissionsPer100k: 2,
    ...overrides,
  };
}

describe("admission JGP display rows", () => {
  it("combines selected JGP rows for the same provider", () => {
    const result = aggregateAdmissionRowsByProvider([
      row(),
      row({
        productCode: "P2",
        plannedAdmissions: 50,
        urgentAdmissions: 10,
        totalAdmissions: 60,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].productCodes).toEqual(["P1", "P2"]);
    expect(result[0].plannedAdmissions).toBe(150);
    expect(result[0].urgentAdmissions).toBe(30);
    expect(result[0].totalAdmissions).toBe(180);
    expect(result[0].plannedAdmissionsPer100k).toBeCloseTo(15);
    expect(result[0].urgentAdmissionsPer100k).toBeCloseTo(3);
  });

  it("keeps providers from different NFZ branches separate", () => {
    const result = aggregateAdmissionRowsByProvider([
      row(),
      row({ owNfz: "08", productCode: "P2" }),
    ]);

    expect(result).toHaveLength(2);
  });

  it("does not duplicate a JGP code", () => {
    const result = aggregateAdmissionRowsByProvider([row(), row()]);

    expect(result[0].productCodes).toEqual(["P1"]);
  });

  it("returns zero per-100k values when population is zero", () => {
    const result = aggregateAdmissionRowsByProvider([row({ population: 0 })]);

    expect(result[0].plannedAdmissionsPer100k).toBe(0);
    expect(result[0].urgentAdmissionsPer100k).toBe(0);
  });

  it("keeps one display row per source row in per-JGP mode", () => {
    const result = admissionRowsPerJgp([row(), row({ productCode: "P2" })]);

    expect(result).toHaveLength(2);
    expect(result[0].productCodes).toEqual(["P1"]);
    expect(result[1].productCodes).toEqual(["P2"]);
  });
});
