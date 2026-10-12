/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HospitalComparisonLegacyTab } from "@/components/HospitalComparisonLegacyTab";
import { products, sampleBenchmark } from "./fixtures/hospitalFixtures";

const mocks = vi.hoisted(() => ({
  loadStaticDataset: vi.fn(), hospitalPeerBenchmarkFromDataset: vi.fn(),
  loadJgpValuations: vi.fn(), parseMaybeGzip: vi.fn(),
}));
vi.mock("@/lib/staticData", () => ({
  loadStaticDataset: mocks.loadStaticDataset,
  hospitalPeerBenchmarkFromDataset: mocks.hospitalPeerBenchmarkFromDataset,
}));
vi.mock("@/components/HospitalComparisonShared", () => ({
  nf: new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }),
  pf: new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  pct: (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
  displayHospitalName: (name: string) => name,
  loadJgpValuations: mocks.loadJgpValuations,
  parseMaybeGzip: mocks.parseMaybeGzip,
  PeerComparisonCharts: () => <div data-testid="legacy-charts" />,
  JgpMortalityDifferenceTable: () => <div data-testid="legacy-jgp" />,
}));
vi.mock("@mantine/core", () => ({
  ActionIcon: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    const domProps = { ...props };
    for (const key of ["variant", "color", "size", "radius"]) {
      delete domProps[key];
    }
    return <button type="button" {...domProps}>{children}</button>;
  },
}));

const key = "07|1234567890";
const props = { hospitalKey: key, method: "sim" as const, products, peerThreshold: 75 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadStaticDataset.mockResolvedValue({});
  mocks.loadJgpValuations.mockResolvedValue([]);
  mocks.hospitalPeerBenchmarkFromDataset.mockReturnValue(sampleBenchmark());
  mocks.parseMaybeGzip.mockImplementation(async (res: { json: () => Promise<unknown> }) => res.json());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ po_nip: { "07|1234567890": { wards: [] } } }),
  }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("HospitalComparisonLegacyTab — stara metoda porównawcza", () => {
  it("nie rozpoczyna ładowania bez wybranego szpitala", () => {
    render(<HospitalComparisonLegacyTab {...props} hospitalKey="" />);
    expect(screen.getByText(/Brak placówek spełniających/)).toBeInTheDocument();
    expect(mocks.loadStaticDataset).not.toHaveBeenCalled();
  });

  it("pobiera RPWDL i przekazuje go do funkcji benchmarku", async () => {
    render(<HospitalComparisonLegacyTab {...props} />);
    await screen.findByText(/Jak ten szpital wygląda na tle swoich peerów/);
    expect(fetch).toHaveBeenCalledWith("/data/rpwdl_profile.json.gz", { cache: "force-cache" });
    expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalledWith(
      {}, key, "sim", { "07|1234567890": { wards: [] } }, 75,
    );
    expect(screen.getByTestId("legacy-charts")).toBeInTheDocument();
    expect(screen.getByTestId("legacy-jgp")).toBeInTheDocument();
  });

  it("przelicza benchmark po zmianie progu i metody", async () => {
    const { rerender } = render(<HospitalComparisonLegacyTab {...props} />);
    await waitFor(() => expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalled());
    rerender(<HospitalComparisonLegacyTab {...props} method="min" peerThreshold={90} />);
    await waitFor(() => expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalledWith(
      {}, key, "min", expect.any(Object), 90,
    ));
  });

  it("informuje o braku podobnych szpitali", async () => {
    mocks.hospitalPeerBenchmarkFromDataset.mockReturnValueOnce(sampleBenchmark([]));
    render(<HospitalComparisonLegacyTab {...props} />);
    expect(await screen.findByText(/Brak placówek spełniających aktualny próg/)).toBeInTheDocument();
  });

  it("pokazuje błąd, gdy dataset nie został wczytany", async () => {
    mocks.loadStaticDataset.mockRejectedValueOnce(new Error("Dane źródłowe niedostępne"));
    render(<HospitalComparisonLegacyTab {...props} />);
    expect(await screen.findByText("Dane źródłowe niedostępne")).toBeInTheDocument();
  });

  it("otwiera i zamyka metodologię porównania", async () => {
    render(<HospitalComparisonLegacyTab {...props} />);
    await screen.findByText(/Jak ten szpital wygląda na tle swoich peerów/);
    fireEvent.click(screen.getByRole("button", { name: "Metodologia grupy porównawczej" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Jak wyznaczamy grupę porównawczą?");
    fireEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
