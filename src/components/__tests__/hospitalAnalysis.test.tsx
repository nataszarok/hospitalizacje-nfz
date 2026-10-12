/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HospitalAnalysisTab } from "@/components/HospitalAnalysisTab";
import type { HospitalAnalysis } from "@/lib/types";
import { products, sampleAnalysis } from "./fixtures/hospitalFixtures";

const mocks = vi.hoisted(() => ({
  loadStaticDataset: vi.fn(),
  hospitalDirectoryFromDataset: vi.fn(),
  hospitalAnalysisFromDataset: vi.fn(),
}));

vi.mock("@/lib/staticData", () => ({
  loadStaticDataset: mocks.loadStaticDataset,
  hospitalDirectoryFromDataset: mocks.hospitalDirectoryFromDataset,
  hospitalAnalysisFromDataset: mocks.hospitalAnalysisFromDataset,
}));
vi.mock("@mantine/core", () => ({
  Select: ({ data, value, onChange }: {
    data: { value: string; label: string }[];
    value: string | null;
    onChange: (value: string | null) => void;
  }) => (
    <select aria-label="Wybierz szpital" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Wybierz szpital</option>
      {data.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
    </select>
  ),
}));
vi.mock("plotly.js-dist-min", () => ({
  default: { react: vi.fn().mockResolvedValue(undefined), restyle: vi.fn().mockResolvedValue(undefined), purge: vi.fn() },
}));

const key = "07|1234567890";
const altKey = "07|2222222222";
const baseProps = {
  hospitalKey: key, setHospitalKey: vi.fn(), hospitalSubtab: "summary" as const,
  setHospitalSubtab: vi.fn(), peerThreshold: 75, setPeerThreshold: vi.fn(),
  method: "sim" as const, products,
};

const rpwdl = {
  version: 1, rpwdl_snapshot_date: "2025-12-31",
  records: [{
    oz_nfz: "07", nip: "1234567890", source_city: "Warszawa",
    primary_address: { city: "Warszawa", street: "Testowa", building: "12" },
    core: { ward_count: 2, beds: 105, field_count: 2, fields: ["Chirurgia", "Kardiologia"], wards: [
      { code: "C", name: "Chirurgia", beds: 80, fields: ["Chirurgia"] },
      { code: "K", name: "Kardiologia", beds: 25, fields: ["Kardiologia"] },
    ] },
    outpatient: { cell_count: 4, field_count: 1, fields: ["Alergologia"], location_count: 2 },
    registry: { location_count: 3, city_count: 2, total_beds: 120, location_types: {
      hospital: { locations: 1, beds: 105 }, outpatient: { locations: 2, aos_cells: 4 },
    } },
    capabilities: { sor: { beds: 4 }, dialysis: { stations: 8 } },
  }],
};

const financial = {
  version: 1, currency: "PLN", entity_level: "nip", preferred_year: 2025,
  records: [{
    nip: "123-456-78-90", name: "Szpital Miejski", latest_result_year: 2024, latest_values_year: 2024,
    years: [{ year: 2024, revenue: 210_000_000, net_result: -12_000_000,
      net_margin: -5.7, assets: 100_000_000, has_values: true, status: null,
      precision: "exact", source_service: null, source_url: null, notes: null }],
  }],
};

function responseJson(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadStaticDataset.mockResolvedValue({});
  mocks.hospitalDirectoryFromDataset.mockReturnValue([
    { key, owNfz: "07", nip: "1234567890", name: "Szpital Miejski", city: "Warszawa" },
    { key: altKey, owNfz: "07", nip: "2222222222", name: "Inny Szpital", city: "Radom" },
  ]);
  mocks.hospitalAnalysisFromDataset.mockImplementation((_d: unknown, hospitalKey: string, method: string): HospitalAnalysis =>
    sampleAnalysis({ key: hospitalKey, nip: hospitalKey.split("|")[1], hospitalizations: method === "min" ? 8000 : 9000 }));
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(responseJson(
    url.includes("rpwdl_summary_profiles") ? rpwdl : financial,
  ))));
  // Efekt komponentu umieszcza selektor w istniejącym slocie sidebara.
  const slot = document.createElement("div");
  slot.id = "hospital-sidebar-slot";
  document.body.appendChild(slot);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  document.getElementById("hospital-sidebar-slot")?.remove();
  vi.unstubAllGlobals();
});

describe("HospitalAnalysisTab — profil szpitala", () => {
  it("ładuje katalog szpitali i oba opcjonalne pliki JSON", async () => {
    render(<HospitalAnalysisTab {...baseProps} />);
    await screen.findByRole("heading", { name: "Szpital Miejski w Warszawie" });
    expect(fetch).toHaveBeenCalledWith("/data/rpwdl_summary_profiles.json.gz", { cache: "force-cache" });
    expect(fetch).toHaveBeenCalledWith("/data/financial_results.json.gz", { cache: "force-cache" });
    expect(screen.getByText("Testowa 12")).toBeInTheDocument();
    expect(screen.getByText(/Stan na 2025-12-31/)).toBeInTheDocument();
  });

  it("pokazuje stratę finansową, normalizuje NIP i informuje o danych z wcześniejszego roku", async () => {
    render(<HospitalAnalysisTab {...baseProps} />);
    expect(await screen.findByText("Strata netto (2024)")).toBeInTheDocument();
    expect(screen.getByText(/-12 mln zł/)).toBeInTheDocument();
    expect(screen.getByText(/Brak danych za 2025/)).toBeInTheDocument();
    expect(screen.getByText(/Przychód 210 mln zł/)).toBeInTheDocument();
  });

  it("rozwija oddziały RPWDL i sortuje je według liczby łóżek", async () => {
    render(<HospitalAnalysisTab {...baseProps} />);
    await screen.findByText("Strata netto (2024)");
    fireEvent.click(screen.getByRole("button", { name: /Główne oddziały i dziedziny/ }));
    const table = document.querySelector(".hospital-rpwdl-wards-table") as HTMLTableElement;
    expect(table).toBeInTheDocument();
    expect(within(table).getAllByRole("row").slice(1).map((row) => row.cells[0]?.textContent)).toEqual([
      "Chirurgia", "Kardiologia",
    ]);
    fireEvent.click(within(table).getByRole("button", { name: /Łóżka/ }));
    expect(within(table).getAllByRole("row").slice(1).map((row) => row.cells[0]?.textContent)).toEqual([
      "Kardiologia", "Chirurgia",
    ]);
    expect(within(table).getByRole("button", { name: /Łóżka/ }).closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("rozwija sekcję ambulatoryjną i pokazuje dostępne specjalizacje", async () => {
    render(<HospitalAnalysisTab {...baseProps} />);
    await screen.findByText("Strata netto (2024)");
    const button = screen.getByRole("button", { name: /Opieka ambulatoryjna/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Alergologia")).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("nie pokazuje obcego profilu RPWDL i zachowuje stan panelu po powrocie do szpitala", async () => {
    const { rerender } = render(<HospitalAnalysisTab {...baseProps} />);
    await screen.findByText("Strata netto (2024)");
    fireEvent.click(screen.getByRole("button", { name: /Główne oddziały i dziedziny/ }));
    rerender(<HospitalAnalysisTab {...baseProps} hospitalKey={altKey} />);
    await waitFor(() => expect(mocks.hospitalAnalysisFromDataset).toHaveBeenCalledWith({}, altKey, "sim"));
    expect(await screen.findByText(/Brak dopasowania do zagregowanego profilu RPWDL/)).toBeInTheDocument();
    expect(screen.queryByText("Testowa 12")).not.toBeInTheDocument();
    rerender(<HospitalAnalysisTab {...baseProps} />);
    await screen.findByText("Strata netto (2024)");
    expect(screen.getByRole("button", { name: /Główne oddziały i dziedziny/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("przelicza analizę po zmianie metody sim na min", async () => {
    const { rerender } = render(<HospitalAnalysisTab {...baseProps} />);
    await screen.findByRole("heading", { name: "Szpital Miejski w Warszawie" });
    rerender(<HospitalAnalysisTab {...baseProps} method="min" />);
    await waitFor(() => expect(mocks.hospitalAnalysisFromDataset).toHaveBeenCalledWith({}, key, "min"));
    const section = screen.getByRole("region", { name: "Najważniejsze informacje o szpitalu" });
    expect(within(section).getByText((8000).toLocaleString("pl-PL"))).toBeInTheDocument();
  });

  it("wywołuje setHospitalKey po wyborze pozycji w filtrze", async () => {
    const setHospitalKey = vi.fn();
    render(<HospitalAnalysisTab {...baseProps} setHospitalKey={setHospitalKey} />);
    await screen.findByRole("option", { name: /Inny Szpital/ });
    fireEvent.change(screen.getByRole("combobox", { name: "Wybierz szpital" }), { target: { value: altKey } });
    expect(setHospitalKey).toHaveBeenCalledWith(altKey);
  });
});
