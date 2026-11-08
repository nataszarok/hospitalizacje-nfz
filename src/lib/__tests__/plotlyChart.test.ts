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

describe("percentAxis z fit — oś dopasowana do danych", () => {
  it("nie zaczyna się od zera, gdy udziały są wysokie", () => {
    const axis = percentAxis([82, 86.5, 91, null], { fit: true });
    expect(axis.range[0]).toBeGreaterThan(75);
    expect(axis.range[0]).toBeLessThan(82);
    expect(axis.range[1]).toBeGreaterThan(91);
    expect(axis.range[1]).toBeLessThanOrEqual(100);
    expect(axis.dtick).toBe(2);
  });

  it("nie wychodzi poza 0–100% i ma minimalny margines przy stałych wartościach", () => {
    expect(percentAxis([99.8, 99.9], { fit: true }).range[1]).toBe(100);
    expect(percentAxis([0.1, 0.2], { fit: true }).range[0]).toBe(0);
    const flat = percentAxis([50, 50], { fit: true });
    expect(flat.range).toEqual([49.5, 50.5]);
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

import { axisTitle, baselineShape, categoryAxis, chartHoverLabel, chartLayout, getCommonPlotLayout, hoverTemplate, measureAxis, paddedRange } from "@/lib/plotlyChart";
import { CHART_COLORS } from "@/lib/chartPalette";

describe("motyw wykresów", () => {
  it("layout ma polskie separatory, jasny dymek i jeden dymek naraz", () => {
    const layout = chartLayout();
    expect(layout.separators).toBe(", ");
    expect(layout.hovermode).toBe("closest");
    expect(layout.hoverlabel).toMatchObject({ bgcolor: "#FFFFFF", bordercolor: CHART_COLORS.borderStrong, font: { color: CHART_COLORS.text, size: 13 }, align: "left" });
    expect(chartHoverLabel()).toEqual(layout.hoverlabel);
  });

  it("wspólny layout eksploratora dziedziczy motyw (separatory, dymek)", () => {
    vi.stubGlobal("window", { innerHeight: 900, innerWidth: 1400 });
    const layout = getCommonPlotLayout(true);
    vi.unstubAllGlobals();
    expect(layout.separators).toBe(", ");
    expect(layout.hoverlabel.bgcolor).toBe("#FFFFFF");
    expect(layout.showlegend).toBe(true);
  });

  it("oś-miara ma siatkę, oś kategorii nie; żadna nie rysuje linii zera", () => {
    expect(measureAxis()).toMatchObject({ showgrid: true, gridcolor: CHART_COLORS.grid, zeroline: false });
    expect(categoryAxis()).toMatchObject({ showgrid: false, zeroline: false });
    expect(measureAxis({ ticksuffix: "%" }).ticksuffix).toBe("%");
    expect(axisTitle("Śmiertelność (%)").font.color).toBe(CHART_COLORS.textSecondary);
  });

  it("podstawa leży pod danymi, w kolorze mocnej ramki", () => {
    expect(baselineShape("y")).toMatchObject({ layer: "below", y0: 0, y1: 0, xref: "paper", line: { color: CHART_COLORS.borderStrong, width: 1.5 } });
    expect(baselineShape("x", 2)).toMatchObject({ layer: "below", x0: 2, x1: 2, yref: "paper" });
  });
});

describe("paddedRange — margines osi −6% / +10%", () => {
  it("od zera: −6% i +10% maksimum", () => {
    const [bottom, top] = paddedRange([0, 50, 100, null]);
    expect(bottom).toBeCloseTo(-6);
    expect(top).toBeCloseTo(110);
  });

  it("wartości ujemne i dodatnie: zero w zakresie, margines od rozpiętości", () => {
    const [bottom, top] = paddedRange([-4, 6]);
    expect(bottom).toBeCloseTo(-4.6);
    expect(top).toBeCloseTo(7);
  });

  it("bez zera, gdy `includeZero: false`; brak danych daje zakres domyślny", () => {
    expect(paddedRange([10, 20], { includeZero: false })).toEqual([9.4, 21]);
    expect(paddedRange([])).toEqual([-0.06, 1.1]);
  });
});

describe("hoverTemplate — kolejność dymka", () => {
  it("nazwa, kontekst, wartości (najpierw oś Y), stopka; zawsze <extra></extra>", () => {
    const template = hoverTemplate({
      title: "%{customdata[0]}",
      context: "Kraków · Małopolskie · E53G",
      rows: [{ label: "Śmiertelność", value: "%{y:.1f}%" }, { label: "Hospitalizacje", value: "%{x:,.0f}" }],
      footer: "NIP 123",
    });
    const lines = template.replace("<extra></extra>", "").split("<br>");
    expect(lines[0]).toBe("<b>%{customdata[0]}</b>");
    expect(lines[1]).toContain("Kraków · Małopolskie · E53G");
    expect(lines[2]).toBe("Śmiertelność: <b>%{y:.1f}%</b>");
    expect(lines[3]).toBe("Hospitalizacje: <b>%{x:,.0f}</b>");
    expect(lines[4]).toContain("NIP 123");
    expect(template.endsWith("<extra></extra>")).toBe(true);
  });

  it("bez kontekstu i stopki ma tylko nazwę i wartości", () => {
    expect(hoverTemplate({ title: "A", rows: [{ label: "B", value: "1" }] })).toBe("<b>A</b><br>B: <b>1</b><extra></extra>");
  });
});
