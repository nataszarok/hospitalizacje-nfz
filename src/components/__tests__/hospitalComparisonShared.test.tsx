/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Plotly from "plotly.js-dist-min";
import {
  JgpMortalityDifferenceTable, PeerComparisonCharts, displayHospitalName, loadJgpValuations, parseMaybeGzip,
} from "@/components/HospitalComparisonShared";
import type { HospitalPeerBenchmark } from "@/lib/types";
import { products, sampleBenchmark } from "./fixtures/hospitalFixtures";

vi.mock("plotly.js-dist-min", () => ({
  default: { react: vi.fn().mockResolvedValue(undefined), restyle: vi.fn().mockResolvedValue(undefined), purge: vi.fn() },
}));

const rawResponse = (data: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer } as Response;
};

const withOutliers = (): HospitalPeerBenchmark => ({
  ...sampleBenchmark(),
  mortalityOutliers: [
    { productCode: "P1", jgpCode: "A01", name: "Diagnostyka", targetHospitalizations: 120,
      targetDeaths: 6, targetMortalityPct: 5, peerHospitalizations: 200, peerDeaths: 2,
      peerHospitals: 3, peerMortalityPct: 1, expectedDeaths: 1.2, excessDeaths: 4.8 },
    { productCode: "P2", jgpCode: "B02", name: "Zabieg", targetHospitalizations: 90,
      targetDeaths: 2, targetMortalityPct: 2, peerHospitalizations: 150, peerDeaths: 2,
      peerHospitals: 2, peerMortalityPct: 1.5, expectedDeaths: 1.35, excessDeaths: 0.65 },
    { productCode: "PX", jgpCode: "X01", name: "Poniżej limitu", targetHospitalizations: 10,
      targetDeaths: 3, targetMortalityPct: 30, peerHospitalizations: 200, peerDeaths: 2,
      peerHospitals: 3, peerMortalityPct: 1, expectedDeaths: 0.1, excessDeaths: 2.9 },
    { productCode: "PY", jgpCode: "Y01", name: "Jeden peer", targetHospitalizations: 100,
      targetDeaths: 3, targetMortalityPct: 3, peerHospitalizations: 100, peerDeaths: 1,
      peerHospitals: 1, peerMortalityPct: 1, expectedDeaths: 1, excessDeaths: 2 },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(rawResponse({
    jgp: [{ kod_jgp: "A01", kod_produktu: "P1", nazwa: "Diagnostyka",
      pkt_hospitalizacja: 100, pkt_hospitalizacja_planowa: null,
      pkt_jeden_dzien: null, pkt_hospitalizacja_1_dniowa: null, pkt_hospitalizacja_2_dniowa: null }],
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("HospitalComparisonShared — nazwy i pobieranie danych", () => {
  it("normalizuje nazwy zapisane wielkimi literami, zachowując skróty", () => {
    expect(displayHospitalName("  SZPITAL   WOJEWÓDZKI  W  WARSZAWIE  ")).toBe("Szpital Wojewódzki w Warszawie");
    expect(displayHospitalName("SPZOZ W RADOMIU")).toBe("SPZOZ w Radomiu");
    expect(displayHospitalName("Szpital Miejski")).toBe("Szpital Miejski");
  });

  it("czyta niezgnieciony JSON także z pliku o rozszerzeniu .gz", async () => {
    await expect(parseMaybeGzip(rawResponse({ version: 3, records: [{ nip: "123" }] })))
      .resolves.toEqual({ version: 3, records: [{ nip: "123" }] });
  });

  it("rzuca czytelny błąd HTTP 404 zamiast próbować parsować odpowiedź", async () => {
    await expect(parseMaybeGzip({ ok: false, status: 404 } as Response))
      .rejects.toThrow("Nie udało się pobrać danych (404)");
  });

  it("pobiera wyceny JGP i udostępnia listę rekordów", async () => {
    const result = await loadJgpValuations();
    expect(result[0]).toEqual(expect.objectContaining({ kod_jgp: "A01", pkt_hospitalizacja: 100 }));
    expect(fetch).toHaveBeenCalledWith("/data/wyceny_jgp_2025.json.gz", { cache: "force-cache" });
  });
});

describe("JgpMortalityDifferenceTable — odchylenia JGP", () => {
  it("pokazuje informację o braku danych przy pustej liście", () => {
    render(<JgpMortalityDifferenceTable benchmark={sampleBenchmark()} products={products} valuationByJgp={new Map()} />);
    expect(screen.getByText(/Brak JGP spełniających aktualne kryteria/)).toBeInTheDocument();
  });

  it("odrzuca JGP z <= 10 hospitalizacjami i te z mniej niż dwoma peerami", () => {
    render(<JgpMortalityDifferenceTable benchmark={withOutliers()} products={products} valuationByJgp={new Map()} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3); // nagłówek + 2 JGP
    expect(within(table).getByText("A01")).toBeInTheDocument();
    expect(within(table).getByText("B02")).toBeInTheDocument();
    expect(within(table).queryByText("X01")).not.toBeInTheDocument();
    expect(within(table).queryByText("Y01")).not.toBeInTheDocument();
  });

  it("sortuje odchylenia według nadmiaru zgonów i przełącza kierunek sortowania", () => {
    render(<JgpMortalityDifferenceTable benchmark={withOutliers()} products={products} valuationByJgp={new Map()} />);
    const table = screen.getByRole("table");
    const order = () => within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(order()).toEqual(["A01", "B02"]);
    const header = within(table).getByRole("button", { name: /Nadmiar/ });
    fireEvent.click(header);
    expect(order()).toEqual(["B02", "A01"]);
    expect(header.closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("filtruje JGP po dużych różnicach śmiertelności i zmienia aria-pressed", () => {
    render(<JgpMortalityDifferenceTable benchmark={withOutliers()} products={products} valuationByJgp={new Map()} />);
    const chip = screen.getByRole("button", { name: "Duże różnice" });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("A01")).toBeInTheDocument();
    expect(screen.queryByText("B02")).not.toBeInTheDocument();
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("B02")).toBeInTheDocument();
  });

  it("pokazuje wycenę JGP, a dla brakujących wycen myślnik", () => {
    render(<JgpMortalityDifferenceTable benchmark={withOutliers()} products={products}
      valuationByJgp={new Map([["A01", { kod_jgp: "A01", kod_produktu: "P1", nazwa: "Diagnostyka",
        pkt_hospitalizacja: 123.5, pkt_hospitalizacja_planowa: null, pkt_jeden_dzien: null,
        pkt_hospitalizacja_1_dniowa: null, pkt_hospitalizacja_2_dniowa: null }]])} />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("123,5 pkt");
    expect(rows[1].querySelector("td:last-child")).toHaveTextContent("—");
  });

  it("otwiera szczegóły JGP po kliknięciu wiersza i pozwala je zamknąć", () => {
    render(<JgpMortalityDifferenceTable benchmark={withOutliers()} products={products} valuationByJgp={new Map()} />);
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByText("A01").closest("tr")!);
    expect(screen.getByRole("dialog")).toHaveTextContent("A01");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});


describe("PeerComparisonCharts — wykresy porównawcze", () => {
  it("rysuje mapę peerów i wykres nadmiaru zgonów", async () => {
    const onHoverPeer = vi.fn();
    render(<PeerComparisonCharts benchmark={sampleBenchmark()} hoveredPeerKey={null}
      onHoverPeer={onHoverPeer} products={products} valuationByJgp={new Map()} />);
    expect(screen.getByText("Realna skala struktury vs zakres leczenia")).toBeInTheDocument();
    await waitFor(() => expect(Plotly.react).toHaveBeenCalledTimes(2));
    const traces = vi.mocked(Plotly.react).mock.calls[0][1] as Array<{ name: string; x: number[] }>;
    expect(traces[0].name).toBe("Peery");
    expect(traces[0].x).toEqual([100]);
    expect(traces[2].name).toBe("Wybrany szpital");
    expect(traces[2].x).toEqual([200]);
  });

  it("nie pokazuje wykresu nadmiaru zgonów, jeśli nie ma peerów", async () => {
    render(<PeerComparisonCharts benchmark={sampleBenchmark([])} hoveredPeerKey={null}
      onHoverPeer={vi.fn()} products={products} valuationByJgp={new Map()} />);
    expect(screen.queryByText("Gdzie występuje największa różnica liczby zgonów?")).not.toBeInTheDocument();
    await waitFor(() => expect(Plotly.react).toHaveBeenCalledTimes(1));
  });

  it("wyłącza standardowy hover Plotly w trybie modelu par", async () => {
    render(<PeerComparisonCharts benchmark={sampleBenchmark()} hoveredPeerKey={null}
      onHoverPeer={vi.fn()} products={products} valuationByJgp={new Map()} pairMode hospitalKey="07|1234567890" />);
    await waitFor(() => expect(Plotly.react).toHaveBeenCalledTimes(2));
    const traces = vi.mocked(Plotly.react).mock.calls[0][1] as Array<{ hoverinfo?: string }>;
    expect(traces[0].hoverinfo).toBe("skip");
    expect(traces[2].hoverinfo).toBe("skip");
  });
});
