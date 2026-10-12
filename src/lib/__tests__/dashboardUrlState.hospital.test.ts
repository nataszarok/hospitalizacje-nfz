import { describe, expect, it } from "vitest";
import { dashboardUrlSearch, readDashboardUrlState, type DashboardUrlState } from "@/lib/dashboardUrlState";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2024",
  defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "A01", name: "Interna", label: "A01 — Interna" }],
  regions: [{ owNfz: "07", name: "Mazowieckie" }],
  cities: ["Warszawa"],
  durations: ["0-1"],
};
const defaults: DashboardUrlState = {
  selectedProducts: ["P1"], durations: [], method: "min", minHosp: 0,
  axisMode: "total", admissionAxisMode: "total", geoMode: "regions",
  highlightedRegions: [], highlightedCities: [], activeTab: "mortality",
  hospitalKey: "", hospitalSubtab: "summary", peerThreshold: 75,
};

describe("dashboard URL state — szpitale", () => {
  it("zachowuje pusty URL dla domyślnego stanu szpitali", () => {
    expect(dashboardUrlSearch(reference, defaults)).toBe("");
    expect(readDashboardUrlState(reference, "")).toEqual(defaults);
  });

  it("koduje kartę szpitala, klucz z separatorem | i podkartę profilu", () => {
    const state = { ...defaults, activeTab: "hospital" as const, hospitalKey: "07|111", hospitalSubtab: "summary" as const };
    const search = dashboardUrlSearch(reference, state);
    const params = new URLSearchParams(search);
    expect(params.get("t")).toBe("h");
    expect(params.get("hospital")).toBe("07|111");
    expect(params.has("hv")).toBe(false);
    expect(readDashboardUrlState(reference, search)).toEqual(state);
  });

  it.each([
    ["comparison", "c"],
    ["similarity", "s"],
  ] as const)("odtwarza podkartę %s (hv=%s)", (hospitalSubtab, value) => {
    const state = { ...defaults, activeTab: "hospital" as const, hospitalKey: "12|333", hospitalSubtab, peerThreshold: 85 };
    const search = dashboardUrlSearch(reference, state);
    const params = new URLSearchParams(search);
    expect(params.get("hv")).toBe(value);
    expect(params.get("peer")).toBe("85");
    expect(readDashboardUrlState(reference, search)).toEqual(state);
  });

  it("nie dodaje parametru peer dla domyślnych 75%", () => {
    expect(new URLSearchParams(dashboardUrlSearch(reference, { ...defaults, activeTab: "hospital" })).has("peer")).toBe(false);
  });

  it.each([
    ["?hv=xyz&peer=abc", "summary", 75],
    ["?peer=-20", "summary", 75],
    ["?peer=1", "summary", 70],
    ["?peer=999", "summary", 90],
    ["?peer=80.9", "summary", 80],
    ["?hv=s&peer=88", "similarity", 88],
    ["?hv=c&peer=72", "comparison", 72],
  ] as const)("bezpiecznie parsuje %s", (search, subtab, threshold) => {
    expect(readDashboardUrlState(reference, search)).toMatchObject({ hospitalSubtab: subtab, peerThreshold: threshold });
  });

  it("serializacja obcina wartości peer spoza zakresu i zaokrągla w dół", () => {
    const lower = new URLSearchParams(dashboardUrlSearch(reference, { ...defaults, peerThreshold: 55.8 }));
    const upper = new URLSearchParams(dashboardUrlSearch(reference, { ...defaults, peerThreshold: 99 }));
    expect(lower.get("peer")).toBe("70");
    expect(upper.get("peer")).toBe("90");
  });

  it("nie traci ustawień szpitala przy aktywnej innej karcie", () => {
    const state = { ...defaults, activeTab: "admissions" as const, hospitalKey: "07|111", hospitalSubtab: "similarity" as const, peerThreshold: 80 };
    expect(readDashboardUrlState(reference, dashboardUrlSearch(reference, state))).toEqual(state);
  });
});
