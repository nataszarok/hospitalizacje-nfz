import { OTHER_POINT, REGION_PICK_COLORS } from "@/lib/chartPalette";
import { areaToValue, inArea, type AnalysisArea } from "@/lib/area";
import type { GeographyMode } from "@/lib/types";

/** Kolory wyróżnionych obszarów: ta sama paleta co na karcie grupy JGP. */
export const HIGHLIGHT_COLORS = REGION_PICK_COLORS;
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

/**
 * Wyróżnienie obszarów na wykresie świadczeniodawców: klucz obszaru (`ow:07`, `c:KRAKÓW`), do którego należy wiersz
 * (pierwszy pasujący z listy), albo `null`. Kolejność listy = kolejność kolorów.
 */
export function areaHighlightKey(areas: AnalysisArea[], row: { owNfz: string; city: string }): string | null {
  const area = areas.find((candidate) => inArea(candidate, row));
  return area ? areaToValue(area) : null;
}

/** Tytuł legendy wyróżnień: województwa, miasta albo obszary (mieszane). */
export function areaHighlightTitle(areas: AnalysisArea[]): string {
  if (areas.every((area) => area.kind === "region")) return "Województwa";
  if (areas.every((area) => area.kind === "city")) return "Miasta";
  return "Obszary";
}

/** Górny margines wykresów punktowych eksploratora: miejsce na przełączniki w prawym górnym rogu karty. */
export const PLOT_TOOLBAR_MARGIN = 56;

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
  geoTitle,
  geoSelection,
  geoLabel,
  productCodes,
  productLabel,
}: {
  /** Tytuł grupy legendy wyróżnień, np. „Obszary”. */
  geoTitle: string;
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
      marker: { size: 9, color: OTHER_POINT, symbol: "circle", line: { width: 0.4, color: "#FFFFFF" } },
      legendgroup: "geography",
      legendgrouptitle: { text: geoTitle },
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
      marker?: { symbol?: string | string[]; size?: number | number[] };
    };
    const sourceSymbol = sourceTrace.marker?.symbol;
    const symbol = Array.isArray(sourceSymbol)
      ? (sourceSymbol[point.pointNumber] ?? "circle")
      : (sourceSymbol ?? "circle");

    // Znacznik najechanego punktu jest zawsze trochę większy od punktu (także od dużej gwiazdki wybranego ośrodka).
    const sourceSize = sourceTrace.marker?.size;
    const size = Array.isArray(sourceSize) ? (sourceSize[point.pointNumber] ?? 0) : (sourceSize ?? 0);
    hoverRestyleInProgress = true;
    void Plotly.restyle(plot, {
      x: [[point.x]],
      y: [[point.y]],
      "marker.symbol": [symbol],
      "marker.size": [Math.max(13, size + 4)],
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

/**
 * Oś X dla miesięcy: przy krótkim zakresie podpis co kwartał („03.2025”), przy dłuższym co pół roku,
 * a od 6 lat tylko lata („2019”), żeby podpisy nie nachodziły na siebie.
 */
export function monthAxis(months: number) {
  if (months <= 36) return { type: "date" as const, tickformat: "%m.%Y", dtick: "M3" };
  if (months <= 72) return { type: "date" as const, tickformat: "%m.%Y", dtick: "M6" };
  return { type: "date" as const, tickformat: "%Y", dtick: "M12", tick0: "2000-01-01" };
}

/**
 * Oś Y dla liczb (hospitalizacje, zgony): zakres z marginesem pod zerem (kropki na 0 nie są ucinane przez oś X)
 * i całkowita podziałka przy małych wartościach (bez powtórzonych etykiet typu „0, 0, 1, 1” z kroku 0,2).
 */
export function countAxis(values: (number | null | undefined)[]) {
  const max = Math.max(0, ...values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)));
  const top = max > 0 ? max * 1.1 : 1;
  const dtick = top <= 5 ? 1 : top <= 10 ? 2 : undefined;
  return { range: [-top * 0.06, Math.max(top, dtick ?? 0)], ...(dtick ? { dtick } : {}), tickformat: ",.0f" };
}

/**
 * Oś Y dla udziałów w procentach: od zera (z marginesem) albo, z `fit`, dopasowana do danych; z „%” przy etykietach.
 * Krok podziałki 1, 2 albo 5 × 10^k (ok. 5 etykiet), a liczba miejsc po przecinku wynika z kroku,
 * więc bardzo małe udziały (np. 0,07%) nie dają powtórzonych etykiet „0%”.
 */
export function percentAxis(values: (number | null | undefined)[], { fit = false }: { fit?: boolean } = {}) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const max = Math.max(0, ...finite);
  // Dopasowanie do danych (np. % nagłych 80–95%): oś od minimum, nie od zera, z marginesem 15% rozpiętości.
  if (fit && finite.length) {
    const min = Math.min(...finite);
    const pad = Math.max((max - min) * 0.15, 0.5);
    const bottom = Math.max(0, min - pad);
    const top = Math.min(100, max + pad);
    const dtick = percentStep(top - bottom);
    return { range: [bottom, top], dtick, ticksuffix: "%", tickformat: `,.${stepDecimals(dtick)}f` };
  }
  const top = max > 0 ? max * 1.1 : 1;
  const dtick = percentStep(top);
  return { range: [-top * 0.06, top], dtick, ticksuffix: "%", tickformat: `,.${stepDecimals(dtick)}f` };
}

/** Krok podziałki 1, 2 albo 5 × 10^k: ok. 5 etykiet na rozpiętości osi. */
function percentStep(span: number) {
  const magnitude = 10 ** Math.floor(Math.log10(span / 5));
  return [1, 2, 5, 10].map((factor) => factor * magnitude).find((step) => span / step <= 6)!;
}

const stepDecimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
