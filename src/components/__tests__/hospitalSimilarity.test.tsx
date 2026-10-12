/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HospitalSimilarityTab } from "@/components/HospitalSimilarityTab";
import { products, sampleBenchmark, samplePair, samplePeer } from "./fixtures/hospitalFixtures";

const mocks = vi.hoisted(() => ({
  loadStaticDataset: vi.fn(),
  hospitalPeerBenchmarkFromDataset: vi.fn(),
  loadJgpValuations: vi.fn(),
  parseMaybeGzip: vi.fn(),
}));

vi.mock("@/lib/staticData", () => ({
  loadStaticDataset: mocks.loadStaticDataset,
  hospitalPeerBenchmarkFromDataset: mocks.hospitalPeerBenchmarkFromDataset,
}));
vi.mock("@/components/HospitalComparisonShared", () => ({
  nf: new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }),
  pf: new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  pct: (x: number) => `${x.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
  displayHospitalName: (x: string) => x,
  loadJgpValuations: mocks.loadJgpValuations,
  parseMaybeGzip: mocks.parseMaybeGzip,
  PeerComparisonCharts: ({ pairMode }: { pairMode?: boolean }) => <div data-testid="peer-charts">{String(pairMode)}</div>,
  JgpMortalityDifferenceTable: ({ pairMode }: { pairMode?: boolean }) => <div data-testid="jgp-table">{String(pairMode)}</div>,
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
const pairA = samplePair();
const pairB = samplePair({ b: "07|3333333333", peer_grade_pred: "B", distance_score: 4 });
const distantPair = samplePair({ b: "07|4444444444", distance_score: 14 });
const foreignPair = samplePair({ a: "01|9999999999", b: "01|8888888888", distance_score: 1 });
const props = { hospitalKey: key, method: "sim" as const, products };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadStaticDataset.mockResolvedValue({});
  mocks.loadJgpValuations.mockResolvedValue([]);
  mocks.parseMaybeGzip.mockImplementation(async (res: { json: () => Promise<unknown> }) => res.json());
  mocks.hospitalPeerBenchmarkFromDataset.mockReturnValue(sampleBenchmark([
    samplePeer(), samplePeer({ key: pairB.b, providerName: "SZPITAL KLASY B", peerGrade: "B" }),
  ]));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ version: 1, grades: [], rows: [pairA, pairB, distantPair, foreignPair] }),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HospitalSimilarityTab — porównanie modelu par", () => {
  it("nie pobiera danych, gdy szpital nie został wskazany", () => {
    render(<HospitalSimilarityTab {...props} hospitalKey="" />);
    expect(screen.getByText(/nie znaleziono par/)).toBeInTheDocument();
    expect(mocks.loadStaticDataset).not.toHaveBeenCalled();
  });

  it("ładuje plik peer_pairs_ab oraz JGP i renderuje porównania", async () => {
    render(<HospitalSimilarityTab {...props} />);
    expect(await screen.findByText(/Jak ten szpital wygląda na tle wybranych peerów/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/data/peer_pairs_ab.json.gz", { cache: "force-cache" });
    expect(mocks.loadJgpValuations).toHaveBeenCalled();
    expect(screen.getByTestId("peer-charts")).toHaveTextContent("true");
    expect(screen.getByTestId("jgp-table")).toHaveTextContent("true");
  });

  it("filtruje klasy A/B, maksymalną odległość i pary spoza wybranego szpitala", async () => {
    render(<HospitalSimilarityTab {...props} gradeScope="A" maxDistance={10} />);
    await waitFor(() => expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalled());
    const args = mocks.hospitalPeerBenchmarkFromDataset.mock.lastCall!;
    expect(args[1]).toBe(key);
    expect(args[2]).toBe("sim");
    expect(args[4]).toBe(70);
    const selection = args[5] as Map<string, unknown>;
    expect([...selection.keys()]).toEqual([pairA.b]);
  });

  it("uwzględnia klasę B po zmianie gradeScope na AB", async () => {
    render(<HospitalSimilarityTab {...props} gradeScope="AB" maxDistance={10} />);
    await waitFor(() => expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalled());
    const selection = mocks.hospitalPeerBenchmarkFromDataset.mock.lastCall![5] as Map<string, unknown>;
    expect([...selection.keys()]).toEqual([pairA.b, pairB.b]);
  });

  it("odwraca strony pary i poprawnie wybiera statystyki min", async () => {
    const { rerender } = render(<HospitalSimilarityTab {...props} hospitalKey={pairA.b} method="min" gradeScope="AB" />);
    await waitFor(() => expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalled());
    const selection = mocks.hospitalPeerBenchmarkFromDataset.mock.lastCall![5] as Map<string, {
      targetHospitalizations: number; peerHospitalizations: number; targetDeaths: number; peerDeaths: number;
    }>;
    expect(selection.get(pairA.a)).toEqual(expect.objectContaining({
      targetHospitalizations: 4800, peerHospitalizations: 8500,
      targetDeaths: 70, peerDeaths: 85,
    }));
    rerender(<HospitalSimilarityTab {...props} hospitalKey={pairA.b} method="sim" gradeScope="AB" />);
    await waitFor(() => expect(mocks.hospitalPeerBenchmarkFromDataset).toHaveBeenCalledWith(
      {}, pairA.b, "sim", {}, 70, expect.any(Map),
    ));
    const updated = mocks.hospitalPeerBenchmarkFromDataset.mock.lastCall![5] as Map<string, {
      targetHospitalizations: number; peerHospitalizations: number;
    }>;
    expect(updated.get(pairA.a)).toEqual(expect.objectContaining({
      targetHospitalizations: 5000, peerHospitalizations: 9000,
    }));
  });

  it("pokazuje brak dopasowania, gdy próg odległości jest zbyt niski", async () => {
    render(<HospitalSimilarityTab {...props} maxDistance={0.1} />);
    expect(await screen.findByText(/nie znaleziono par spełniających/)).toBeInTheDocument();
    expect(mocks.hospitalPeerBenchmarkFromDataset).not.toHaveBeenCalled();
  });

  it("wyświetla błąd pobrania danych bez renderowania benchmarku", async () => {
    mocks.loadStaticDataset.mockRejectedValueOnce(new Error("Nie można załadować datasetu"));
    render(<HospitalSimilarityTab {...props} />);
    expect(await screen.findByText("Nie można załadować datasetu")).toBeInTheDocument();
    expect(screen.queryByTestId("peer-charts")).not.toBeInTheDocument();
  });

  it("wyświetla metodologię i aktualny zakres filtrów w dialogu", async () => {
    render(<HospitalSimilarityTab {...props} gradeScope="AB" maxDistance={5} />);
    await screen.findByText(/Jak ten szpital wygląda na tle wybranych peerów/);
    fireEvent.click(screen.getByRole("button", { name: "Jak wybieramy placówki porównawcze" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("A + B");
    expect(dialog).toHaveTextContent("Maksymalny dystans: 5,0");
    fireEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pokazuje grupę porównawczą po kliknięciu przycisku", async () => {
    render(<HospitalSimilarityTab {...props} />);
    await screen.findByText(/Jak ten szpital wygląda na tle wybranych peerów/);
    fireEvent.click(screen.getByRole("button", { name: /Grupa porównawcza/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("SZPITAL PORÓWNAWCZY");
  });
});
