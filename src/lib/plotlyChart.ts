import { CHART_COLORS, OTHER_POINT, REGION_PICK_COLORS } from "@/lib/chartPalette";
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

const FALLBACK_FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

export function getAppFontFamily(): string {
  if (typeof document === "undefined") return FALLBACK_FONT;
  return getComputedStyle(document.body).fontFamily || FALLBACK_FONT;
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

/** Górny margines wykresu „Tryb przyjęcia”: miejsce na przełączniki w prawym górnym rogu karty. */
export const PLOT_TOOLBAR_MARGIN = 56;

/*
 * Motyw wykresów Plotly (DESIGN.md, sekcja 6): jeden wygląd siatki, osi, legendy i dymka dla całego portalu.
 * Siatka tylko na osi, która jest miarą; zero rysuje podstawa pod danymi, nie `zeroline`.
 */

/** Rozmiary tekstu wykresów: podziałka i legenda `--fs-sm`, tytuł osi `--fs-md`, dymek 13 px. */
export const CHART_TEXT = { tick: 12, axisTitle: 13, legend: 12, hover: 13 } as const;

/** Dymek Plotly: jasny, z ramką i tekstem grafitowym (jak dymki HTML, `ChartTooltip`). */
export function chartHoverLabel() {
  return {
    bgcolor: CHART_COLORS.background,
    bordercolor: CHART_COLORS.borderStrong,
    font: { family: getAppFontFamily(), color: CHART_COLORS.text, size: CHART_TEXT.hover },
    align: "left" as const,
  };
}

/** Najdłuższa linia nazwy w dymku i w podpisie na wykresie (znaki). */
export const CHART_LABEL_LINE = 32;

/**
 * Długa nazwa (np. placówki) w kilku liniach Plotly (`<br>`), łamana na spacjach (DESIGN.md, 6.3).
 * Dymek i podpis nie są wtedy szersze od wykresu i nie zasłaniają punktu. Słowo dłuższe niż linia zostaje całe.
 */
export function wrapChartLabel(text: string, max = CHART_LABEL_LINE): string {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.join("<br>");
}

/**
 * Wspólna część layoutu: polskie separatory („10 000”, „11,5%”), krój i kolor tekstu, białe tło,
 * dymek `closest` (jeden naraz, nigdy „x unified” nad danymi).
 */
export function chartLayout() {
  return {
    separators: ", ",
    paper_bgcolor: CHART_COLORS.background,
    plot_bgcolor: CHART_COLORS.background,
    font: { family: getAppFontFamily(), color: CHART_COLORS.text, size: CHART_TEXT.tick },
    hovermode: "closest" as const,
    hoverlabel: chartHoverLabel(),
  };
}

/** Tytuł osi: `--fs-md`, kolor drugorzędny. */
export function axisTitle(text: string, standoff = 12) {
  return { text, standoff, font: { size: CHART_TEXT.axisTitle, color: CHART_COLORS.textSecondary } };
}

const axisBase = {
  zeroline: false,
  showline: false,
  tickfont: { size: CHART_TEXT.tick, color: CHART_COLORS.textTertiary },
  automargin: true,
};

/** Oś-miara (wartości): siatka ciągła 1 px w kolorze `--color-chart-grid`, bez linii zera. */
export function measureAxis<T extends object = object>(extra: T = {} as T) {
  return { ...axisBase, showgrid: true, gridcolor: CHART_COLORS.grid, gridwidth: 1, ...extra };
}

/** Oś kategorii (lata, kody JGP): bez siatki. */
export function categoryAxis<T extends object = object>(extra: T = {} as T) {
  return { ...axisBase, showgrid: false, ...extra };
}

/**
 * Zakres osi wartości: od −6% rozpiętości pod minimum (z zerem, gdy `includeZero`) do +10% nad maksimum.
 * Ten sam margines na obu osiach wykresu punktowego; punkt na zerze nie leży na krawędzi.
 */
export function paddedRange(values: (number | null | undefined)[], { includeZero = true }: { includeZero?: boolean } = {}): [number, number] {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const min = Math.min(...(includeZero ? [0] : []), ...finite);
  const max = Math.max(...(includeZero ? [0] : []), ...finite);
  // Brak danych albo same zera: oś 0–1 (z tym samym marginesem), nie zakres 0–0.
  if (!Number.isFinite(min) || !Number.isFinite(max) || (min === 0 && max === 0)) return [-0.06, 1.1];
  const span = max - min || Math.abs(max);
  return [min - span * 0.06, max + span * 0.1];
}

/** Podstawa (zero osi wartości) pod danymi: linia 1,5 px `--color-border-strong`. */
export function baselineShape(axis: "x" | "y" = "y", value = 0) {
  const line = { color: CHART_COLORS.borderStrong, width: 1.5 };
  return axis === "y"
    ? { type: "line", layer: "below", xref: "paper", x0: 0, x1: 1, yref: "y", y0: value, y1: value, line }
    : { type: "line", layer: "below", yref: "paper", y0: 0, y1: 1, xref: "x", x0: value, x1: value, line };
}

/** Linia odniesienia (średnia kraju, mediana): kropkowana 1 px, kolor drugorzędny. */
export function referenceShape(y: number) {
  return { type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: CHART_COLORS.textSecondary, width: 1, dash: "dot" } };
}

/** Podpis linii odniesienia przy prawej krawędzi, nad linią (np. „średnia: 11,5%”). */
export function referenceAnnotation(y: number, text: string) {
  return { xref: "paper", x: 1, y, xanchor: "right", yanchor: "bottom", showarrow: false, text, font: { size: 12, color: CHART_COLORS.textSecondary } };
}

/** Podpis średniej w procentach: „średnia: 11,5%”, przy wartości poniżej 1% dwa miejsca po przecinku (6.4). */
export function meanPctLabel(value: number) {
  const digits = value < 1 ? 2 : 1;
  return `średnia: ${value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

/** Wiersz dymka: etykieta i wyrażenie Plotly (np. `%{y:.1f}%`). */
export interface HoverRow { label: string; value: string }

/**
 * Szablon dymka Plotly w kolejności z DESIGN.md (6.3): nazwa pogrubiona, kontekst szarym,
 * 2–4 wartości „Etykieta: **wartość**” (najpierw oś Y, potem X), status i identyfikatory na końcu.
 * Zawsze z `<extra></extra>` (bez nazwy serii w osobnej ramce).
 */
export function hoverTemplate({ title, context, rows, footer }: { title: string; context?: string; rows: HoverRow[]; footer?: string }) {
  const muted = (text: string) => `<span style="color:${CHART_COLORS.textTertiary}">${text}</span>`;
  return [
    `<b>${title}</b>`,
    ...(context ? [muted(context)] : []),
    ...rows.map((row) => `${row.label}: <b>${row.value}</b>`),
    ...(footer ? [muted(footer)] : []),
  ].join("<br>") + "<extra></extra>";
}

export function getCommonPlotLayout(showLegend: boolean) {
  return {
    ...chartLayout(),
    height: getChartHeight(),
    autosize: true,
    margin: { l: 88, r: 24, t: 22, b: 88 },
    hoverdistance: 18,
    legend: {
      orientation: "v",
      yanchor: "top",
      y: 0.99,
      xanchor: "right",
      x: 0.99,
      bgcolor: "rgba(255,255,255,0.90)",
      bordercolor: CHART_COLORS.border,
      borderwidth: 1,
      font: { size: CHART_TEXT.legend, color: CHART_COLORS.text },
      itemclick: false,
      itemdoubleclick: false,
    },
    showlegend: showLegend,
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
        marker: { size: 9, color: CHART_COLORS.textTertiary, symbol: PRODUCT_SYMBOLS[index % PRODUCT_SYMBOLS.length], line: { width: 0.4, color: "#FFFFFF" } },
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
    // Najechany punkt: grafit z białą obwódką (czerwień jest tylko dla błędów, DESIGN.md 2.1).
    marker: {
      size: 13,
      opacity: 1,
      color: CHART_COLORS.text,
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
 * Oś Y dla liczb (hospitalizacje, zgony): zakres −6% / +10% (`paddedRange`; kropki na 0 nie leżą na krawędzi)
 * i całkowita podziałka przy małych wartościach (bez powtórzonych etykiet typu „0, 0, 1, 1” z kroku 0,2).
 */
export function countAxis(values: (number | null | undefined)[]) {
  const max = Math.max(0, ...values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)));
  const [bottom, top] = max > 0 ? paddedRange([max]) : [-0.06, 1];
  const dtick = top <= 5 ? 1 : top <= 10 ? 2 : undefined;
  return { range: [bottom, Math.max(top, dtick ?? 0)], ...(dtick ? { dtick } : {}), tickformat: ",.0f" };
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
  const [bottom, top] = max > 0 ? paddedRange([max]) : [-0.06, 1];
  const dtick = percentStep(top);
  return { range: [bottom, top], dtick, ticksuffix: "%", tickformat: `,.${stepDecimals(dtick)}f` };
}

/** Krok podziałki 1, 2 albo 5 × 10^k: ok. 5 etykiet na rozpiętości osi. */
function percentStep(span: number) {
  const magnitude = 10 ** Math.floor(Math.log10(span / 5));
  return [1, 2, 5, 10].map((factor) => factor * magnitude).find((step) => span / step <= 6)!;
}

const stepDecimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
