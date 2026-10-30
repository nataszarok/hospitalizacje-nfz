import { describe, expect, it } from "vitest";
import { dashboardUrlSearch, readDashboardUrlState, type DashboardUrlState } from "@/lib/dashboardUrlState";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2025",
  defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "E10", name: "One", label: "E10 — One" }, { code: "P2", jgpCode: "F99", name: "Two", label: "F99 — Two" }],
  regions: [],
  cities: [],
  durations: [],
};

const state: DashboardUrlState = {
  selectedProducts: ["P1"], durations: [], method: "min", minHosp: 0, axisMode: "total", admissionAxisMode: "total",
  geoMode: "regions", highlightedRegions: [], highlightedCities: [], activeTab: "trend",
};

describe("zakładka „W czasie” w adresie", () => {
  it("czyta t=w razem z wyborem grup JGP", () => {
    expect(readDashboardUrlState(reference, "?t=w&jgp=F99")).toMatchObject({ activeTab: "trend", selectedProducts: ["P2"] });
  });

  it("zapisuje t=w", () => {
    expect(dashboardUrlSearch(reference, state)).toBe("?t=w");
    expect(dashboardUrlSearch(reference, { ...state, selectedProducts: ["P2"] })).toBe("?jgp=F99&t=w");
  });

  it("link ze strony grupy JGP odtwarza ten sam stan", () => {
    const restored = readDashboardUrlState(reference, "?t=w&jgp=E10");
    expect(restored).toMatchObject({ activeTab: "trend", selectedProducts: ["P1"] });
    expect(dashboardUrlSearch(reference, restored)).toBe("?t=w");
  });
});
