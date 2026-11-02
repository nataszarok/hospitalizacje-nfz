"use client";

import { useEffect, useRef } from "react";
import { attachHoverMarker, getAppFontFamily, makeHoverTrace, PLOTLY_CONFIG, type PlotElement, type PlotlyHoverEvent } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";

export interface ScatterPoint {
  key: string;
  name: string;
  /** Linie podpowiedzi pod nazwą. */
  lines: string[];
  x: number;
  y: number;
  selected?: boolean;
  /** Własny kolor punktu (np. ośrodek poza granicą lejka). */
  color?: string;
}

/** Kolor wybranego ośrodka w trybie gwiazdki: spoza palety województw i lejka. */
export const STAR_COLOR = "#D92D20";
/** Obwódka gwiazdki: cienka biała. */
const STAR_OUTLINE = "#FFFFFF";

/** Linia tła wykresu, np. granica lejka. */
export interface ScatterCurve { x: number[]; y: number[]; color: string; dash?: "dot" | "dash" | "solid" }

/**
 * Wykres punktowy świadczeniodawców: punkt = ośrodek. Najechanie powiększa i podświetla punkt
 * (`attachHoverMarker`) i pokazuje nazwę i liczby; kliknięcie wybiera ośrodek na całej karcie.
 */
export function ProviderScatter({ points, xTitle, yTitle, ySuffix, reference, onSelect, ariaLabel, curves = [], height = 360, marker = "dot" }: {
  points: ScatterPoint[];
  xTitle: string;
  yTitle: string;
  ySuffix: string;
  reference?: { y: number; label: string };
  onSelect?: (key: string) => void;
  ariaLabel: string;
  curves?: ScatterCurve[];
  height?: number;
  /** Znacznik wybranego ośrodka: „dot” (większa pomarańczowa kropka) albo „star” (czerwona gwiazdka; opis tylko w podpowiedzi). */
  marker?: "dot" | "star";
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      // Punkty bez wyboru grupujemy według koloru; wybrany ośrodek zawsze na końcu (na wierzchu).
      const colors = [...new Set(points.filter((p) => !p.selected).map((p) => p.color ?? ""))];
      const groups = [...colors.map((color) => points.filter((p) => !p.selected && (p.color ?? "") === color)), points.filter((p) => p.selected)];
      const lineTraces: Record<string, unknown>[] = curves.map((curve) => ({
        type: "scattergl", mode: "lines", x: curve.x, y: curve.y, hoverinfo: "skip", showlegend: false,
        line: { color: curve.color, width: 1.2, dash: curve.dash ?? "dash" },
      }));
      // scattergl jak w eksploratorze: `restyle` znacznika na serii SVG zapętla najechanie.
      const traces: Record<string, unknown>[] = [...lineTraces, ...groups.map((group, i) => ({
        type: "scattergl",
        mode: "markers",
        x: group.map((p) => p.x),
        y: group.map((p) => p.y),
        customdata: group.map((p) => [p.key, `<b>${p.name}</b><br>${p.lines.join("<br>")}`]),
        marker: i < groups.length - 1
          ? { color: colors[i] || "rgba(40, 86, 163, 0.55)", size: colors[i] ? 9 : 8, line: { color: "#FFFFFF", width: 1 } }
          : marker === "star"
            ? { color: STAR_COLOR, size: 18, symbol: "star", line: { color: STAR_OUTLINE, width: 1.5 } }
            : { color: "#C65D2E", size: 13, line: { color: "#FFFFFF", width: 2 } },
        hovertemplate: "%{customdata[1]}<extra></extra>",
      }))];
      // Znacznik najechanego punktu: ta sama seria i mechanizm co na wykresach eksploratora.
      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());
      // Margines pod zerem i nad maksimum: punkty dokładnie na 0 nie są ucinane.
      const xMax = Math.max(...points.map((p) => p.x), 1);
      const yMax = Math.max(...points.map((p) => p.y), reference?.y ?? 0, 1);
      const curveMax = Math.max(0, ...curves.flatMap((curve) => curve.y));
      const plot = chartRef.current as PlotElement;
      await Plotly.react(plot, traces, {
        height,
        autosize: true,
        margin: { l: 56, r: 16, t: 12, b: 52 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        separators: ", ",
        hovermode: "closest",
        showlegend: false,
        hoverlabel: { bgcolor: "#344054", font: { color: "#FFFFFF", size: 13 }, align: "left" },
        xaxis: { title: { text: xTitle }, range: [-xMax * 0.03, xMax * 1.05], gridcolor: "#EEF1F5", zerolinecolor: "#D0D5DD", tickformat: ",.0f" },
        yaxis: { title: { text: yTitle }, range: [-yMax * 0.06, Math.max(yMax * 1.08, Math.min(curveMax, yMax * 1.6))], gridcolor: "#EEF1F5", zerolinecolor: "#D0D5DD", ticksuffix: ySuffix },
        shapes: reference ? [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: reference.y, y1: reference.y, line: { color: "#667085", width: 1, dash: "dot" } }] : [],
        annotations: reference ? [{ xref: "paper", x: 1, y: reference.y, xanchor: "right", yanchor: "bottom", showarrow: false, text: reference.label, font: { size: 11, color: "#667085" } }] : [],
      }, PLOTLY_CONFIG);
      if (cancelled) return;
      attachHoverMarker({ plot, Plotly, traces, hoverTraceIndex });
      if (!onSelect) return;
      plot.removeAllListeners?.("plotly_click");
      plot.on?.("plotly_click", (event: PlotlyHoverEvent) => {
        const point = event.points?.[0] as { customdata?: string[] } | undefined;
        const key = point?.customdata?.[0];
        if (key) onSelect(key);
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [points, xTitle, yTitle, ySuffix, reference, onSelect, curves, height, marker]);

  // Wysokość zarezerwowana od razu (wykres rysuje się asynchronicznie).
  return <div ref={chartRef} role="img" aria-label={ariaLabel} style={{ minHeight: height }} />;
}
