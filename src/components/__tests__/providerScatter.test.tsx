/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { DENSE_POINTS, ProviderScatter, type ScatterPoint } from "@/components/jgp/ProviderScatter";

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
type Trace = { marker: { symbol?: string | string[]; size: number | number[]; color: string | string[]; opacity?: number; line?: { width: number } }; hoverinfo?: string; hovertemplate?: string };
type Layout = { annotations: { text: string }[]; shapes: unknown[]; yaxis: { range: number[] } };

async function draw(props: { yCap?: number | null; reference?: { y: number; label: string }; list?: ScatterPoint[] } = {}) {
  render(<ProviderScatter points={props.list ?? points} xTitle="x" yTitle="y" ySuffix="%" ariaLabel="wykres" yCap={props.yCap} reference={props.reference} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  await waitFor(() => expect(handlers.plotly_hover?.length).toBe(2));
  const [, traces, layout] = react.mock.calls.at(-1) as unknown as [unknown, Trace[], Layout];
  return { other: traces[0], selected: traces[1], layout };
}
const hover = (curveNumber: number, pointNumber: number) => act(() => { for (const fn of handlers.plotly_hover) fn({ points: [{ curveNumber, pointNumber, x: 0, y: 0 }] }); });

describe("ProviderScatter — wybrany ośrodek", () => {
  it("znacznik to gwiazda w kolorze sygnału, ponad dwa razy większa od punktu, bez podpisu", async () => {
    const { other, selected, layout } = await draw();
    expect(selected.marker).toMatchObject({ symbol: "star", color: "#C65D2E" });
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
    // Trójkąt szary, tej samej wysokości co kropka obok (Plotly rysuje trójkąt niższy od koła o tym samym `size`).
    expect(other.marker.symbol).toEqual(["triangle-up", "circle"]);
    expect(other.marker.size).toEqual([11, 8]);
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

describe("ProviderScatter — gęsty wykres", () => {
  it("mało punktów: biała obwódka; od `DENSE_POINTS` punktów delikatna obwódka (bez białych plam), półprzezroczyste", async () => {
    const sparse = await draw();
    expect(sparse.other.marker.line?.width).toBe(1);
    cleanup();
    const many: ScatterPoint[] = Array.from({ length: DENSE_POINTS }, (_, i) => ({ key: `k${i}`, name: `S${i}`, lines: [""], x: i, y: 0 }));
    const dense = await draw({ list: [...many, points[1]] });
    expect(dense.other.marker.line?.width).toBeLessThan(1);
    expect(dense.other.marker.line?.width).toBeGreaterThan(0);
    expect(dense.other.marker.opacity).toBeLessThan(1);
    // Gwiazda wybranego ośrodka zostaje z obwódką.
    expect(dense.selected.marker.symbol).toBe("star");
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
