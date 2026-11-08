"use client";

import { useEffect, useRef, useState } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { attachHoverMarker, axisTitle, baselineShape, chartLayout, makeHoverTrace, measureAxis, paddedRange, PLOTLY_CONFIG, referenceShape, wrapChartLabel, type PlotElement, type PlotlyHoverEvent } from "@/lib/plotlyChart";
import { CHART_COLORS, BASE_POINT } from "@/lib/chartPalette";
import { loadPlotly } from "@/lib/plotlyLoader";
import { plotlyDataBox, type Box } from "@/lib/tooltipPosition";

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
 * Znacznik wybranego ośrodka (DESIGN.md, 6.2a): gwiazda, dwa razy większa od punktu. „signal” — w kolorze sygnału,
 * na wykresie bez skali odchylenia; „graphite” — grafitowa z białą obwódką i z podpisem — na lejku (ciepłe kolory
 * i błękity są tam zajęte przez skalę odchylenia).
 */
export type SelectedMarker = "signal" | "graphite";
const POINT_SIZE = 9;
const STAR_SIZE = 20;

/** Linia tła wykresu, np. granica lejka. */
export interface ScatterCurve { x: number[]; y: number[]; color: string; dash?: "dot" | "dash" | "solid" }
// Stała pusta lista: nowa tablica przy każdym renderze rysowałaby wykres od nowa (i chowała dymek).
const NO_CURVES: ScatterCurve[] = [];

/**
 * Wykres punktowy świadczeniodawców: punkt = ośrodek. Najechanie powiększa i podświetla punkt
 * (`attachHoverMarker`) i pokazuje dymek HTML (`ChartTooltip`): całą nazwę i liczby. Pozycję dymka liczy `placeTooltip`
 * z prostokąta punktu, więc dymek nie zasłania punktu i może wyjść poza wykres (DESIGN.md, 6.3).
 * Kliknięcie wybiera ośrodek na całej karcie.
 */
export function ProviderScatter({ points, xTitle, yTitle, ySuffix, reference, onSelect, ariaLabel, curves = NO_CURVES, height = 360, marker = "signal" }: {
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
  const shellRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ point: ScatterPoint; anchor: Box } | null>(null);
  // Funkcję z rodzica trzymamy w refie: nowa funkcja po rerenderze nie przerysowuje wykresu.
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; });

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
        customdata: group.map((p) => [p.key]),
        marker: i < groups.length - 1
          ? { color: colors[i] || BASE_POINT, size: colors[i] ? POINT_SIZE : 8, line: { color: "#FFFFFF", width: 1 } }
          : marker === "graphite"
            ? { color: CHART_COLORS.text, size: STAR_SIZE, symbol: "star", line: { color: "#FFFFFF", width: 1.5 } }
            : { color: CHART_COLORS.signal, size: STAR_SIZE, symbol: "star", line: { color: "#FFFFFF", width: 1 } },
        // Dymek rysuje `ChartTooltip`; Plotly zgłasza tylko najechanie.
        hoverinfo: "none",
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
      // Podpis wybranego ośrodka przy punkcie (grafit na lejku): po stronie z większym miejscem, długa nazwa w kilku liniach.
      const selected = marker === "graphite" ? points.find((p) => p.selected) : undefined;
      const selectedLabel = selected ? [{
        x: selected.x, y: selected.y, text: wrapChartLabel(selected.name), showarrow: false, align: selected.x > xMax * 0.6 ? "right" : "left",
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
      // Nowe punkty: dymek starego punktu znika.
      setHover(null);
      attachHoverMarker({ plot, Plotly, traces, hoverTraceIndex });
      const pointStart = lineTraces.length;
      plot.on("plotly_hover", (event: PlotlyHoverEvent) => {
        const hovered = event.points?.[0];
        if (!hovered || hovered.curveNumber < pointStart || hovered.curveNumber >= hoverTraceIndex) return;
        const point = groups[hovered.curveNumber - pointStart]?.[hovered.pointNumber];
        // Prostokąt znacznika najechanego punktu (`attachHoverMarker`: rozmiar punktu + 4 px, co najmniej 13 px).
        const size = Math.max(13, (point?.selected ? STAR_SIZE : POINT_SIZE) + 4);
        const anchor = point ? plotlyDataBox(plot, point.x, point.y, size) : null;
        if (point && anchor) setHover({ point, anchor });
      });
      plot.on("plotly_unhover", () => setHover(null));
      plot.removeAllListeners?.("plotly_click");
      plot.on?.("plotly_click", (event: PlotlyHoverEvent) => {
        const point = event.points?.[0] as { customdata?: string[] } | undefined;
        const key = point?.customdata?.[0];
        if (key) selectRef.current?.(key);
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [points, xTitle, yTitle, ySuffix, reference, curves, height, marker]);

  // Wysokość zarezerwowana od razu (wykres rysuje się asynchronicznie).
  return <div ref={shellRef} style={{ position: "relative" }}>
    <div ref={chartRef} role="img" aria-label={ariaLabel} style={{ minHeight: height }} />
    {hover ? <ChartTooltip anchor={hover.anchor} container={shellRef}>
      <TooltipHead title={hover.point.name} context={hover.point.lines[0]} />
      {hover.point.lines.length > 1 ? <TooltipLines lines={hover.point.lines.slice(1)} /> : null}
    </ChartTooltip> : null}
  </div>;
}
