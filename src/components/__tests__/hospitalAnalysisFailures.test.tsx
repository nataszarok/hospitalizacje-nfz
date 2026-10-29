/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HospitalAnalysisTab } from "@/components/HospitalAnalysisTab";
import { products, sampleAnalysis } from "./fixtures/hospitalFixtures";

const mocks = vi.hoisted(() => ({
  loadStaticDataset: vi.fn(), hospitalDirectoryFromDataset: vi.fn(), hospitalAnalysisFromDataset: vi.fn(),
}));
vi.mock("@/lib/staticData", () => ({
  loadStaticDataset: mocks.loadStaticDataset,
  hospitalDirectoryFromDataset: mocks.hospitalDirectoryFromDataset,
  hospitalAnalysisFromDataset: mocks.hospitalAnalysisFromDataset,
}));
vi.mock("@mantine/core", () => ({
  Select: () => <span data-testid="mock-select" />,
  SegmentedControl: () => <span data-testid="mock-segmented" />,
}));
vi.mock("plotly.js-dist-min", () => ({
  default: { react: vi.fn().mockResolvedValue(undefined), restyle: vi.fn().mockResolvedValue(undefined), purge: vi.fn() },
}));

const props = {
  hospitalKey: "07|1234567890", setHospitalKey: vi.fn(), hospitalSubtab: "summary" as const,
  setHospitalSubtab: vi.fn(), peerThreshold: 75, setPeerThreshold: vi.fn(), method: "sim" as const, products,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadStaticDataset.mockResolvedValue({});
  mocks.hospitalDirectoryFromDataset.mockReturnValue([]);
  mocks.hospitalAnalysisFromDataset.mockReturnValue(sampleAnalysis());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("HospitalAnalysisTab — obsługa błędów", () => {
  it("zachowuje podstawowy profil przy błędach HTTP 404 danych RPWDL i finansów", async () => {
    render(<HospitalAnalysisTab {...props} />);
    expect(await screen.findByText(/Dane podstawowe działają\. Nie udało się załadować/)).toBeInTheDocument();
    expect(screen.getByText(/zagregowany profil RPWDL: Nie udało się pobrać danych \(404\)/)).toBeInTheDocument();
    expect(screen.getByText(/wyniki finansowe: Nie udało się pobrać danych \(404\)/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Szpital Miejski w Warszawie" })).toBeInTheDocument();
    expect(screen.getByText(/Brak dopasowania do zagregowanego profilu RPWDL/)).toBeInTheDocument();
    expect(screen.getByText("Brak danych finansowych")).toBeInTheDocument();
  });

  it("pokazuje błąd głównego datasetu bez prób renderowania analizy", async () => {
    mocks.loadStaticDataset.mockRejectedValue(new Error("Dataset jest niedostępny"));
    render(<HospitalAnalysisTab {...props} />);
    expect(await screen.findByText("Dataset jest niedostępny")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Szpital Miejski w Warszawie" })).not.toBeInTheDocument();
  });
});
