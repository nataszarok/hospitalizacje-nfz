import { describe, expect, it } from "vitest";
import { dashboardUrlSearch, legacyAnalysisRedirect, readDashboardUrlState, type DashboardUrlState } from "@/lib/dashboardUrlState";
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

describe("widoki eksploratora w adresie", () => {
  it("czyta dawne t=w razem z wyborem grup JGP", () => {
    expect(readDashboardUrlState(reference, "?t=w&jgp=F99")).toMatchObject({ activeTab: "trend", selectedProducts: ["P2"] });
  });

  it("„W czasie” to widok domyślny: nie trafia do adresu", () => {
    expect(dashboardUrlSearch(reference, state)).toBe("");
    expect(dashboardUrlSearch(reference, { ...state, selectedProducts: ["P2"] })).toBe("?jgp=F99");
  });

  it("link ze strony grupy JGP odtwarza ten sam stan", () => {
    const restored = readDashboardUrlState(reference, "?jgp=E10");
    expect(restored).toMatchObject({ activeTab: "trend", selectedProducts: ["P1"] });
    expect(dashboardUrlSearch(reference, restored)).toBe("");
  });
});

describe("widoki eksploratora — parametry t", () => {
  it.each([
    ["mortality", "?t=k"],
    ["admissions", "?t=a"],
    ["regions", "?t=g"],
  ] as const)("widok %s zapisuje %s i czyta go z powrotem", (tab, search) => {
    expect(dashboardUrlSearch(reference, { ...state, activeTab: tab })).toBe(search);
    expect(readDashboardUrlState(reference, search).activeTab).toBe(tab);
  });
});

describe("legacyAnalysisRedirect", () => {
  it("przenosi profil szpitala na /szpitale z kluczem, widokiem i metodą", () => {
    expect(legacyAnalysisRedirect("?t=h&hospital=07%7C111&hv=c&m=sim&jgp=E10")).toBe("/szpitale?hospital=07%7C111&hv=c&m=sim");
    expect(legacyAnalysisRedirect("?t=h&hv=s")).toBe("/szpitale?hv=c");
    expect(legacyAnalysisRedirect("?t=h")).toBe("/szpitale");
  });

  it("przenosi metodologię na /o-danych", () => {
    expect(legacyAnalysisRedirect("?t=m")).toBe("/o-danych");
  });

  it("zostawia widoki analizy", () => {
    expect(legacyAnalysisRedirect("?t=a&jgp=E10")).toBeNull();
    expect(legacyAnalysisRedirect("")).toBeNull();
  });
});
