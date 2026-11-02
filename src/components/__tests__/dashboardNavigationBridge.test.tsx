/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dashboard } from "@/components/Dashboard";
import { DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT } from "@/lib/dashboardNavigation";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2025",
  defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "A01", name: "Interna", label: "A01 — Interna" }],
  regions: [{ owNfz: "07", name: "Mazowieckie" }],
  cities: ["Warszawa"],
  durations: ["0-1"],
};
const emptyKpi = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const emptyGeo = { regions: [], cities: [] };

vi.mock("@/lib/staticData", () => ({
  loadStaticDataset: vi.fn().mockResolvedValue({}),
  referenceFromDataset: () => reference,
  mortalityFromDataset: () => ({ rows: [], current: emptyKpi, baseline: emptyKpi, hasComparison: false, areaStats: emptyGeo, baselineAreaStats: emptyGeo }),
  admissionsFromDataset: () => ({ rows: [], areaStats: emptyGeo }),
}));
vi.mock("@/components/Sidebar", () => ({ Sidebar: () => <aside /> }));
vi.mock("@/components/KpiStrip", () => ({ KpiStrip: () => null }));
vi.mock("@/components/MortalityTab", () => ({ MortalityTab: () => <div>widok: śmiertelność</div> }));
vi.mock("@/components/AdmissionTab", () => ({ AdmissionTab: () => <div>widok: tryb przyjęcia</div> }));
vi.mock("@/components/MethodologyPanel", () => ({ MethodologyPanel: () => <div>widok: metodologia</div> }));
vi.mock("@/components/HospitalAnalysisTab", () => ({
  HospitalAnalysisTab: ({ hospitalSubtab }: { hospitalSubtab: string }) => <div>widok: szpital/{hospitalSubtab}</div>,
}));

const changed = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", "/analizy");
  changed.mockReset();
  window.addEventListener(DASHBOARD_TAB_CHANGED_EVENT, changed);
});
afterEach(() => {
  window.removeEventListener(DASHBOARD_TAB_CHANGED_EVENT, changed);
  cleanup();
});

const lastChange = () => changed.mock.calls.at(-1)?.[0].detail;

describe("Dashboard — most z nagłówkiem portalu", () => {
  it("zostawia zakładki dashboardu bez zmian", async () => {
    render(<Dashboard />);
    const tabs = await screen.findByRole("navigation", { name: "Główna nawigacja" });
    expect([...tabs.querySelectorAll("button")].map((b) => b.textContent))
      .toEqual(["Liczba hospitalizacji a śmiertelność", "Tryb przyjęcia", "Profil szpitala", "Metodologia i dane"]);
  });

  it("przełącza zakładkę i widok szpitala po zdarzeniu z nagłówka", async () => {
    render(<Dashboard />);
    expect(await screen.findByText("widok: śmiertelność")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_NAVIGATE_EVENT, { detail: { tab: "hospital", hospitalSubtab: "comparison" } }));
    });
    expect(screen.getByText("widok: szpital/comparison")).toBeInTheDocument();
    expect(window.location.search).toContain("hv=c");
  });

  it("zgłasza aktywną zakładkę po kliknięciu karty dashboardu", async () => {
    render(<Dashboard />);
    await screen.findByText("widok: śmiertelność");
    await waitFor(() => expect(lastChange()).toEqual({ tab: "mortality", hospitalSubtab: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Metodologia i dane" }));
    await waitFor(() => expect(lastChange()).toEqual({ tab: "methodology", hospitalSubtab: "summary" }));
  });

  it("odtwarza podstronę z adresu /analizy?t=h&hv=c", async () => {
    window.history.replaceState(null, "", "/analizy?t=h&hv=c");
    render(<Dashboard />);
    expect(await screen.findByText("widok: szpital/comparison")).toBeInTheDocument();
  });
});
