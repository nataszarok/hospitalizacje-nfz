import { describe, expect, it } from "vitest";
import { dashboardUrlSearch, readDashboardUrlState, type DashboardUrlState } from "@/lib/dashboardUrlState";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2024",
  defaultProductCode: "P1",
  products: [
    { code: "P1", jgpCode: "A01", name: "One", label: "A01 — One" },
    { code: "P2", jgpCode: "A02", name: "Two", label: "A02 — Two" },
    { code: "P3", jgpCode: null, name: "Legacy", label: "Legacy" },
  ],
  regions: [
    { owNfz: "07", name: "Mazowieckie" },
    { owNfz: "12", name: "Małopolskie" },
  ],
  cities: ["Warszawa", "Kraków"],
  durations: ["0-1", "2-3"],
};

const defaults: DashboardUrlState = {
  selectedProducts: ["P1"],
  durations: [],
  method: "min",
  minHosp: 0,
  axisMode: "total",
  admissionAxisMode: "total",
  geoMode: "regions",
  highlightedRegions: [],
  highlightedCities: [],
  activeTab: "mortality",
};

describe("dashboard URL state", () => {
  it("keeps the default state out of the URL", () => {
    expect(dashboardUrlSearch(reference, defaults)).toBe("");
  });

  it("serializes products by short JGP code", () => {
    expect(dashboardUrlSearch(reference, { ...defaults, selectedProducts: ["P1", "P2"] })).toBe("?jgp=A01&jgp=A02");
  });

  it("round-trips a non-default state", () => {
    const state: DashboardUrlState = {
      selectedProducts: ["P2"],
      durations: ["0-1", "2-3"],
      method: "sim",
      minHosp: 25,
      axisMode: "per_100k",
      admissionAxisMode: "per_100k",
      geoMode: "cities",
      highlightedRegions: ["07"],
      highlightedCities: ["Warszawa"],
      activeTab: "admissions",
    };
    expect(readDashboardUrlState(reference, dashboardUrlSearch(reference, state))).toEqual(state);
  });

  it("still reads legacy full product-code links", () => {
    expect(readDashboardUrlState(reference, "?p=P2").selectedProducts).toEqual(["P2"]);
  });

  it("falls back to legacy p= for products without JGP code", () => {
    expect(dashboardUrlSearch(reference, { ...defaults, selectedProducts: ["P3"] })).toBe("?p=P3");
  });

  it("preserves intentionally empty product selection", () => {
    expect(dashboardUrlSearch(reference, { ...defaults, selectedProducts: [] })).toBe("?jgp=-");
    expect(readDashboardUrlState(reference, "?jgp=-").selectedProducts).toEqual([]);
  });

  it("drops unknown values and limits highlighted areas", () => {
    const state = readDashboardUrlState(reference, "?jgp=BAD&jgp=A02&d=BAD&d=0-1&r=07&r=12&r=BAD&c=Warszawa&c=BAD");
    expect(state.selectedProducts).toEqual(["P2"]);
    expect(state.durations).toEqual(["0-1"]);
    expect(state.highlightedRegions).toEqual(["07", "12"]);
    expect(state.highlightedCities).toEqual(["Warszawa"]);
  });

  it("sanitizes negative, fractional and invalid minHosp", () => {
    expect(readDashboardUrlState(reference, "?n=-10").minHosp).toBe(0);
    expect(readDashboardUrlState(reference, "?n=12.9").minHosp).toBe(12);
    expect(readDashboardUrlState(reference, "?n=abc").minHosp).toBe(0);
  });

  it("uses safe defaults for invalid enums", () => {
    const state = readDashboardUrlState(reference, "?m=bad&x=bad&ax=bad&g=bad&t=bad");
    expect(state).toMatchObject({
      method: "min",
      axisMode: "total",
      admissionAxisMode: "total",
      geoMode: "regions",
      activeTab: "mortality",
    });
  });
});
