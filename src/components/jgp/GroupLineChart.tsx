"use client";

import { useEffect, useRef } from "react";
import { movingAverage } from "@/lib/jgpCard";
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
  /** „primary” — kraj albo suma; „selected” — wybrany szpital; domyślnie szara linia ośrodka. */
  tone?: "primary" | "selected";
  /** Własny kolor (linie województw); ma pierwszeństwo przed `tone`. */
  color?: string;
  /** Kolor linii ośrodka po najechaniu (każdy ośrodek inny); domyślnie niebieski. */
  accent?: string;
}

/**
 * Wykres miesięcy: kropka = wartość w miesiącu, linia = średnia krocząca z 3 miesięcy (3M MA;
 * na początku serii średnia z dostępnych miesięcy).
 * Najechanie na serię wyróżnia jej kropki i linię, przyciemnia pozostałe i pokazuje nazwę.
 */
export function GroupLineChart({ months, lines, valueLabel, ariaLabel, legend = false }: {
  /** Miesiące jako „RRRR-MM”. */
  months: string[];
  lines: ChartLine[];
  valueLabel: string;
  ariaLabel: string;
  /** Legenda z nazwami serii (np. województwa). */
  legend?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      const labels = months.map((month) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`);
      const x = months.map((month) => `${month}-01`);
      // Wybrany szpital rysujemy na końcu, żeby był nad innymi seriami.
      const ordered = [...lines.filter((line) => line.tone !== "selected"), ...lines.filter((line) => line.tone === "selected")];
      const emphasized = (line: ChartLine) => Boolean(line.tone || line.color);
      const color = (line: ChartLine) => line.color ?? (line.tone === "primary" ? PRIMARY : line.tone === "selected" ? SELECTED : BASE);
      const opacity = (line: ChartLine) => emphasized(line) ? 1 : 0.5;
      const width = (line: ChartLine) => emphasized(line) ? 2.5 : 1.5;
      const markerSize = (line: ChartLine) => emphasized(line) ? 7 : 5;
      // Dwie serie na linię: kropki (wartości) i średnia 3M. Indeks serii = indeks śladu / 2.
      const traces = ordered.flatMap((line) => {
        const average = movingAverage(line.values);
        const custom = labels.map((label, i) => [label, line.name, line.detail ?? "", average[i] === null ? "—" : Math.round(average[i] as number).toLocaleString("pl-PL")]);
        const head = `<b>%{customdata[1]}</b><br>${line.detail ? "%{customdata[2]}<br>" : ""}%{customdata[0]}`;
        return [
          {
            type: "scatter", mode: "markers", name: line.name, legendgroup: line.key, showlegend: legend,
            x, y: line.values, customdata: custom,
            marker: { color: color(line), size: markerSize(line), line: { color: "#FFFFFF", width: 1 } },
            opacity: opacity(line),
            hovertemplate: `${head}: %{y:,.0f} ${valueLabel}<br>średnia 3M: %{customdata[3]}<extra></extra>`,
          },
          {
            type: "scatter", mode: "lines", name: `${line.name} · średnia 3M`, legendgroup: line.key, showlegend: false,
            x, y: average, customdata: custom, connectgaps: false,
            line: { color: color(line), width: width(line), shape: "spline", smoothing: 0.4 },
            opacity: opacity(line),
            hovertemplate: `${head}<br>średnia 3M: %{customdata[3]} ${valueLabel}<extra></extra>`,
          },
        ];
      });
      const plot = chartRef.current as PlotElement;
      await Plotly.react(plot, traces, {
        height: 400,
        autosize: true,
        margin: { l: 56, r: 16, t: legend ? 36 : 12, b: 44 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        separators: ", ",
        hovermode: "closest",
        showlegend: legend,
        legend: { orientation: "h", x: 0, y: 1.1, font: { size: 12 } },
        hoverlabel: { bgcolor: "#344054", font: { color: "#FFFFFF", size: 13 } },
        xaxis: { type: "date", tickformat: "%m.%Y", dtick: "M3", gridcolor: "#EEF1F5" },
        yaxis: { rangemode: "tozero", gridcolor: "#EEF1F5", zerolinecolor: "#D0D5DD", tickformat: ",.0f" },
      }, PLOTLY_CONFIG);
      if (cancelled || lines.length < 2) return;
      const all = (pick: (line: ChartLine, series: number) => number | string) => ordered.flatMap((line, series) => [pick(line, series), pick(line, series)]);
      plot.removeAllListeners?.("plotly_hover");
      plot.removeAllListeners?.("plotly_unhover");
      plot.on?.("plotly_hover", (event: PlotlyHoverEvent) => {
        const curve = event.points?.[0]?.curveNumber;
        if (curve === undefined) return;
        const active = Math.floor(curve / 2);
        void Plotly.restyle(plot, {
          opacity: all((line, i) => i === active ? 1 : line.tone === "selected" ? 0.6 : 0.12),
          "line.width": all((line, i) => i === active ? 3.5 : width(line)),
          "line.color": all((line, i) => i === active && !emphasized(line) ? line.accent ?? PRIMARY : color(line)),
          "marker.color": all((line, i) => i === active && !emphasized(line) ? line.accent ?? PRIMARY : color(line)),
          "marker.size": all((line, i) => i === active ? 8 : markerSize(line)),
        });
      });
      plot.on?.("plotly_unhover", () => {
        void Plotly.restyle(plot, {
          opacity: all(opacity), "line.width": all(width), "line.color": all(color), "marker.color": all(color), "marker.size": all(markerSize),
        });
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [months, lines, valueLabel, legend]);

  return <div ref={chartRef} role="img" aria-label={ariaLabel} />;
}
