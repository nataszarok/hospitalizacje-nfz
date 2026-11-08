/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { GroupLineChart } from "@/components/jgp/GroupLineChart";

// Po narysowaniu wykres podpina zdarzenia Plotly do elementu: dodajemy puste metody.
const react = vi.fn(async (plot: HTMLElement) => { Object.assign(plot, { on: vi.fn(), removeAllListeners: vi.fn() }); });
vi.mock("@/lib/plotlyLoader", () => ({
  loadPlotly: async () => ({ react, restyle: vi.fn() }),
}));
afterEach(() => { cleanup(); react.mockClear(); });

// Trzy miesiące 2023 (rok niepełny) i dwanaście 2024.
const months = ["2023-10", "2023-11", "2023-12", ...Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, "0")}`)];
const values = months.map((_, i) => i + 1);
type Trace = { mode: string; x: string[]; y: (number | null)[]; customdata: string[][]; hovertemplate: string };
type Layout = { height: number; xaxis: { ticklabelmode?: string; range?: string[] } };

async function draw(period?: "month" | "year", base?: number[]) {
  render(<GroupLineChart months={months} lines={[{ key: "pl", name: "Polska", values, base }]} valueLabel="hosp." ariaLabel="wykres" height={300} period={period} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  const [, traces, layout] = react.mock.calls.at(-1) as unknown as [unknown, Trace[], Layout];
  return { markers: traces[0], line: traces[1], layout };
}

describe("GroupLineChart — okres", () => {
  it("domyślnie miesiące: kropka na miesiąc i linia średniej 3M", async () => {
    const { markers, line } = await draw();
    expect(markers.x).toHaveLength(15);
    expect(line.y[2]).toBe(2);
    expect(markers.hovertemplate).toContain("średnia 3M");
  });

  it("lata: suma roku w połowie roku, ta sama wysokość, bez średniej 3M, rok niepełny z liczbą miesięcy", async () => {
    const { markers, line, layout } = await draw("year");
    expect(markers.x).toEqual(["2023-07-01", "2024-07-01"]);
    expect(markers.y).toEqual([6, 114]);
    expect(line.y).toEqual([6, 114]);
    expect(markers.hovertemplate).not.toContain("średnia 3M");
    expect(markers.customdata.map((row) => row[0])).toEqual(["2023 (3 mies.)", "2024"]);
    expect(layout.height).toBe(300);
    expect(layout.xaxis).toMatchObject({ ticklabelmode: "period", range: ["2023-01-01", "2024-12-31"] });
  });

  it("lata dla udziału: procent z sum roku, nie średnia procentów miesięcy", async () => {
    const base = months.map(() => 10);
    const { markers } = await draw("year", base);
    // 2023: 6 / 30; 2024: 114 / 120.
    expect(markers.y).toEqual([20, 95]);
  });
});
