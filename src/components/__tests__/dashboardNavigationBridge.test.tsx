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

const loadStaticDataset = vi.fn((year?: string) => Promise.resolve({ analysisYear: year ?? "2025" }));
vi.mock("@/lib/staticData", () => ({
  loadHospitalizationIndex: () => Promise.resolve({ version: 1, years: ["2024", "2025"], latestYear: "2025", defaultProductCode: "P1" }),
  loadStaticDataset: (year?: string) => loadStaticDataset(year),
  referenceFromDataset: (d: { analysisYear: string }) => ({ ...reference, analysisYear: d.analysisYear }),
  mortalityFromDataset: () => ({ rows: [], current: emptyKpi, baseline: emptyKpi, hasComparison: false, areaStats: emptyGeo, baselineAreaStats: emptyGeo }),
  admissionsFromDataset: () => ({ rows: [], areaStats: emptyGeo }),
}));
vi.mock("@/components/Sidebar", () => ({
  Sidebar: ({ years, year, setYear }: { years: string[]; year: string; setYear: (y: string) => void }) => <aside>
    <span>lata: {years.join(",")} · wybrany: {year}</span>
    <button onClick={() => setYear("2024")}>rok 2024</button>
  </aside>,
}));
vi.mock("@/components/KpiStrip", () => ({ KpiStrip: () => null }));
vi.mock("@/components/MortalityTab", () => ({ MortalityTab: () => <div>widok: śmiertelność</div> }));
vi.mock("@/components/AdmissionTab", () => ({ AdmissionTab: () => <div>widok: tryb przyjęcia</div> }));
vi.mock("@/components/trends/TrendView", () => ({
  TrendView: ({ productCodes, method }: { productCodes: string[]; method: string }) => <div>widok: w czasie/{productCodes.join(",")}/{method}</div>,
}));
vi.mock("@/components/MethodologyPanel", () => ({ MethodologyPanel: () => <div>widok: metodologia</div> }));
vi.mock("@/components/HospitalAnalysisTab", () => ({
  HospitalAnalysisTab: ({ hospitalSubtab }: { hospitalSubtab: string }) => <div>widok: szpital/{hospitalSubtab}</div>,
}));

const changed = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", "/analizy");
  loadStaticDataset.mockClear();
  changed.mockReset();
  window.addEventListener(DASHBOARD_TAB_CHANGED_EVENT, changed);
});
afterEach(() => {
  window.removeEventListener(DASHBOARD_TAB_CHANGED_EVENT, changed);
  cleanup();
});

const lastChange = () => changed.mock.calls.at(-1)?.[0].detail;

describe("Dashboard — most z nagłówkiem portalu", () => {
  it("ma zakładkę „W czasie” obok dotychczasowych kart", async () => {
    render(<Dashboard />);
    const tabs = await screen.findByRole("navigation", { name: "Główna nawigacja" });
    expect([...tabs.querySelectorAll("button")].map((b) => b.textContent))
      .toEqual(["W czasie", "Liczba hospitalizacji a śmiertelność", "Tryb przyjęcia", "Profil szpitala", "Metodologia i dane"]);
    // Domyślnie nadal otwiera się dotychczasowa karta.
    expect(await screen.findByText("widok: śmiertelność")).toBeInTheDocument();
  });

  it("otwiera widok „W czasie” z adresu t=w i przekazuje wybrane produkty oraz metodę", async () => {
    window.history.replaceState(null, "", "/analizy?t=w&m=sim");
    render(<Dashboard />);
    expect(await screen.findByText("widok: w czasie/P1/sim")).toBeInTheDocument();
    expect(screen.getByText(/dane NFZ 2024–2025/)).toBeInTheDocument();
    await waitFor(() => expect(lastChange()).toEqual({ tab: "trend", hospitalSubtab: "summary" }));
  });

  it("zapisuje zakładkę „W czasie” w adresie", async () => {
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "W czasie" }));
    await waitFor(() => expect(window.location.search).toBe("?t=w"));
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

  it("wybiera najnowszy rok i przekazuje listę lat do panelu", async () => {
    render(<Dashboard />);
    expect(await screen.findByText("lata: 2024,2025 · wybrany: 2025")).toBeInTheDocument();
    expect(loadStaticDataset).toHaveBeenCalledWith("2025");
    expect(window.location.search).toBe("");
  });

  it("po zmianie roku ładuje dane tego roku i zapisuje rok w adresie", async () => {
    render(<Dashboard />);
    fireEvent.click(await screen.findByText("rok 2024"));
    await waitFor(() => expect(window.location.search).toBe("?y=2024"));
    expect(loadStaticDataset).toHaveBeenCalledWith("2024");
    expect(screen.getByText("lata: 2024,2025 · wybrany: 2024")).toBeInTheDocument();
  });

  it("odtwarza rok z adresu, a nieznany rok zamienia na najnowszy", async () => {
    window.history.replaceState(null, "", "/analizy?y=2024");
    render(<Dashboard />);
    expect(await screen.findByText("lata: 2024,2025 · wybrany: 2024")).toBeInTheDocument();
    cleanup();
    window.history.replaceState(null, "", "/analizy?y=1999");
    render(<Dashboard />);
    expect(await screen.findByText("lata: 2024,2025 · wybrany: 2025")).toBeInTheDocument();
  });

  it("w profilu szpitala podaje najnowszy rok, nawet gdy w analizach wybrano starszy", async () => {
    window.history.replaceState(null, "", "/analizy?y=2024");
    render(<Dashboard />);
    expect(await screen.findByText(/dane NFZ 2024/)).toBeInTheDocument();
    act(() => { window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_NAVIGATE_EVENT, { detail: { tab: "hospital" } })); });
    expect(await screen.findByText(/dane NFZ 2025/)).toBeInTheDocument();
  });
});
