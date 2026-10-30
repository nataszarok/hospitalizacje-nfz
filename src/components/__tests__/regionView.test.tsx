/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Plotly from "plotly.js-dist-min";
import { RegionView } from "@/components/explorer/RegionView";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

vi.mock("plotly.js-dist-min", () => ({ default: { react: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/components/ChartScaleControl", () => ({
  ChartScaleControl: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button onClick={() => onChange(value === "total" ? "per_100k" : "total")}>skala: {value}</button>
  ),
}));
const loadTrends = vi.fn();
const loadStaticDataset = vi.fn();
vi.mock("@/lib/staticData", () => ({ loadTrends: () => loadTrends(), loadStaticDataset: (year: string) => loadStaticDataset(year) }));

const plotlyReact = vi.mocked(Plotly.react);
const lastTrace = () => (plotlyReact.mock.calls.at(-1)?.[1] as { x: number[]; y: string[] }[])[0];

beforeEach(() => {
  loadTrends.mockResolvedValue(trendsFixture);
  loadStaticDataset.mockResolvedValue(latestDatasetFixture);
  plotlyReact.mockClear();
});
afterEach(cleanup);

describe("RegionView", () => {
  it("pokazuje województwa na 100 tys. mieszkańców i średnią dla Polski", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="sim" />);
    expect(await screen.findByRole("heading", { name: "Hospitalizacje w województwach · 2025" })).toBeInTheDocument();
    expect(screen.getByText(/Średnia dla Polski: 0,3\./)).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.firstChild?.textContent)).toEqual(["Śląskie", "Mazowieckie"]);
    expect(loadStaticDataset).toHaveBeenCalledWith("2025");
    // Największa wartość na górze wykresu poziomego (ostatni punkt śladu).
    await waitFor(() => expect(lastTrace().y).toEqual(["Mazowieckie", "Śląskie"]));
  });

  it("przełącza na liczbę ogółem", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    fireEvent.click(await screen.findByRole("button", { name: "skala: per_100k" }));
    expect(screen.getByText(/Liczba ogółem\. Razem: 30\./)).toBeInTheDocument();
    await waitFor(() => expect(lastTrace().x).toEqual([12, 18]));
  });

  it("prosi o wybór produktu i pokazuje błąd pobierania", async () => {
    render(<RegionView productCodes={[]} year="2025" method="min" />);
    expect(screen.getByText("Wybierz co najmniej jeden produkt.")).toBeInTheDocument();
    cleanup();
    loadTrends.mockRejectedValueOnce(new Error("Brak trendów."));
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    expect(await screen.findByText("Brak trendów.")).toBeInTheDocument();
  });
});
