"use client";

import { useEffect, useRef } from "react";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";
import type { ProductTrend, TrendPoint } from "@/lib/staticData";
import { monthlySeries } from "@/lib/trends";

export type TrendGranularity = "month" | "year";
export type TrendMeasure = "hospitalizations" | "admission" | "deaths";

const COLORS = { primary: "#2856A3", urgent: "#C65D2E", other: "#98A2B3" };
const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

type Series = { name: string; color: string; value: (point: TrendPoint) => number };

function seriesFor(measure: TrendMeasure): Series[] {
  if (measure === "deaths") return [{ name: "Zgony", color: COLORS.primary, value: (p) => p.deaths }];
  if (measure === "admission") return [
    { name: "Planowe", color: COLORS.primary, value: (p) => p.planned },
    { name: "Nagłe", color: COLORS.urgent, value: (p) => p.urgent },
    { name: "Pozostałe", color: COLORS.other, value: (p) => p.hospitalizations - p.planned - p.urgent },
  ];
  return [{ name: "Hospitalizacje", color: COLORS.primary, value: (p) => p.hospitalizations }];
}

/** Wykres trendu: miesiące (linie) albo lata (słupki). Lata bez produktu w katalogu są przerwą. */
export function TrendChart({ trend, years, granularity, measure }: {
  trend: ProductTrend;
  years: string[];
  granularity: TrendGranularity;
  measure: TrendMeasure;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;

      const series = seriesFor(measure);
      const stacked = series.length > 1;
      const monthly = monthlySeries(trend, years);
      const traces = series.map((s) => granularity === "month"
        ? {
          type: "scatter",
          mode: "lines+markers",
          name: s.name,
          x: monthly.map((m) => m.date),
          y: monthly.map((m) => m.point ? s.value(m.point) : null),
          customdata: monthly.map((m) => `${MONTHS[m.month - 1]} ${m.year}`),
          line: { color: s.color, width: 2 },
          marker: { color: s.color, size: 8 },
          connectgaps: false,
          stackgroup: stacked ? "admission" : undefined,
          hovertemplate: `%{customdata}<br>${s.name}: %{y:,.0f}<extra></extra>`,
        }
        : {
          type: "bar",
          name: s.name,
          x: years,
          y: trend.yearly.map((p) => p ? s.value(p) : null),
          marker: { color: s.color, line: { color: "#FFFFFF", width: 1 } },
          hovertemplate: `%{x}<br>${s.name}: %{y:,.0f}<extra></extra>`,
        });

      // Lata bez wybranych produktów w katalogu: podpis zamiast słupka.
      const annotations = granularity === "year"
        ? years.filter((_, i) => trend.yearly[i] === null).map((year) => ({
          x: year, y: 0, yanchor: "bottom", showarrow: false,
          text: "brak w katalogu JGP", font: { size: 11, color: "#667085" },
        }))
        : [];

      await Plotly.react(chartRef.current, traces, {
        height: 360,
        autosize: true,
        margin: { l: 64, r: 16, t: 16, b: 48 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        separators: ", ",
        barmode: "stack",
        bargap: 0.45,
        hovermode: granularity === "month" ? "x unified" : "closest",
        showlegend: stacked,
        legend: { orientation: "h", y: 1.08, x: 0, traceorder: "normal", font: { size: 12 } },
        hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
        annotations,
        xaxis: granularity === "month"
          ? { type: "date", tickformat: "%m.%Y", dtick: "M3", gridcolor: "#EEF1F5", hoverformat: " " }
          : { type: "category", gridcolor: "#EEF1F5" },
        yaxis: { rangemode: "tozero", gridcolor: "#EEF1F5", zerolinecolor: "#D0D5DD", tickformat: ",.0f" },
      }, PLOTLY_CONFIG);
    };
    void render();
    return () => { cancelled = true; };
  }, [trend, years, granularity, measure]);

  const total = trend.yearly.reduce((sum, p) => sum + (p?.hospitalizations ?? 0), 0);
  return <div ref={chartRef} role="img" aria-label={`Wykres trendu: ${integer(total)} hospitalizacji w latach ${years[0]}–${years.at(-1)}`} />;
}
