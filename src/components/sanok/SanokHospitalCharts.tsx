"use client";

import { useEffect, useMemo, useRef } from "react";
import { getAppFontFamily, PLOTLY_CONFIG, type PlotElement } from "@/lib/plotlyChart";
import {
  formatMillions,
  formatThousands,
  type HospitalCodeRow,
  type IncomePoint,
  type WardRow,
  type WardYearPoint,
} from "@/lib/sanokHospital";
import styles from "./SanokCodesPage.module.css";

export const WARD_COLORS = ["#2856A3", "#C65D2E", "#2E7D5B", "#7656A8", "#A06A17", "#D4588A", "#3A9BB5", "#6B7F2A", "#8C5A43"];
export const ABOVE_COLOR = "#2856A3";
export const BELOW_COLOR = "#C65D2E";
const AVERAGE_COLOR = "#667085";

function baseLayout(height: number, margin: object) {
  return {
    autosize: true,
    height,
    margin,
    paper_bgcolor: "#FFFFFF",
    plot_bgcolor: "#FFFFFF",
    font: { family: getAppFontFamily(), color: "#172033", size: 12 },
    separators: ", ",
    showlegend: false,
  };
}

/** Jeden wykres Plotly. Dane i układ przekazuj z useMemo, żeby nie rysować bez potrzeby. */
function PlotlyFigure({
  data,
  layout,
  testId,
  onPointClick,
}: {
  data: unknown[];
  layout: object;
  testId: string;
  onPointClick?: (label: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const element = ref.current;
    const render = async () => {
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !element) return;
      await Plotly.react(element, data, layout, PLOTLY_CONFIG);
      if (onPointClick) {
        const plot = element as PlotElement;
        plot.removeAllListeners("plotly_click");
        plot.on("plotly_click", (event) => {
          const point = event?.points?.[0] as { customdata?: unknown } | undefined;
          if (typeof point?.customdata === "string") onPointClick(point.customdata);
        });
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [data, layout, onPointClick]);

  return <div ref={ref} data-testid={testId} />;
}

/**
 * Rozsuwa etykiety na końcu linii, żeby się nie nakładały.
 * Zwraca pozycje w jednostkach osi Y, w tej samej kolejności co `values`.
 */
export function spreadLabels(values: number[], minGap: number): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const placed: number[] = [];
  for (const item of order) {
    const previous = placed.length ? placed[placed.length - 1] : -Infinity;
    placed.push(Math.max(item.value, previous + minGap));
  }
  const result = new Array<number>(values.length);
  order.forEach((item, position) => {
    result[item.index] = placed[position];
  });
  return result;
}

/** Wartość świadczeń oddziałów w kolejnych latach: jedna linia na oddział, nazwa na końcu linii. */
export function WardValueLineChart({ series, names }: { series: WardYearPoint[][]; names: string[] }) {
  const { data, layout } = useMemo(() => {
    const lastValues = series.map((points) => points[points.length - 1]?.value ?? 0);
    const maxValue = Math.max(1, ...series.flat().map((point) => point.value));
    const labelY = spreadLabels(lastValues, maxValue * 0.045);
    const lastYear = series[0]?.[series[0].length - 1]?.year;
    return {
      data: series.map((points, index) => ({
        type: "scatter",
        mode: "lines+markers",
        name: names[index],
        x: points.map((point) => point.year),
        y: points.map((point) => point.value),
        line: { color: WARD_COLORS[index % WARD_COLORS.length], width: 2.5 },
        marker: { size: 6 },
        hovertemplate: "%{fullData.name}: %{y:,.0f} zł<extra></extra>",
      })),
      layout: {
        ...baseLayout(440, { l: 64, r: 300, t: 12, b: 32 }),
        hovermode: "x unified",
        xaxis: {
          dtick: 1,
          gridcolor: "#F2F4F7",
          range: [(series[0]?.[0]?.year ?? 0) - 0.3, (lastYear ?? 0) + 0.3],
        },
        yaxis: { range: [0, maxValue * 1.08], tickformat: "~s", ticksuffix: " zł", gridcolor: "#EAECF0", zeroline: false },
        annotations: names.map((name, index) => ({
          x: lastYear,
          y: labelY[index],
          xanchor: "left",
          xshift: 10,
          showarrow: false,
          align: "left",
          text: `${name} · ${formatMillions(lastValues[index])}`,
          font: { size: 11, color: WARD_COLORS[index % WARD_COLORS.length] },
        })),
      },
    };
  }, [series, names]);
  return <PlotlyFigure data={data} layout={layout} testId="ward-value-lines" />;
}

/** Wartość na hospitalizację w oddziałach na tle średniej szpitala. */
export function WardPerHospChart({ rows, average }: { rows: WardRow[]; average: number | null }) {
  const sorted = useMemo(
    () => rows.filter((row) => row.valuePerHosp !== null).sort((left, right) => left.valuePerHosp! - right.valuePerHosp!),
    [rows],
  );
  const data = useMemo(() => [{
    type: "bar",
    orientation: "h",
    y: sorted.map((row) => row.name),
    x: sorted.map((row) => row.valuePerHosp),
    text: sorted.map((row) => formatThousands(row.valuePerHosp)),
    textposition: "inside",
    insidetextanchor: "end",
    textfont: { color: "#FFFFFF", size: 11 },
    marker: { color: sorted.map((row) => (average !== null && row.valuePerHosp! >= average ? ABOVE_COLOR : BELOW_COLOR)) },
    customdata: sorted.map((row) => [row.hospCount, (row.longStayShare ?? 0) * 100]),
    hovertemplate: "%{y}<br>%{x:,.0f} zł na hospitalizację"
      + "<br>hospitalizacje: %{customdata[0]:,.0f}"
      + "<br>pobyty 6+ dni: %{customdata[1]:.0f}%<extra></extra>",
  }], [sorted, average]);
  const layout = useMemo(() => ({
    ...baseLayout(Math.max(260, sorted.length * 34 + 60), { l: 250, r: 24, t: 28, b: 32 }),
    bargap: 0.3,
    xaxis: { tickformat: "~s", ticksuffix: " zł", gridcolor: "#EAECF0", zeroline: false },
    yaxis: { automargin: true },
    shapes: average === null ? [] : [{
      type: "line", xref: "x", yref: "paper", x0: average, x1: average, y0: 0, y1: 1,
      line: { color: AVERAGE_COLOR, width: 1.5, dash: "dash" },
    }],
    annotations: average === null ? [] : [{
      xref: "x", yref: "paper", x: average, y: 1, yanchor: "bottom", showarrow: false,
      text: `średnia szpitala: ${formatThousands(average)}`, font: { size: 11, color: AVERAGE_COLOR },
    }],
  }), [sorted.length, average]);
  return <PlotlyFigure data={data} layout={layout} testId="ward-per-hosp" />;
}

/** Wartość na hospitalizację oddziału w kolejnych latach; `yMax` to wspólna skala wszystkich oddziałów. */
export function WardPerHospTrend({ points, color, yMax }: { points: WardYearPoint[]; color: string; yMax: number }) {
  const shown = useMemo(() => points.filter((point) => point.valuePerHosp !== null), [points]);
  const data = useMemo(() => [
    {
      type: "bar",
      name: "Oddział",
      x: shown.map((point) => String(point.year)),
      y: shown.map((point) => point.valuePerHosp),
      marker: { color },
      hovertemplate: "%{y:,.0f} zł na hospitalizację<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Średnia szpitala",
      x: shown.map((point) => String(point.year)),
      y: shown.map((point) => point.hospitalValuePerHosp),
      line: { color: AVERAGE_COLOR, width: 1.5, dash: "dash" },
      hovertemplate: "średnia szpitala: %{y:,.0f} zł<extra></extra>",
    },
  ], [shown, color]);
  const layout = useMemo(() => ({
    ...baseLayout(160, { l: 44, r: 6, t: 4, b: 24 }),
    bargap: 0.35,
    hovermode: "x unified",
    xaxis: { type: "category", tickfont: { size: 10 } },
    yaxis: { range: [0, yMax * 1.05], tickformat: "~s", gridcolor: "#EAECF0", zeroline: false, tickfont: { size: 10 } },
  }), [yMax]);
  return <PlotlyFigure data={data} layout={layout} testId="ward-trend" />;
}

export type CodeMetric = "value" | "valuePerHosp";

/** Kody JGP na wykresie poziomym. Kliknięcie słupka wybiera kod. */
export function CodesChart({
  rows,
  metric,
  selected,
  onPick,
}: {
  rows: HospitalCodeRow[];
  metric: CodeMetric;
  selected: string | null;
  onPick: (code: string) => void;
}) {
  const top = useMemo(() => rows.slice(0, 15).reverse(), [rows]);
  const data = useMemo(() => [{
    type: "bar",
    orientation: "h",
    y: top.map((row) => `${row.code} · ${row.name.length > 38 ? `${row.name.slice(0, 37)}…` : row.name}`),
    x: top.map((row) => (metric === "value" ? row.value : row.valuePerHosp)),
    customdata: top.map((row) => row.code),
    text: top.map((row) => `${row.hospCount} hosp.`),
    marker: { color: top.map((row) => (row.code === selected ? BELOW_COLOR : ABOVE_COLOR)) },
    hovertemplate: metric === "value"
      ? "%{y}<br>%{x:,.0f} zł · %{text}<extra></extra>"
      : "%{y}<br>%{x:,.0f} zł na hospitalizację · %{text}<extra></extra>",
    textposition: "none",
  }], [top, selected, metric]);
  const layout = useMemo(() => ({
    ...baseLayout(Math.max(240, top.length * 26 + 50), { l: 300, r: 16, t: 8, b: 32 }),
    bargap: 0.25,
    xaxis: { tickformat: "~s", ticksuffix: " zł", gridcolor: "#EAECF0", zeroline: false },
    yaxis: { automargin: true, tickfont: { size: 11 } },
  }), [top.length]);
  return (
    <div className={styles.clickable}>
      <PlotlyFigure data={data} layout={layout} testId={`codes-${metric}`} onPointClick={onPick} />
    </div>
  );
}

type IncomeKey = "costs" | "revenue" | "agreements" | "jgpAgreements" | "jgpSettled";

const INCOME_SERIES: { key: IncomeKey; name: string; color: string; dash?: string }[] = [
  { key: "costs", name: "Koszty (sprawozdanie)", color: "#B42318", dash: "dash" },
  { key: "revenue", name: "Przychody (sprawozdanie)", color: "#7656A8" },
  { key: "agreements", name: "Umowy z NFZ razem", color: "#172033" },
  { key: "jgpAgreements", name: "Umowy na hospitalizacje JGP", color: ABOVE_COLOR },
  { key: "jgpSettled", name: "Wartość JGP wykazana", color: BELOW_COLOR, dash: "dot" },
];

/** Przychody i koszty w czasie: sprawozdania finansowe, umowy z NFZ i wykazana wartość JGP. */
export function IncomeLineChart({ points }: { points: IncomePoint[] }) {
  const { data, layout } = useMemo(() => {
    const last = points[points.length - 1];
    const shown = INCOME_SERIES.filter((series) => points.some((point) => point[series.key] !== null));
    const lastValues = shown.map((series) => last?.[series.key] ?? 0);
    const maxValue = Math.max(1, ...points.flatMap((point) => shown.map((series) => point[series.key] ?? 0)));
    const labelY = spreadLabels(lastValues, maxValue * 0.055);
    return {
      data: shown.map((series) => ({
        type: "scatter",
        mode: "lines+markers",
        name: series.name,
        x: points.map((point) => point.year),
        y: points.map((point) => point[series.key]),
        line: { color: series.color, width: 2.5, dash: series.dash ?? "solid" },
        marker: { size: 6 },
        hovertemplate: `${series.name}: %{y:,.0f} zł<extra></extra>`,
      })),
      layout: {
        ...baseLayout(420, { l: 64, r: 260, t: 12, b: 32 }),
        hovermode: "x unified",
        xaxis: { dtick: 1, gridcolor: "#F2F4F7", range: [(points[0]?.year ?? 0) - 0.3, (last?.year ?? 0) + 0.3] },
        yaxis: { range: [0, maxValue * 1.08], tickformat: "~s", ticksuffix: " zł", gridcolor: "#EAECF0", zeroline: false },
        annotations: shown.map((series, index) => ({
          x: last?.year, y: labelY[index], xanchor: "left", xshift: 10, showarrow: false, align: "left",
          text: `${series.name} · ${formatMillions(lastValues[index])}`, font: { size: 11, color: series.color },
        })),
      },
    };
  }, [points]);
  return <PlotlyFigure data={data} layout={layout} testId="income-lines" />;
}

/** Umowy z NFZ w jednym roku wg grup finansowania. */
export function AgreementCompositionChart({ items }: { items: { group: string; amount: number }[] }) {
  const sorted = useMemo(() => items.slice().reverse(), [items]);
  const data = useMemo(() => [{
    type: "bar",
    orientation: "h",
    y: sorted.map((item) => item.group),
    x: sorted.map((item) => item.amount),
    text: sorted.map((item) => formatMillions(item.amount)),
    textposition: "outside",
    cliponaxis: false,
    marker: { color: sorted.map((item) => (item.group.startsWith("Hospitalizacje JGP") ? ABOVE_COLOR : AVERAGE_COLOR)) },
    hovertemplate: "%{y}: %{x:,.0f} zł<extra></extra>",
  }], [sorted]);
  const layout = useMemo(() => ({
    ...baseLayout(Math.max(220, sorted.length * 32 + 50), { l: 260, r: 90, t: 8, b: 32 }),
    bargap: 0.3,
    xaxis: { tickformat: "~s", ticksuffix: " zł", gridcolor: "#EAECF0", zeroline: false },
    yaxis: { automargin: true },
  }), [sorted.length]);
  return <PlotlyFigure data={data} layout={layout} testId="agreement-composition" />;
}
