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
