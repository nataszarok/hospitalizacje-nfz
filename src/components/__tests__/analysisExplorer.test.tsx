/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnalysisExplorer } from "@/components/explorer/AnalysisExplorer";
import { DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT } from "@/lib/dashboardNavigation";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2025",
  defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "E10", name: "OZW", label: "E10 — OZW" }, { code: "P2", jgpCode: "F99", name: "Inna", label: "F99 — Inna" }],
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
vi.mock("@/components/explorer/ExplorerContextBar", () => ({
  ExplorerContextBar: ({ view, years, year, setYear, setSelectedProducts }: { view: string; years: string[]; year: string; setYear: (y: string) => void; setSelectedProducts: (v: string[]) => void }) => <section>
    <span>kontekst: {view} · lata {years.join(",")} · rok {year}</span>
    <button onClick={() => setYear("2024")}>rok 2024</button>
    <button onClick={() => setSelectedProducts(["P1", "P2"])}>dwie grupy</button>
  </section>,
}));
vi.mock("@/components/KpiStrip", () => ({ KpiStrip: () => <div>kpi</div> }));
vi.mock("@/components/MortalityTab", () => ({ MortalityTab: () => <div>widok: kto leczy</div> }));
vi.mock("@/components/AdmissionTab", () => ({ AdmissionTab: () => <div>widok: tryb przyjęcia</div> }));
vi.mock("@/components/explorer/RegionView", () => ({ RegionView: ({ year }: { year: string }) => <div>widok: gdzie/{year}</div> }));
vi.mock("@/components/trends/TrendView", () => ({
  TrendView: ({ productCodes, method }: { productCodes: string[]; method: string }) => <div>widok: w czasie/{productCodes.join(",")}/{method}</div>,
}));

const changed = vi.fn();
const replace = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", "/analizy");
  loadStaticDataset.mockClear();
  changed.mockReset();
  replace.mockReset();
  window.addEventListener(DASHBOARD_TAB_CHANGED_EVENT, changed);
});
afterEach(() => {
  window.removeEventListener(DASHBOARD_TAB_CHANGED_EVENT, changed);
  vi.unstubAllGlobals();
  cleanup();
});

const lastChange = () => changed.mock.calls.at(-1)?.[0].detail;

describe("AnalysisExplorer", () => {
  it("ma cztery widoki-pytania i domyślnie otwiera „W czasie”", async () => {
    render(<AnalysisExplorer />);
    expect(await screen.findByText("widok: w czasie/P1/min")).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Widoki analizy" });
    expect([...tabs.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["W czasie", "Kto leczy", "Tryb przyjęcia", "Gdzie"]);
    expect(screen.getByText("Jak zmieniała się liczba hospitalizacji?")).toBeInTheDocument();
    expect(screen.queryByText("kpi")).not.toBeInTheDocument();
    expect(screen.getByText(/dane NFZ 2024–2025/)).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("nie ma profilu szpitala ani metodologii", async () => {
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    expect(screen.queryByRole("button", { name: /Profil szpitala|Metodologia/ })).not.toBeInTheDocument();
  });

  it("przełącza widok, zapisuje go w adresie i zgłasza nagłówkowi", async () => {
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByRole("button", { name: "Kto leczy" }));
    expect(screen.getByText("widok: kto leczy")).toBeInTheDocument();
    expect(screen.getByText("kpi")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?t=k"));
    await waitFor(() => expect(lastChange()).toEqual({ tab: "mortality" }));
    fireEvent.click(screen.getByRole("button", { name: "Gdzie" }));
    expect(screen.getByText("widok: gdzie/2025")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?t=g"));
  });

  it("przełącza widok po zdarzeniu z nagłówka", async () => {
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    act(() => { window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_NAVIGATE_EVENT, { detail: { tab: "admissions" } })); });
    expect(screen.getByText("widok: tryb przyjęcia")).toBeInTheDocument();
  });

  it("odtwarza widok i rok z adresu", async () => {
    window.history.replaceState(null, "", "/analizy?t=g&y=2024&m=sim");
    render(<AnalysisExplorer />);
    expect(await screen.findByText("widok: gdzie/2024")).toBeInTheDocument();
    expect(screen.getByText("kontekst: regions · lata 2024,2025 · rok 2024")).toBeInTheDocument();
    expect(loadStaticDataset).toHaveBeenCalledWith("2024");
  });

  it("po zmianie roku ładuje dane tego roku i zapisuje rok w adresie", async () => {
    window.history.replaceState(null, "", "/analizy?t=k");
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByText("rok 2024"));
    await waitFor(() => expect(window.location.search).toBe("?y=2024&t=k"));
    expect(loadStaticDataset).toHaveBeenCalledWith("2024");
  });

  it("linkuje stronę grupy JGP, gdy wybrano jedną grupę, która ją ma", async () => {
    render(<AnalysisExplorer />);
    expect(await screen.findByRole("link", { name: "Wszystko o grupie E10 →" })).toHaveAttribute("href", "/jgp/E10");
    fireEvent.click(screen.getByText("dwie grupy"));
    expect(screen.queryByRole("link", { name: /Wszystko o grupie/ })).not.toBeInTheDocument();
  });

  it.each([
    ["?t=h&hospital=07%7C111&hv=c", "/szpitale?hospital=07%7C111&hv=c"],
    ["?t=m", "/o-danych"],
  ])("przekierowuje dawny adres %s", (search, target) => {
    vi.stubGlobal("location", { ...window.location, search, replace });
    render(<AnalysisExplorer />);
    expect(replace).toHaveBeenCalledWith(target);
    expect(loadStaticDataset).not.toHaveBeenCalled();
  });
});
