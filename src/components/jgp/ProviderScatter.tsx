"use client";

import { useEffect, useRef, useState } from "react";
import { usePlotResize } from "@/lib/usePlotResize";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { attachHoverMarker, axisTitle, baselineShape, chartLayout, makeHoverTrace, measureAxis, paddedRange, PLOTLY_CONFIG, referenceShape, type PlotElement, type PlotlyHoverEvent } from "@/lib/plotlyChart";
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
 * Wybrany ośrodek (DESIGN.md, 6.2a): gwiazda w kolorze sygnału z białą obwódką, ponad dwa razy większa od punktu,
 * bez podpisu (nazwa jest w legendzie i w dymku). Ten sam znak na każdym wykresie punktowym, także na lejku.
 */
const POINT_SIZE = 9;
const STAR_SIZE = 20;
/**
 * Punkt powyżej skali osi Y (`yCap`): szary trójkąt na górnej krawędzi wykresu, wielkości zwykłego punktu.
 * Plotly rysuje trójkąt o rozmiarze `size` niższy od koła (1,5 promienia zamiast 2), więc rozmiar mnożymy przez 4/3.
 */
const ABOVE_SYMBOL = "triangle-up";
const ABOVE_COLOR = CHART_COLORS.borderStrong;
const ABOVE_SCALE = 4 / 3;
/**
 * Od tylu punktów wykres jest gęsty: punkty mają cienką, półprzezroczystą obwódkę i są lekko przezroczyste.
 * Pełne białe obwódki nakładających się punktów tworzyłyby białe plamy (np. setki ośrodków przy zerowej śmiertelności).
 */
export const DENSE_POINTS = 100;
const DENSE_OUTLINE = { color: "rgba(255, 255, 255, 0.55)", width: 0.5 };

/** Linia tła wykresu, np. granica lejka. */
export interface ScatterCurve { x: number[]; y: number[]; color: string; dash?: "dot" | "dash" | "solid" }
// Stała pusta lista: nowa tablica przy każdym renderze rysowałaby wykres od nowa (i chowała dymek).
export const NO_CURVES: ScatterCurve[] = [];

/**
 * Wykres punktowy świadczeniodawców: punkt = ośrodek. Najechanie powiększa i podświetla punkt
 * (`attachHoverMarker`) i pokazuje dymek HTML (`ChartTooltip`): całą nazwę i liczby. Pozycję dymka liczy `placeTooltip`
 * z prostokąta punktu, więc dymek nie zasłania punktu i może wyjść poza wykres (DESIGN.md, 6.3).
 * Kliknięcie wybiera ośrodek na całej karcie.
 */
export function ProviderScatter({ points, xTitle, yTitle, ySuffix, reference, onSelect, ariaLabel, curves = NO_CURVES, height = 360, yCap, modeBar = true }: {
  points: ScatterPoint[];
  xTitle: string;
  yTitle: string;
  ySuffix: string;
  reference?: { y: number; label: string };
  onSelect?: (key: string) => void;
  ariaLabel: string;
  curves?: ScatterCurve[];
  height?: number;
  /**
   * Koniec skali osi Y (np. z `outlierCap`): punkty wyżej stoją na górnej krawędzi jako trójkąt,
   * dymek pokazuje ich prawdziwą wartość. Jeden mały ośrodek (1 hospitalizacja, 1 zgon = 100%) nie spłaszcza wtedy wykresu.
   */
  yCap?: number | null;
  /** Pasek narzędzi Plotly; bez niego, gdy wykres ma przycisk powiększenia (`ChartExpand`) w tym samym rogu. */
  modeBar?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  usePlotResize(chartRef);
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
      const above = (p: ScatterPoint) => yCap != null && p.y > yCap;
      const shownY = (p: ScatterPoint) => (above(p) ? yCap! : p.y);
      const dense = points.length >= DENSE_POINTS;
      const traces: Record<string, unknown>[] = [...lineTraces, ...groups.map((group, i) => {
        const own = i === groups.length - 1;
        return {
          type: "scattergl",
          mode: "markers",
          x: group.map((p) => p.x),
          y: group.map(shownY),
          customdata: group.map((p) => [p.key]),
          marker: own
            ? { color: CHART_COLORS.signal, size: STAR_SIZE, symbol: "star", line: { color: "#FFFFFF", width: 1.5 } }
            : (() => {
              const color = colors[i] || BASE_POINT;
              const size = colors[i] ? POINT_SIZE : 8;
              const base = dense
                ? { color, size, opacity: 0.85, line: DENSE_OUTLINE }
                : { color, size, line: { color: "#FFFFFF", width: 1 } };
              if (!group.some(above)) return base;
              return {
                ...base,
                color: group.map((p) => (above(p) ? ABOVE_COLOR : color)),
                size: group.map((p) => (above(p) ? Math.round(size * ABOVE_SCALE) : size)),
                symbol: group.map((p) => (above(p) ? ABOVE_SYMBOL : "circle")),
              };
            })(),
          // Dymek rysuje `ChartTooltip`; Plotly zgłasza tylko najechanie.
          hoverinfo: "none",
        };
      })];
      // Znacznik najechanego punktu: ta sama seria i mechanizm co na wykresach eksploratora.
      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());
      // Ten sam margines na obu osiach (−6% / +10%): punkty na zerze nie leżą na krawędzi.
      // Granice lejka mogą podnieść oś, ale najwyżej do 1,6 × maksimum punktów.
      const xMax = Math.max(...points.map((p) => p.x), 1);
      const yMax = Math.max(...points.map(shownY), reference?.y ?? 0, 1);
      const curveMax = Math.max(0, ...curves.flatMap((curve) => curve.y));
      const plot = chartRef.current as PlotElement;
      // Linia odniesienia (np. średnia grupy) tylko powyżej zera: na zerze pokrywa się z podstawą.
      const line = reference && reference.y > 0 ? reference : null;
      await Plotly.react(plot, traces, {
        ...chartLayout(),
        height,
        autosize: true,
        margin: { l: 56, r: 16, t: 12, b: 52 },
        showlegend: false,
        xaxis: measureAxis({ title: axisTitle(xTitle), range: paddedRange([xMax]), tickformat: ",.0f" }),
        yaxis: measureAxis({ title: axisTitle(yTitle), range: paddedRange([yMax, Math.min(curveMax, yCap ?? yMax * 1.6)]), ticksuffix: ySuffix }),
        shapes: [baselineShape("y"), baselineShape("x"), ...(line ? [referenceShape(line.y)] : [])],
        annotations: [
          ...(line ? [{ xref: "paper", x: 1, y: line.y, xanchor: "right", yanchor: "bottom", showarrow: false, text: line.label, font: { size: 12, color: CHART_COLORS.textSecondary } }] : []),
        ],
      }, modeBar ? PLOTLY_CONFIG : { ...PLOTLY_CONFIG, displayModeBar: false });
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
        const anchor = point ? plotlyDataBox(plot, point.x, shownY(point), size) : null;
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
  }, [points, xTitle, yTitle, ySuffix, reference, curves, height, yCap, modeBar]);

  // Wysokość zarezerwowana od razu (wykres rysuje się asynchronicznie).
  return <div ref={shellRef} style={{ position: "relative" }}>
    <div ref={chartRef} role="img" aria-label={ariaLabel} style={{ minHeight: height }} />
    {hover ? <ChartTooltip anchor={hover.anchor} container={shellRef}>
      <TooltipHead title={hover.point.name} context={hover.point.lines[0]} />
      {hover.point.lines.length > 1 ? <TooltipLines lines={hover.point.lines.slice(1)} /> : null}
    </ChartTooltip> : null}
  </div>;
}
