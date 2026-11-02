import { describe, expect, it, vi } from "vitest";
import { attachHoverMarker, type PlotElement } from "@/lib/plotlyChart";

// Atrapa wykresu: zapamiętuje obsługę zdarzeń i wywołania restyle.
function fakePlot() {
  const handlers: Record<string, (event?: unknown) => void> = {};
  const plot = { on: (name: string, fn: (event?: unknown) => void) => { handlers[name] = fn; }, removeAllListeners: () => {} } as unknown as PlotElement;
  const restyle = vi.fn(() => Promise.resolve());
  return { plot, handlers, Plotly: { restyle } };
}

describe("attachHoverMarker", () => {
  it("znacznik najechanego punktu jest większy od punktu i ma jego kształt (gwiazdka wybranego ośrodka rośnie)", () => {
    const { plot, handlers, Plotly } = fakePlot();
    const traces = [
      { marker: { size: 8, symbol: "circle" } },
      { marker: { size: 18, symbol: "star" } },
      { marker: { size: 13 } },
    ];
    attachHoverMarker({ plot, Plotly: Plotly as never, traces, hoverTraceIndex: 2 });
    handlers.plotly_hover({ points: [{ curveNumber: 1, pointNumber: 0, x: 5, y: 7 }] });
    expect(Plotly.restyle).toHaveBeenLastCalledWith(plot, { x: [[5]], y: [[7]], "marker.symbol": ["star"], "marker.size": [22] }, [2]);
    handlers.plotly_hover({ points: [{ curveNumber: 0, pointNumber: 3, x: 1, y: 2 }] });
    expect(Plotly.restyle).toHaveBeenLastCalledWith(plot, { x: [[1]], y: [[2]], "marker.symbol": ["circle"], "marker.size": [13] }, [2]);
  });
});

import { countAxis, monthAxis, percentAxis } from "@/lib/plotlyChart";

describe("countAxis — oś Y dla liczb", () => {
  it("małe liczby: podziałka co 1, margines pod zerem", () => {
    const axis = countAxis([0, 0, 1, 0, null]);
    expect(axis.dtick).toBe(1);
    expect(axis.range[0]).toBeLessThan(0);
    expect(axis.range[1]).toBeGreaterThanOrEqual(1);
  });

  it("same zera: oś do 1 zamiast zakresu 0–0", () => {
    expect(countAxis([0, 0, 0]).range[1]).toBe(1);
  });

  it("do 10: podziałka co 2; większe liczby: podziałka automatyczna", () => {
    expect(countAxis([3, 8]).dtick).toBe(2);
    expect(countAxis([120, 880])).not.toHaveProperty("dtick");
    expect(countAxis([120, 880]).range[1]).toBeCloseTo(968);
  });
});

describe("percentAxis — oś Y dla udziałów", () => {
  it("ma „%” przy etykietach i margines pod zerem", () => {
    const axis = percentAxis([0.4, 1.2, null]);
    expect(axis.ticksuffix).toBe("%");
    expect(axis.range[0]).toBeLessThan(0);
    expect(percentAxis([]).range[1]).toBe(1);
  });

  it("miejsca po przecinku wynikają z kroku: bardzo małe udziały nie dają powtórzonych „0%”", () => {
    expect(percentAxis([0.07])).toMatchObject({ dtick: 0.02, tickformat: ",.2f" });
    expect(percentAxis([1.2])).toMatchObject({ dtick: 0.5, tickformat: ",.1f" });
    expect(percentAxis([5.4])).toMatchObject({ dtick: 1, tickformat: ",.0f" });
    expect(percentAxis([40])).toMatchObject({ dtick: 10, tickformat: ",.0f" });
  });
});

describe("monthAxis — oś X miesięcy", () => {
  it("dla 2 lat podpisuje kwartały", () => {
    expect(monthAxis(24)).toMatchObject({ dtick: "M3", tickformat: "%m.%Y" });
  });

  it("dla 4–6 lat podpisuje co pół roku", () => {
    expect(monthAxis(48)).toMatchObject({ dtick: "M6" });
    expect(monthAxis(72)).toMatchObject({ dtick: "M6" });
  });

  it("dla dłuższych zakresów podpisuje tylko lata", () => {
    expect(monthAxis(108)).toMatchObject({ dtick: "M12", tickformat: "%Y" });
  });
});
