"use client";

import { useEffect, useRef } from "react";
import { getAppFontFamily, PLOTLY_CONFIG, type PlotElement, type PlotlyHoverEvent } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const BASE = "#98A2B3";
const PRIMARY = "#2856A3";
const SELECTED = "#C65D2E";

export interface ChartLine {
  key: string;
  name: string;
  /** Druga linia podpowiedzi, np. miasto i województwo. */
  detail?: string;
  values: number[];
  /** „primary” — jedna linia kraju; „selected” — wybrany szpital; domyślnie szara linia ośrodka. */
  tone?: "primary" | "selected";
}

/**
 * Wykres liniowy miesięcy. Najechanie na linię wyróżnia ją i przyciemnia pozostałe;
 * podpowiedź pokazuje nazwę ośrodka, miesiąc i wartość.
 */
export function GroupLineChart({ months, lines, valueLabel, ariaLabel }: {
  /** Miesiące jako „RRRR-MM”. */
  months: string[];
  lines: ChartLine[];
  valueLabel: string;
  ariaLabel: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      const labels = months.map((month) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`);
      // Wybrany szpital rysujemy na końcu, żeby był nad innymi liniami.
      const ordered = [...lines.filter((line) => line.tone !== "selected"), ...lines.filter((line) => line.tone === "selected")];
      const color = (line: ChartLine) => line.tone === "primary" ? PRIMARY : line.tone === "selected" ? SELECTED : BASE;
      const width = (line: ChartLine) => line.tone ? 2.5 : 1.5;
      const opacity = (line: ChartLine) => line.tone ? 1 : 0.55;
      const traces = ordered.map((line) => ({
        type: "scatter",
        mode: "lines",
        name: line.name,
        x: months.map((month) => `${month}-01`),
        y: line.values,
        customdata: labels.map((label) => [label, line.name, line.detail ?? ""]),
        line: { color: color(line), width: width(line) },
        opacity: opacity(line),
        hovertemplate: `<b>%{customdata[1]}</b><br>%{customdata[2]}${line.detail ? "<br>" : ""}%{customdata[0]}: %{y:,.0f} ${valueLabel}<extra></extra>`,
      }));
      const plot = chartRef.current as PlotElement;
      await Plotly.react(plot, traces, {
        height: 380,
        autosize: true,
        margin: { l: 56, r: 16, t: 12, b: 44 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        separators: ", ",
        hovermode: "closest",
        showlegend: false,
        hoverlabel: { bgcolor: "#344054", font: { color: "#FFFFFF", size: 13 } },
        xaxis: { type: "date", tickformat: "%m.%Y", dtick: "M3", gridcolor: "#EEF1F5" },
        yaxis: { rangemode: "tozero", gridcolor: "#EEF1F5", zerolinecolor: "#D0D5DD", tickformat: ",.0f" },
      }, PLOTLY_CONFIG);
      if (cancelled || lines.length < 2) return;
      // Wyróżnienie linii pod kursorem.
      plot.removeAllListeners?.("plotly_hover");
      plot.removeAllListeners?.("plotly_unhover");
      plot.on?.("plotly_hover", (event: PlotlyHoverEvent) => {
        const active = event.points?.[0]?.curveNumber;
        if (active === undefined) return;
        void Plotly.restyle(plot, {
          opacity: ordered.map((line, i) => i === active ? 1 : line.tone === "selected" ? 0.6 : 0.12),
          "line.width": ordered.map((line, i) => i === active ? 3.5 : width(line)),
          "line.color": ordered.map((line, i) => i === active && !line.tone ? PRIMARY : color(line)),
        });
      });
      plot.on?.("plotly_unhover", () => {
        void Plotly.restyle(plot, { opacity: ordered.map(opacity), "line.width": ordered.map(width), "line.color": ordered.map(color) });
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [months, lines, valueLabel]);

  return <div ref={chartRef} role="img" aria-label={ariaLabel} />;
}
