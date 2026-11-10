/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MortalityChart } from "@/components/MortalityChart";
import { DEVIATION_COLORS } from "@/lib/chartPalette";
import type { AnalysisArea } from "@/lib/area";
import type { MortalityRow } from "@/lib/types";

const react = vi.fn(async (plot: HTMLElement) => { Object.assign(plot, { on: () => {}, removeAllListeners: () => {} }); });
vi.mock("plotly.js-dist-min", () => ({ default: { react: (...args: unknown[]) => react(...(args as [HTMLElement])), restyle: vi.fn() } }));
afterEach(() => { cleanup(); react.mockClear(); });

const row = (nip: string, hospitalizations: number, deaths: number): MortalityRow => ({
  owNfz: "07", nip, productCode: "P1", providerName: `Szpital ${nip}`, city: "WARSZAWA", voivodeship: "Mazowieckie", population: 1_000_000,
  hospitalizations, deaths, mortalityPct: (deaths / hospitalizations) * 100, hospitalizationsPer100k: hospitalizations / 10,
});
// Średnia: 110 / 1100 = 10%. Szpital „3” ma 30% przy 100 hospitalizacjach: poza granicą 99,8%.
const rows = [row("1", 500, 50), row("2", 500, 30), row("3", 100, 30)];
type Trace = { mode: string; marker?: { color: string | string[] }; line?: { dash?: string } };
type Layout = { shapes: unknown[]; annotations: { text: string }[] };

async function draw(props: { rows?: MortalityRow[]; funnel?: boolean; highlightAreas?: AnalysisArea[] } = {}) {
  render(<MortalityChart rows={props.rows ?? rows} axisMode="total" displayMode="combined" highlightAreas={props.highlightAreas ?? []} products={[]} regions={[]} funnel={props.funnel} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  const [, traces, layout] = react.mock.calls.at(-1) as unknown as [HTMLElement, Trace[], Layout];
  return { traces, layout };
}

describe("MortalityChart — średnia i lejek", () => {
  it("linia średniej z podpisem; bez lejka zwykłe punkty i brak linii granic", async () => {
    const { traces, layout } = await draw();
    expect(layout.annotations.map((a) => a.text)).toEqual(["średnia: 10,0%"]);
    expect(layout.shapes).toHaveLength(3);
    expect(traces.filter((trace) => trace.mode === "lines")).toHaveLength(0);
  });

  it("średnia poniżej 0,5%: bez linii", async () => {
    const { layout } = await draw({ rows: [row("1", 1000, 1), row("2", 1000, 0)] });
    expect(layout.annotations).toHaveLength(0);
    expect(layout.shapes).toHaveLength(2);
  });

  it("lejek: cztery linie granic i punkty w kolorach statusu", async () => {
    const { traces } = await draw({ funnel: true });
    expect(traces.filter((trace) => trace.mode === "lines").map((trace) => trace.line?.dash)).toEqual(["dot", "dot", "dash", "dash"]);
    const points = traces.find((trace) => trace.mode === "markers" && Array.isArray(trace.marker?.color))!;
    expect(points.marker!.color).toContain(DEVIATION_COLORS.up998);
  });

  it("lejek z wyróżnionym obszarem: granice zostają, kolory mają obszary (jak na karcie JGP)", async () => {
    const { traces } = await draw({ funnel: true, highlightAreas: [{ kind: "region", owNfz: "07" }] });
    expect(traces.filter((trace) => trace.mode === "lines")).toHaveLength(4);
    expect(traces.some((trace) => trace.mode === "markers" && Array.isArray(trace.marker?.color))).toBe(false);
  });
});
