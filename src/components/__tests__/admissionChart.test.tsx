/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { AdmissionChart } from "@/components/AdmissionChart";
import type { AdmissionRow } from "@/lib/types";

const react = vi.fn(async (plot: HTMLElement) => { Object.assign(plot, { on: () => {}, removeAllListeners: () => {} }); });
vi.mock("plotly.js-dist-min", () => ({ default: { react: (...args: unknown[]) => react(...(args as [HTMLElement])), restyle: vi.fn() } }));
afterEach(() => { cleanup(); react.mockClear(); });

const row = (nip: string, hospitalizations: number, urgent: number): AdmissionRow => ({
  owNfz: "07", nip, productCode: "P1", providerName: `Szpital ${nip}`, city: "WARSZAWA", voivodeship: "Mazowieckie", population: 1_000_000,
  hospitalizations, plannedAdmissions: hospitalizations - urgent, urgentAdmissions: urgent, totalAdmissions: hospitalizations,
  hospitalizationsPer100k: hospitalizations / 10, plannedAdmissionsPer100k: (hospitalizations - urgent) / 10, urgentAdmissionsPer100k: urgent / 10,
});
type Trace = { mode: string; x?: number[]; y?: number[]; hovertemplate?: string };
type Layout = { shapes: unknown[]; annotations: { text: string }[]; xaxis: { title: { text: string } }; yaxis: { title: { text: string }; ticksuffix?: string } };

async function draw(rows: AdmissionRow[], axisMode: "total" | "per_100k" = "total") {
  render(<AdmissionChart rows={rows} axisMode={axisMode} displayMode="combined" highlightAreas={[]} products={[]} regions={[]} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  const [, traces, layout] = react.mock.calls.at(-1) as unknown as [HTMLElement, Trace[], Layout];
  return { points: traces.find((trace) => trace.mode === "markers" && trace.hovertemplate)!, layout };
}

describe("AdmissionChart — układ jak na karcie JGP", () => {
  it("oś X: hospitalizacje, oś Y: udział nagłych (%), linia średniej ważonej hospitalizacjami", async () => {
    // Średnia: (50 + 10) / (100 + 300) = 15%.
    const { points, layout } = await draw([row("1", 100, 50), row("2", 300, 10)]);
    expect(points.x).toEqual([100, 300]);
    expect(points.y).toEqual([50, 10 / 3]);
    expect(layout.xaxis.title.text).toContain("Liczba hospitalizacji");
    expect(layout.yaxis.title.text).toContain("Przyjęcia nagłe (%)");
    expect(layout.yaxis.ticksuffix).toBe("%");
    expect(layout.annotations.map((a) => a.text)).toEqual(["średnia: 15,0%"]);
    expect(layout.shapes).toHaveLength(3);
  });

  it("na 100 tys. zmienia tylko oś X", async () => {
    const { points, layout } = await draw([row("1", 100, 50)], "per_100k");
    expect(points.x).toEqual([10]);
    expect(points.y).toEqual([50]);
    expect(layout.xaxis.title.text).toContain("na 100 tys.");
  });

  it("bez przyjęć nagłych nie rysuje średniej (pokrywa się z podstawą)", async () => {
    const { layout } = await draw([row("1", 100, 0)]);
    expect(layout.annotations).toHaveLength(0);
    expect(layout.shapes).toHaveLength(2);
  });
});
