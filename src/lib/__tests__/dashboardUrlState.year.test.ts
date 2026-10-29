import { describe, expect, it } from "vitest";
import { dashboardUrlSearch, readDashboardUrlState, resolveDashboardYear, type DashboardUrlState } from "@/lib/dashboardUrlState";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2024",
  defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "A01", name: "One", label: "A01 — One" }],
  regions: [],
  cities: [],
  durations: [],
};

const state: DashboardUrlState = {
  selectedProducts: ["P1"], durations: [], method: "min", minHosp: 0, axisMode: "total", admissionAxisMode: "total",
  geoMode: "regions", highlightedRegions: [], highlightedCities: [], activeTab: "mortality",
};

describe("rok danych w adresie", () => {
  it("czyta parametr y", () => {
    expect(readDashboardUrlState(reference, "?y=2024").year).toBe("2024");
    expect(readDashboardUrlState(reference, "").year).toBeUndefined();
    expect(readDashboardUrlState(reference, "?y=").year).toBeUndefined();
  });

  it("wybiera rok z listy, a nieznany zamienia na najnowszy", () => {
    expect(resolveDashboardYear("2024", ["2024", "2025"], "2025")).toBe("2024");
    expect(resolveDashboardYear("1999", ["2024", "2025"], "2025")).toBe("2025");
    expect(resolveDashboardYear(undefined, ["2024", "2025"], "2025")).toBe("2025");
  });

  it("zapisuje tylko rok inny niż najnowszy", () => {
    expect(dashboardUrlSearch(reference, { ...state, year: "2024" }, "2025")).toBe("?y=2024");
    expect(dashboardUrlSearch(reference, { ...state, year: "2025" }, "2025")).toBe("");
    expect(dashboardUrlSearch(reference, state, "2025")).toBe("");
  });

  it("zachowuje rok razem z innymi parametrami", () => {
    expect(dashboardUrlSearch(reference, { ...state, year: "2024", activeTab: "admissions" }, "2025")).toBe("?y=2024&t=a");
  });
});
