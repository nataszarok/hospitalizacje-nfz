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
type Trace = { marker: { symbol?: string | string[]; size: number | number[]; color: string | string[] }; hoverinfo?: string; hovertemplate?: string };
type Layout = { annotations: { text: string }[]; shapes: unknown[]; yaxis: { range: number[] } };

async function draw(props: { yCap?: number | null; reference?: { y: number; label: string }; list?: ScatterPoint[]; marker?: "signal" | "graphite" } = {}) {
  render(<ProviderScatter points={props.list ?? points} xTitle="x" yTitle="y" ySuffix="%" ariaLabel="wykres" yCap={props.yCap} reference={props.reference} marker={props.marker} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  await waitFor(() => expect(handlers.plotly_hover?.length).toBe(2));
  const [, traces, layout] = react.mock.calls.at(-1) as unknown as [unknown, Trace[], Layout];
  return { other: traces[0], selected: traces[1], layout };
}
const hover = (curveNumber: number, pointNumber: number) => act(() => { for (const fn of handlers.plotly_hover) fn({ points: [{ curveNumber, pointNumber, x: 0, y: 0 }] }); });

describe("ProviderScatter — wybrany ośrodek", () => {
  it.each([["signal", "#C65D2E"], ["graphite", "#253B3A"]] as const)("znacznik %s to gwiazda w kolorze z DESIGN.md 6.2a, ponad dwa razy większa od punktu, bez podpisu", async (marker, color) => {
    const { other, selected, layout } = await draw({ marker });
    expect(selected.marker).toMatchObject({ symbol: "star", color });
    expect(selected.marker.size).toBeGreaterThanOrEqual(2 * (other.marker.size as number));
    expect(other.marker.symbol).toBeUndefined();
    expect(layout.annotations.map((a) => a.text).join(" ")).not.toContain("CIECHANOWIE");
  });
});

describe("ProviderScatter — skala osi i odniesienie", () => {
  const list: ScatterPoint[] = [
    { key: "a", name: "A", lines: ["", "1 zgon"], x: 1, y: 100 },
    { key: "b", name: "B", lines: [""], x: 300, y: 20 },
  ];

  it("punkt powyżej `yCap` stoi na górnej krawędzi jako trójkąt; oś kończy się na `yCap`", async () => {
    const { other, layout } = await draw({ yCap: 25, list });
    expect((other as unknown as { y: number[] }).y).toEqual([25, 20]);
    // Trójkąt mały i szary, nie w kolorze punktu.
    expect(other.marker.symbol).toEqual(["triangle-up", "circle"]);
    expect(other.marker.size).toEqual([7, 8]);
    expect(other.marker.color).toEqual(["#B9CEC9", "rgba(40, 86, 163, 0.55)"]);
    expect(layout.yaxis.range[1]).toBeLessThan(30);
    // Dymek pokazuje prawdziwą wartość.
    hover(0, 0);
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 zgon");
  });

  it("linii odniesienia na zerze nie ma (pokrywa się z podstawą)", async () => {
    const zero = await draw({ reference: { y: 0, label: "grupa: 0,0%" }, list });
    expect(zero.layout.annotations.map((a) => a.text)).not.toContain("grupa: 0,0%");
    expect(zero.layout.shapes).toHaveLength(2);
    cleanup();
    const some = await draw({ reference: { y: 5, label: "grupa: 5,0%" }, list });
    expect(some.layout.annotations.map((a) => a.text)).toContain("grupa: 5,0%");
    expect(some.layout.shapes).toHaveLength(3);
  });
});

describe("ProviderScatter — dymek HTML", () => {
  it("Plotly nie rysuje dymka; najechanie pokazuje dymek z całą nazwą i liczbami, zjechanie go chowa", async () => {
    const { other, selected } = await draw();
    expect(other.hoverinfo).toBe("none");
    expect(selected.hovertemplate).toBeUndefined();
    hover(1, 0);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(`${name}Ciechanów · OW Mazowieckie200 hosp. · nagłe 80,0%`);
    act(() => { for (const fn of handlers.plotly_unhover) fn(); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dymek stoi obok punktu, poza strefą ochronną (prostokąt punktu z osi wykresu)", async () => {
    await draw();
    hover(0, 0);
    const tooltip = screen.getByRole("tooltip");
    // Punkt (100, 5) → środek 150 × 105 px, znacznik 13 px; dymek po prawej: 150 + 6,5 + 12.
    expect(tooltip.dataset.placement).toBe("right");
    expect(parseFloat(tooltip.style.left)).toBeCloseTo(168.5);
  });
});
