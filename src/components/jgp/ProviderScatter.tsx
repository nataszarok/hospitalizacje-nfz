"use client";

import { useEffect, useRef } from "react";
import { getAppFontFamily, PLOTLY_CONFIG, type PlotElement, type PlotlyHoverEvent } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";

export interface ScatterPoint {
  key: string;
  name: string;
  /** Linie podpowiedzi pod nazwą. */
  lines: string[];
  x: number;
  y: number;
  selected?: boolean;
}

/**
 * Wykres punktowy świadczeniodawców: punkt = ośrodek. Najechanie pokazuje nazwę i liczby,
 * kliknięcie wybiera ośrodek (wyróżnienie na całej karcie).
 */
export function ProviderScatter({ points, xTitle, yTitle, ySuffix, reference, onSelect, ariaLabel }: {
  points: ScatterPoint[];
  xTitle: string;
  yTitle: string;
  ySuffix: string;
  reference?: { y: number; label: string };
  onSelect?: (key: string) => void;
  ariaLabel: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      const groups = [points.filter((p) => !p.selected), points.filter((p) => p.selected)];
      const traces = groups.map((group, i) => ({
        type: "scatter",
        mode: "markers",
        x: group.map((p) => Math.max(p.x, 1)),
        y: group.map((p) => p.y),
        customdata: group.map((p) => [p.key, `<b>${p.name}</b><br>${p.lines.join("<br>")}`]),
        marker: i === 0
          ? { color: "rgba(40, 86, 163, 0.55)", size: 8, line: { color: "#FFFFFF", width: 1 } }
          : { color: "#C65D2E", size: 13, line: { color: "#FFFFFF", width: 2 } },
        hovertemplate: "%{customdata[1]}<extra></extra>",
      }));
      const plot = chartRef.current as PlotElement;
      await Plotly.react(plot, traces, {
        height: 360,
        autosize: true,
        margin: { l: 56, r: 16, t: 12, b: 52 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        separators: ", ",
        hovermode: "closest",
        showlegend: false,
        hoverlabel: { bgcolor: "#344054", font: { color: "#FFFFFF", size: 13 }, align: "left" },
        xaxis: { type: "log", title: { text: xTitle }, gridcolor: "#EEF1F5", tickformat: ",.0f" },
        yaxis: { title: { text: yTitle }, rangemode: "tozero", gridcolor: "#EEF1F5", ticksuffix: ySuffix },
        shapes: reference ? [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: reference.y, y1: reference.y, line: { color: "#667085", width: 1, dash: "dot" } }] : [],
        annotations: reference ? [{ xref: "paper", x: 1, y: reference.y, xanchor: "right", yanchor: "bottom", showarrow: false, text: reference.label, font: { size: 11, color: "#667085" } }] : [],
      }, PLOTLY_CONFIG);
      if (cancelled || !onSelect) return;
      plot.removeAllListeners?.("plotly_click");
      plot.on?.("plotly_click", (event: PlotlyHoverEvent) => {
        const point = event.points?.[0] as { customdata?: string[] } | undefined;
        const key = point?.customdata?.[0];
        if (key) onSelect(key);
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [points, xTitle, yTitle, ySuffix, reference, onSelect]);

  return <div ref={chartRef} role="img" aria-label={ariaLabel} />;
}
