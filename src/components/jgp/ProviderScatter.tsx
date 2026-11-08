"use client";

import { useEffect, useRef } from "react";
import { attachHoverMarker, axisTitle, baselineShape, chartLayout, makeHoverTrace, measureAxis, paddedRange, PLOTLY_CONFIG, referenceShape, type PlotElement, type PlotlyHoverEvent } from "@/lib/plotlyChart";
import { CHART_COLORS, BASE_POINT } from "@/lib/chartPalette";
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

/**
 * Znacznik wybranego ośrodka (DESIGN.md, 6.2a): „signal” — kolor sygnału, na wykresie bez skali odchylenia;
 * „graphite” — grafitowy punkt z białą obwódką, o połowę większy, z podpisem — na lejku (ciepłe kolory i błękity
 * są tam zajęte przez skalę odchylenia).
 */
export type SelectedMarker = "signal" | "graphite";
const POINT_SIZE = 9;
/** Podpis wybranego ośrodka na wykresie: nazwa skrócona do 32 znaków. */
const shortName = (name: string) => name.length > 32 ? `${name.slice(0, 31)}…` : name;

/** Linia tła wykresu, np. granica lejka. */
export interface ScatterCurve { x: number[]; y: number[]; color: string; dash?: "dot" | "dash" | "solid" }

/**
 * Wykres punktowy świadczeniodawców: punkt = ośrodek. Najechanie powiększa i podświetla punkt
 * (`attachHoverMarker`) i pokazuje nazwę i liczby; kliknięcie wybiera ośrodek na całej karcie.
 */
export function ProviderScatter({ points, xTitle, yTitle, ySuffix, reference, onSelect, ariaLabel, curves = [], height = 360, marker = "signal" }: {
  points: ScatterPoint[];
  xTitle: string;
  yTitle: string;
  ySuffix: string;
  reference?: { y: number; label: string };
  onSelect?: (key: string) => void;
  ariaLabel: string;
  curves?: ScatterCurve[];
  height?: number;
  /** Znacznik wybranego ośrodka: „signal” albo „graphite” (na lejku, z podpisem). */
  marker?: SelectedMarker;
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
          ? { color: colors[i] || BASE_POINT, size: colors[i] ? POINT_SIZE : 8, line: { color: "#FFFFFF", width: 1 } }
          : marker === "graphite"
            ? { color: CHART_COLORS.text, size: POINT_SIZE * 1.5, line: { color: "#FFFFFF", width: 2.5 } }
            : { color: CHART_COLORS.signal, size: 13, line: { color: "#FFFFFF", width: 2 } },
        hovertemplate: "%{customdata[1]}<extra></extra>",
      }))];
      // Znacznik najechanego punktu: ta sama seria i mechanizm co na wykresach eksploratora.
      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());
      // Ten sam margines na obu osiach (−6% / +10%): punkty na zerze nie leżą na krawędzi.
      // Granice lejka mogą podnieść oś, ale najwyżej do 1,6 × maksimum punktów.
      const xMax = Math.max(...points.map((p) => p.x), 1);
      const yMax = Math.max(...points.map((p) => p.y), reference?.y ?? 0, 1);
      const curveMax = Math.max(0, ...curves.flatMap((curve) => curve.y));
      const plot = chartRef.current as PlotElement;
      // Podpis wybranego ośrodka przy punkcie (grafit na lejku): po stronie z większym miejscem.
      const selected = marker === "graphite" ? points.find((p) => p.selected) : undefined;
      const selectedLabel = selected ? [{
        x: selected.x, y: selected.y, text: shortName(selected.name), showarrow: false,
        xanchor: selected.x > xMax * 0.6 ? "right" : "left", xshift: selected.x > xMax * 0.6 ? -12 : 12,
        font: { size: 12, color: CHART_COLORS.text }, bgcolor: "rgba(255,255,255,0.85)",
      }] : [];
      await Plotly.react(plot, traces, {
        ...chartLayout(),
        height,
        autosize: true,
        margin: { l: 56, r: 16, t: 12, b: 52 },
        showlegend: false,
        xaxis: measureAxis({ title: axisTitle(xTitle), range: paddedRange([xMax]), tickformat: ",.0f" }),
        yaxis: measureAxis({ title: axisTitle(yTitle), range: paddedRange([yMax, Math.min(curveMax, yMax * 1.6)]), ticksuffix: ySuffix }),
        shapes: [baselineShape("y"), baselineShape("x"), ...(reference ? [referenceShape(reference.y)] : [])],
        annotations: [
          ...(reference ? [{ xref: "paper", x: 1, y: reference.y, xanchor: "right", yanchor: "bottom", showarrow: false, text: reference.label, font: { size: 12, color: CHART_COLORS.textSecondary } }] : []),
          ...selectedLabel,
        ],
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
