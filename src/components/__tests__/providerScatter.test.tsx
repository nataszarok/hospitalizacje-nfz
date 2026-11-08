/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { ProviderScatter, type ScatterPoint } from "@/components/jgp/ProviderScatter";

// Po narysowaniu wykres podpina zdarzenia Plotly do elementu: zapamiętujemy obsługę zdarzeń
// i dodajemy osie z `_fullLayout` (piksel = wartość, marginesy 50 i 10).
type Handler = (event?: unknown) => void;
const handlers: Record<string, Handler[]> = {};
const react = vi.fn(async (plot: HTMLElement) => {
  Object.assign(plot, {
    on: (name: string, fn: Handler) => { (handlers[name] ??= []).push(fn); },
    removeAllListeners: (name: string) => { handlers[name] = []; },
    _fullLayout: { _size: { l: 50, t: 10 }, xaxis: { l2p: (v: number) => v }, yaxis: { l2p: (v: number) => 100 - v } },
  });
});
vi.mock("@/lib/plotlyLoader", () => ({
  loadPlotly: async () => ({ react, restyle: vi.fn(() => Promise.resolve()) }),
}));
afterEach(() => { cleanup(); react.mockClear(); for (const key of Object.keys(handlers)) delete handlers[key]; });

const name = "SPECJALISTYCZNY SZPITAL WOJEWÓDZKI W CIECHANOWIE";
const points: ScatterPoint[] = [
  { key: "a", name: "Szpital A", lines: ["Ciechanów · OW Mazowieckie", "100 hosp."], x: 100, y: 5 },
  { key: "b", name, lines: ["Ciechanów · OW Mazowieckie", "200 hosp. · nagłe 80,0%"], x: 200, y: 8, selected: true },
];
type Trace = { marker: { symbol?: string; size: number; color: string }; hoverinfo?: string; hovertemplate?: string };
type Layout = { annotations: { text: string }[] };

async function draw(marker: "signal" | "graphite") {
  render(<ProviderScatter points={points} xTitle="x" yTitle="y" ySuffix="%" ariaLabel="wykres" marker={marker} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  await waitFor(() => expect(handlers.plotly_hover?.length).toBe(2));
  const [, traces, layout] = react.mock.calls.at(-1) as unknown as [unknown, Trace[], Layout];
  return { other: traces[0], selected: traces[1], layout };
}
const hover = (curveNumber: number, pointNumber: number) => act(() => { for (const fn of handlers.plotly_hover) fn({ points: [{ curveNumber, pointNumber, x: 0, y: 0 }] }); });

describe("ProviderScatter — wybrany ośrodek", () => {
  it.each(["signal", "graphite"] as const)("znacznik %s to gwiazda, ponad dwa razy większa od punktu", async (marker) => {
    const { other, selected } = await draw(marker);
    expect(selected.marker.symbol).toBe("star");
    expect(selected.marker.size).toBeGreaterThanOrEqual(2 * other.marker.size);
    expect(other.marker.symbol).toBeUndefined();
  });

  it("długa nazwa w podpisie lejka jest łamana, nie skracana", async () => {
    const { layout } = await draw("graphite");
    expect(layout.annotations.at(-1)!.text).toBe("SPECJALISTYCZNY SZPITAL<br>WOJEWÓDZKI W CIECHANOWIE");
  });
});

describe("ProviderScatter — dymek HTML", () => {
  it("Plotly nie rysuje dymka; najechanie pokazuje dymek z całą nazwą i liczbami, zjechanie go chowa", async () => {
    const { other, selected } = await draw("signal");
    expect(other.hoverinfo).toBe("none");
    expect(selected.hovertemplate).toBeUndefined();
    hover(1, 0);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(`${name}Ciechanów · OW Mazowieckie200 hosp. · nagłe 80,0%`);
    act(() => { for (const fn of handlers.plotly_unhover) fn(); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dymek stoi obok punktu, poza strefą ochronną (prostokąt punktu z osi wykresu)", async () => {
    await draw("signal");
    hover(0, 0);
    const tooltip = screen.getByRole("tooltip");
    // Punkt (100, 5) → środek 150 × 105 px, znacznik 13 px; dymek po prawej: 150 + 6,5 + 12.
    expect(tooltip.dataset.placement).toBe("right");
    expect(parseFloat(tooltip.style.left)).toBeCloseTo(168.5);
  });
});
