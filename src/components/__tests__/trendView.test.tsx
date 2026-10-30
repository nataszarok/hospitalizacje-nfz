/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Plotly from "plotly.js-dist-min";
import { TrendView } from "@/components/trends/TrendView";
import { regionalTrendsFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

vi.mock("plotly.js-dist-min", () => ({ default: { react: vi.fn().mockResolvedValue(undefined) } }));
const plotlyReact = vi.mocked(Plotly.react);
const lastTraces = () => (plotlyReact.mock.calls.at(-1)?.[1] ?? []) as { name: string; type: string }[];

vi.mock("@mantine/core", () => ({
  SegmentedControl: ({ data, value, onChange, "aria-label": label }: { data: { value: string; label: string }[]; value: string; onChange: (v: string) => void; "aria-label": string }) => (
    <div role="radiogroup" aria-label={label}>
      {data.map((o) => <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  ),
}));

const loadTrends = vi.fn();
const loadRegionalTrends = vi.fn();
vi.mock("@/lib/staticData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staticData")>()),
  loadTrends: () => loadTrends(),
  loadRegionalTrends: () => loadRegionalTrends(),
}));

beforeEach(() => {
  loadTrends.mockResolvedValue(trendsFixture);
  loadRegionalTrends.mockReset();
  loadRegionalTrends.mockResolvedValue(regionalTrendsFixture);
  plotlyReact.mockClear();
});
afterEach(cleanup);

describe("TrendView", () => {
  it("bez obszaru nie pobiera pliku regionalnego", async () => {
    render(<TrendView productCodes={["P1"]} method="min" />);
    await screen.findByText("Hospitalizacje 2025");
    expect(loadRegionalTrends).not.toHaveBeenCalled();
  });

  it("dla województwa liczy trend z pliku regionalnego i podpisuje obszar", async () => {
    render(<TrendView productCodes={["P1"]} method="min" region="12" areaLabel="woj. śląskie" areaNote="Uwaga o mieście." />);
    expect(await screen.findByText(/Wszystkie wybrane produkty razem · woj\. śląskie\./)).toBeInTheDocument();
    expect(screen.getByText("Uwaga o mieście.")).toBeInTheDocument();
    expect(loadRegionalTrends).toHaveBeenCalledTimes(1);
    const rows = screen.getAllByRole("row").slice(1).map((row) => row.firstChild?.nextSibling?.textContent);
    expect(rows).toEqual(["0", "5", "0"]);
  });

  it("pokazuje podsumowanie najnowszego roku i tabelę lat", async () => {
    render(<TrendView productCodes={["P1"]} method="sim" />);
    expect(await screen.findByText("Hospitalizacje 2025")).toBeInTheDocument();
    expect(screen.getByText("+33,3%")).toBeInTheDocument();
    expect(screen.getByText("względem 2024")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hospitalizacje w latach 2023–2025" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(rows).toEqual(["20231011100,0%100", "2024922,2%06", "2025120120"].map((r) => expect.stringContaining(r.slice(0, 4))));
  });

  it("ostrzega o zmianie katalogu JGP i nie liczy mylącej zmiany r/r", async () => {
    render(<TrendView productCodes={["P1", "P3"]} method="sim" />);
    expect(await screen.findByRole("list", { name: "Zmiany katalogu JGP" })).toHaveTextContent("Grupa F99 występuje w danych tylko w latach: 2025");
    expect(screen.getByText("inny zestaw grup JGP w porównywanych latach")).toBeInTheDocument();
  });

  it("w tabeli oznacza lata, w których wybranej grupy nie ma w katalogu", async () => {
    render(<TrendView productCodes={["P3"]} method="sim" />);
    expect(await screen.findAllByText("brak wybranych grup w katalogu JGP")).toHaveLength(2);
    expect(screen.getByText("brak roku do porównania")).toBeInTheDocument();
  });

  it("rysuje wykres i przełącza na słupki roczne z trybem przyjęcia", async () => {
    render(<TrendView productCodes={["P1"]} method="min" />);
    await screen.findByText("Hospitalizacje 2025");
    await waitFor(() => expect(plotlyReact).toHaveBeenCalled());
    expect(lastTraces()[0]).toMatchObject({ type: "scatter", name: "Hospitalizacje" });

    fireEvent.click(screen.getByRole("radio", { name: "Lata" }));
    fireEvent.click(screen.getByRole("radio", { name: "Tryb przyjęcia" }));
    await waitFor(() => expect(lastTraces().map((t) => t.name)).toEqual(["Planowe", "Nagłe", "Pozostałe"]));
    expect(lastTraces()[0]).toMatchObject({ type: "bar", x: ["2023", "2024", "2025"], y: [8, 0, 9] });
  });

  it("prosi o wybór produktu, gdy lista jest pusta", () => {
    render(<TrendView productCodes={[]} method="min" />);
    expect(screen.getByText("Wybierz co najmniej jeden produkt.")).toBeInTheDocument();
  });

  it("pokazuje błąd pobierania", async () => {
    loadTrends.mockRejectedValueOnce(new Error("Brak pliku trendów."));
    render(<TrendView productCodes={["P1"]} method="min" />);
    expect(await screen.findByText("Brak pliku trendów.")).toBeInTheDocument();
  });
});
