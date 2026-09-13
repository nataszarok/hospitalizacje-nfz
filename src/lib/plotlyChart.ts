import type { GeographyMode } from "@/lib/types";

export const HIGHLIGHT_COLORS = ["#2856A3", "#C65D2E", "#2E7D5B", "#7656A8", "#A06A17"];
export const PRODUCT_SYMBOLS = [
  "circle",
  "square",
  "diamond",
  "triangle-up",
  "triangle-down",
  "triangle-left",
  "triangle-right",
  "cross",
  "x",
  "star",
];

export const PLOTLY_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

export function getAppFontFamily(): string {
  return getComputedStyle(document.body).fontFamily || "Inter, ui-sans-serif, system-ui, sans-serif";
}

export function getChartHeight(): number {
  return window.innerHeight <= 850 && window.innerWidth > 1000
    ? Math.max(400, Math.min(500, window.innerHeight - 300))
    : 540;
}

export function getGeoSelection(
  geographyMode: GeographyMode,
  highlightedRegions: string[],
  highlightedCities: string[],
): string[] {
  return geographyMode === "regions" ? highlightedRegions : highlightedCities;
}

export function getGeoKey(row: { owNfz: string; city: string }, geographyMode: GeographyMode): string {
  return geographyMode === "regions" ? row.owNfz : row.city;
}

export function getCommonPlotLayout(showLegend: boolean) {
  return {
    height: getChartHeight(),
    autosize: true,
    margin: { l: 88, r: 24, t: 22, b: 88 },
    paper_bgcolor: "#FFFFFF",
    plot_bgcolor: "#FFFFFF",
    hovermode: "closest",
    hoverdistance: 18,
    font: { family: getAppFontFamily(), color: "#172033", size: 12 },
    legend: {
      orientation: "v",
      yanchor: "top",
      y: 0.99,
      xanchor: "right",
      x: 0.99,
      bgcolor: "rgba(255,255,255,0.90)",
      bordercolor: "#E3E7EE",
      borderwidth: 1,
      font: { size: 11, color: "#111111" },
      itemclick: false,
      itemdoubleclick: false,
    },
    showlegend: showLegend,
    hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
  };
}

export function makeDimensionLegendTraces({
  geographyMode,
  geoSelection,
  geoLabel,
  productCodes,
  productLabel,
}: {
  geographyMode: GeographyMode;
  geoSelection: string[];
  geoLabel: (key: string) => string;
  productCodes: string[];
  productLabel: (code: string) => string;
}) {
  const traces: Record<string, unknown>[] = [];

  if (geoSelection.length > 0) {
    traces.push({
      type: "scattergl", mode: "markers", x: [null], y: [null],
      name: "Pozostałe", hoverinfo: "skip",
      marker: { size: 9, color: "#C7CBD1", symbol: "circle", line: { width: 0.4, color: "#FFFFFF" } },
      legendgroup: "geography",
      legendgrouptitle: { text: geographyMode === "regions" ? "Województwa" : "Miasta" },
    });
    geoSelection.forEach((key, index) => {
      traces.push({
        type: "scattergl", mode: "markers", x: [null], y: [null],
        name: geoLabel(key), hoverinfo: "skip",
        marker: { size: 9, color: HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length], symbol: "circle", line: { width: 0.4, color: "#FFFFFF" } },
        legendgroup: "geography",
      });
    });
  }

  if (productCodes.length > 1) {
    productCodes.forEach((code, index) => {
      traces.push({
        type: "scattergl", mode: "markers", x: [null], y: [null],
        name: productLabel(code), hoverinfo: "skip",
        marker: { size: 9, color: "#667085", symbol: PRODUCT_SYMBOLS[index % PRODUCT_SYMBOLS.length], line: { width: 0.4, color: "#FFFFFF" } },
        legendgroup: "products",
        ...(index === 0 ? { legendgrouptitle: { text: "Kod JGP" } } : {}),
      });
    });
  }

  return traces;
}

export function makeHoverTrace() {
  return {
    type: "scattergl",
    mode: "markers",
    x: [null],
    y: [null],
    showlegend: false,
    hoverinfo: "skip",
    marker: {
      size: 13,
      opacity: 1,
      color: "#D92D20",
      symbol: "circle",
      line: { width: 1.4, color: "#FFFFFF" },
    },
  };
}

export type PlotlyHoverEvent = {
  points?: Array<{
    curveNumber: number;
    pointNumber: number;
    x: unknown;
    y: unknown;
  }>;
};

export type PlotElement = HTMLDivElement & {
  on: (event: string, handler: (event: PlotlyHoverEvent) => void) => void;
  removeAllListeners: (event: string) => void;
};

type PlotlyRestyle = {
  restyle: (element: HTMLElement, update: object, traceIndices?: number[]) => Promise<void>;
};

export function attachHoverMarker({
  plot,
  Plotly,
  traces,
  hoverTraceIndex,
}: {
  plot: PlotElement;
  Plotly: PlotlyRestyle;
  traces: Record<string, unknown>[];
  hoverTraceIndex: number;
}) {
  plot.removeAllListeners("plotly_hover");
  plot.removeAllListeners("plotly_unhover");

  let hoverRestyleInProgress = false;

  plot.on("plotly_hover", (event) => {
    const point = event?.points?.[0];
    if (hoverRestyleInProgress || !point || point.curveNumber === hoverTraceIndex) return;

    const sourceTrace = traces[point.curveNumber] as {
      marker?: { symbol?: string | string[] };
    };
    const sourceSymbol = sourceTrace.marker?.symbol;
    const symbol = Array.isArray(sourceSymbol)
      ? (sourceSymbol[point.pointNumber] ?? "circle")
      : (sourceSymbol ?? "circle");

    hoverRestyleInProgress = true;
    void Plotly.restyle(plot, {
      x: [[point.x]],
      y: [[point.y]],
      "marker.symbol": [symbol],
    }, [hoverTraceIndex]);
    hoverRestyleInProgress = false;
  });

  plot.on("plotly_unhover", () => {
    if (hoverRestyleInProgress) return;

    hoverRestyleInProgress = true;
    void Plotly.restyle(plot, {
      x: [[null]],
      y: [[null]],
    }, [hoverTraceIndex]);
    hoverRestyleInProgress = false;
  });
}
