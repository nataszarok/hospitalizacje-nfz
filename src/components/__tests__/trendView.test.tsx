/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrendView } from "@/components/trends/TrendView";
import type { ChartLine } from "@/components/jgp/GroupLineChart";
import { regionalTrendsFixtures, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

vi.mock("@mantine/core", () => ({
  SegmentedControl: ({ data, value, onChange, "aria-label": label }: { data: { value: string; label: string }[]; value: string; onChange: (v: string) => void; "aria-label": string }) => (
    <div role="radiogroup" aria-label={label}>
      {data.map((o) => <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  ),
}));

type ChartProps = { months: string[]; lines: ChartLine[]; period: string; legend: boolean; note: string; fitAxis: boolean };
// Wykres z karty grupy JGP: test sprawdza, co do niego trafia (miesiące, serie, okres, objaśnienie).
const chart = vi.fn<(props: ChartProps) => void>();
vi.mock("@/components/jgp/GroupLineChart", () => ({
  GroupLineChart: (props: ChartProps) => {
    chart(props);
    return <div data-testid="chart">{props.period} · {props.lines.map((line) => line.name).join(",")}</div>;
  },
}));
const lastChart = () => chart.mock.calls.at(-1)![0];

const loadTrends = vi.fn();
const loadRegionalTrends = vi.fn<(ow: string) => Promise<unknown>>();
vi.mock("@/lib/staticData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staticData")>()),
  peekTrends: () => null,
  loadTrends: () => loadTrends(),
  loadRegionalTrends: (ow: string) => loadRegionalTrends(ow),
  loadDurationYearsSection: (section: string) => loadDurationYearsSection(section),
}));
// Sekcja A (P1 = A01): 2024 — 4 pobyty 0 dni; 2025 — 3 pobyty 0 dni i 7 pobytów 6+ dni (w tym 2 nagłe).
const loadDurationYearsSection = vi.fn((section: string) => Promise.resolve({
  version: 1, years: ["2023", "2024", "2025"], durations: ["0 dni", "6 i więcej dni"], products: section === "A" ? ["P1"] : [],
  rows: section === "A"
    ? { product: [0, 0, 0], year: [1, 2, 2], ow: ["07", "07", "12"], duration: [0, 0, 1], hMin: [4, 3, 7], hSim: [4, 3, 7], dMin: [0, 0, 1], dSim: [0, 0, 1], uMin: [0, 0, 2], uSim: [0, 0, 2] }
    : { product: [], year: [], ow: [], duration: [], hMin: [], hSim: [], dMin: [], dSim: [], uMin: [], uSim: [] },
}));

beforeEach(() => {
  loadTrends.mockResolvedValue(trendsFixture);
  loadRegionalTrends.mockReset();
  loadRegionalTrends.mockImplementation(async (ow) => regionalTrendsFixtures[ow]);
  chart.mockClear();
});
afterEach(cleanup);

describe("TrendView", () => {
  it("bez obszaru nie pobiera pliku regionalnego", async () => {
    render(<TrendView productCodes={["P1"]} method="min" />);
    await screen.findByTestId("chart");
    expect(loadRegionalTrends).not.toHaveBeenCalled();
  });

  it("dla województwa liczy trend z pliku regionalnego i podpisuje obszar", async () => {
    render(<TrendView productCodes={["P1"]} method="min" regions={["12"]} areaLabel="woj. śląskie" areaNote="Uwaga o mieście." />);
    expect(await screen.findByText(/Wszystkie wybrane grupy razem · woj\. śląskie\./)).toBeInTheDocument();
    expect(screen.getByText("Uwaga o mieście.")).toBeInTheDocument();
    expect(loadRegionalTrends).toHaveBeenCalledTimes(1);
    expect(loadRegionalTrends).toHaveBeenCalledWith("12");
    const rows = screen.getAllByRole("row").slice(1).map((row) => row.firstChild?.nextSibling?.textContent);
    expect(rows).toEqual(["0", "5", "0"]);
  });

  it("po zmianie województwa pobiera plik nowego OW", async () => {
    const { rerender } = render(<TrendView productCodes={["P1"]} method="min" regions={["12"]} areaLabel="woj. śląskie" />);
    await screen.findByText(/woj\. śląskie\./);
    rerender(<TrendView productCodes={["P1"]} method="min" regions={["07"]} areaLabel="woj. mazowieckie" />);
    await screen.findByText(/woj\. mazowieckie\./);
    expect(loadRegionalTrends.mock.calls.map(([ow]) => ow)).toEqual(["12", "07"]);
    const rows = screen.getAllByRole("row").slice(1).map((row) => row.firstChild?.nextSibling?.textContent);
    expect(rows).toEqual(["8", "3", "9"]);
  });

  it("rysuje wykres z karty grupy JGP: miesiące lat z danymi, seria hospitalizacji i objaśnienie średniej 3M", async () => {
    render(<TrendView productCodes={["P1"]} method="min" />);
    await screen.findByTestId("chart");
    const props = lastChart();
    // Ostatni rok danych ma tylko miesiące z pliku (w danych testowych do marca).
    expect(props.months).toHaveLength(12 + 12 + 3);
    expect(props.months.slice(0, 2)).toEqual(["2023-01", "2023-02"]);
    expect(props.months.at(-1)).toBe("2025-03");
    expect(props.lines).toEqual([expect.objectContaining({ key: "all", tone: "primary", values: expect.arrayContaining([8]) })]);
    expect(props.lines[0].base).toBeUndefined();
    expect(props.note).toMatch(/linia = średnia z 3 miesięcy/);
    expect(screen.getByRole("heading", { name: "Hospitalizacje miesięcznie · 2023–2025" })).toBeInTheDocument();
  });

  it("miara to zakładki: śmiertelność i udział nagłych jako udział (mianownik = hospitalizacje)", async () => {
    render(<TrendView productCodes={["P1"]} method="min" />);
    await screen.findByTestId("chart");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Hospitalizacje", "Śmiertelność", "Udział przyjęć nagłych"]);
    fireEvent.click(screen.getByRole("tab", { name: "Udział przyjęć nagłych" }));
    expect(screen.getByRole("tab", { name: "Udział przyjęć nagłych" })).toHaveAttribute("aria-selected", "true");
    const props = lastChart();
    expect(props.lines[0].base).toEqual(expect.arrayContaining([8]));
    expect(props.fitAxis).toBe(true);
    expect(props.note).toMatch(/Przyjęcia nagłe/);
  });

  it("przełącza miesiące i lata nad wykresem", async () => {
    render(<TrendView productCodes={["P1"]} method="min" />);
    await screen.findByTestId("chart");
    fireEvent.click(screen.getByRole("button", { name: "Lata" }));
    expect(screen.getByRole("button", { name: "Lata" })).toHaveAttribute("aria-pressed", "true");
    expect(lastChart().period).toBe("year");
    expect(screen.getByRole("heading", { name: /Hospitalizacje rocznie/ })).toBeInTheDocument();
  });

  it("„Per JGP” rysuje osobną serię dla każdej grupy z legendą i kolorem", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TrendView productCodes={["P1", "P2"]} method="min" displayMode="combined" onDisplayModeChange={onChange} />);
    await screen.findByText(/Wszystkie wybrane grupy razem/);
    fireEvent.click(screen.getByRole("radio", { name: "Per JGP" }));
    expect(onChange).toHaveBeenCalledWith("per_jgp");
    rerender(<TrendView productCodes={["P1", "P2"]} method="min" displayMode="per_jgp" onDisplayModeChange={onChange} />);
    expect(await screen.findByText(/Każda grupa JGP osobno/)).toBeInTheDocument();
    const props = lastChart();
    expect(props.lines.map((line) => line.name)).toEqual(["A01", "F04"]);
    expect(props.lines.map((line) => line.color)).toEqual(["#2856A3", "#7B3FA0"]);
    expect(props.legend).toBe(true);
  });

  it("bez przełącznika albo przy jednej grupie nie pokazuje „Zestawienie JGP”", async () => {
    const { rerender } = render(<TrendView productCodes={["P1", "P2"]} method="min" />);
    await screen.findByText(/Wszystkie wybrane grupy razem/);
    expect(screen.queryByRole("radiogroup", { name: "Zestawienie JGP" })).not.toBeInTheDocument();
    rerender(<TrendView productCodes={["P1"]} method="min" displayMode="per_jgp" onDisplayModeChange={vi.fn()} />);
    expect(screen.queryByRole("radiogroup", { name: "Zestawienie JGP" })).not.toBeInTheDocument();
    expect(screen.getByText(/Wszystkie wybrane grupy razem/)).toBeInTheDocument();
  });

  it("ostrzega o zmianie katalogu JGP", async () => {
    render(<TrendView productCodes={["P1", "P3"]} method="sim" />);
    expect(await screen.findByRole("list", { name: "Zmiany katalogu JGP" })).toHaveTextContent("Grupa F99 występuje w danych tylko w latach: 2025");
  });

  it("w tabeli oznacza lata, w których wybranej grupy nie ma w katalogu", async () => {
    render(<TrendView productCodes={["P3"]} method="sim" />);
    expect(await screen.findAllByText("brak wybranych grup w katalogu JGP")).toHaveLength(2);
    expect(lastChart().months[0]).toBe("2025-01");
  });

  it("prosi o wybór grupy, gdy lista jest pusta", () => {
    render(<TrendView productCodes={[]} method="min" />);
    expect(screen.getByText("Wybierz co najmniej jedną grupę JGP.")).toBeInTheDocument();
  });

  it("pokazuje błąd pobierania", async () => {
    loadTrends.mockRejectedValueOnce(new Error("Brak pliku trendów."));
    render(<TrendView productCodes={["P1"]} method="min" />);
    expect(await screen.findByText("Brak pliku trendów.")).toBeInTheDocument();
  });
  it("kilka województw: pobiera pliki każdego i sumuje", async () => {
    render(<TrendView productCodes={["P1"]} method="min" regions={["07", "12"]} areaLabel="2 województwa" />);
    await screen.findByText(/2 województwa/);
    expect(loadRegionalTrends.mock.calls.map(([ow]) => ow)).toEqual(["07", "12"]);
    const rows = screen.getAllByRole("row").slice(1).map((row) => row.firstChild?.nextSibling?.textContent);
    expect(rows).toEqual(["8", "8", "9"]);
  });

  it("filtr długości pobytu: tylko lata z pliku długości pobytu, przełącznik miesięcy wyłączony", async () => {
    render(<TrendView productCodes={["P1"]} method="min" durations={["6 i więcej dni"]} />);
    expect(await screen.findByText(/długość pobytu: 6 i więcej dni/)).toBeInTheDocument();
    expect(loadDurationYearsSection).toHaveBeenCalledWith("A");
    expect(lastChart().period).toBe("year");
    expect(screen.getByRole("button", { name: "Miesiące" })).toBeDisabled();
    // Rok 2024: grupa w danych, ale bez pobytów 6+ dni → 0; 2025: 7.
    const rows = screen.getAllByRole("row").slice(1).map((row) => row.firstChild?.nextSibling?.textContent);
    expect(rows).toEqual([undefined, "0", "7"].map((value) => value ?? expect.anything()));
    expect(lastChart().lines[0].values.slice(-12).reduce((sum, value) => sum + value, 0)).toBeCloseTo(7);
  });
});
