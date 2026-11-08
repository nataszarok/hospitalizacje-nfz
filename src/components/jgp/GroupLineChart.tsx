"use client";

import { useEffect, useRef } from "react";
import { monthYears, movingAverage, movingRatio, ratioSeries, sumByYear, type ChartPeriod } from "@/lib/jgpCard";
import { baselineShape, categoryAxis, chartLayout, countAxis, makeHoverTrace, measureAxis, monthAxis, percentAxis, PLOTLY_CONFIG, wrapChartLabel, type PlotElement } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";
import { CHART_COLORS } from "@/lib/chartPalette";

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const BASE = CHART_COLORS.borderStrong;
const PRIMARY = CHART_COLORS.data;
const SELECTED = CHART_COLORS.signal;
// Tło wybranego roku (jak „wybrany rok” w makietach karty); to samo tło ma kolumna roku w mapie ciepła (.heatBand).
const YEAR_BAND = "rgba(31, 138, 112, 0.10)";
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

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
  /** Cienka, półprzezroczysta linia w kolorze `color` (np. ośrodki wybranych województw). */
  thin?: boolean;
  /** Mianownik (np. hospitalizacje miesięcznie): wykres pokazuje `values / base` w procentach. */
  base?: number[];
}

/**
 * Punkty (wartość miesiąca) i linia (średnia 3M) serii; dla udziału: procent miesiąca i procent z 3 miesięcy.
 * Lata: punkt = suma roku (udział z sum roku), linia łączy punkty.
 */
function seriesOf(line: ChartLine, period: ChartPeriod) {
  const points = line.base ? ratioSeries(line.values, line.base) : line.values as (number | null)[];
  if (period === "year") return { points, average: points };
  return { points, average: line.base ? movingRatio(line.values, line.base) : movingAverage(line.values) };
}

/** Seria zsumowana w latach (wartości i mianownik). */
const yearlyLine = (line: ChartLine, months: string[]): ChartLine => ({ ...line, values: sumByYear(months, line.values), base: line.base ? sumByYear(months, line.base) : undefined });

/**
 * Wykres miesięcy: kropka = wartość w miesiącu, linia = średnia krocząca z 3 miesięcy (3M MA;
 * na początku serii średnia z dostępnych miesięcy).
 * Najechanie: wskazana kropka rośnie i zmienia kolor (osobna seria-znacznik, jak w `attachHoverMarker`),
 * a cała seria ośrodka jest rysowana na wierzchu w jego kolorze. Zmieniamy tylko serie nakładki.
 * Wszystkie serie są typu `scattergl` (jak w eksploratorze): `restyle` serii SVG w trakcie najechania
 * przerysowuje dymek podpowiedzi, wywołuje kolejne najechanie i przepełnia stos.
 */
export function GroupLineChart({ months, lines, valueLabel, ariaLabel, legend = false, onSelect, onHover, height = 400, selectedColor = SELECTED, selectedLabel, hoverSelectedOnly = false, highlightYear, note, fitAxis = false, period = "month" }: {
  /** Miesiące jako „RRRR-MM”. */
  months: string[];
  /** „year”: suma każdego roku zamiast miesięcy (te same wymiary wykresu). */
  period?: ChartPeriod;
  /** Oś udziału dopasowana do danych, nie od zera (np. % nagłych w okolicy 85–95%). */
  fitAxis?: boolean;
  lines: ChartLine[];
  valueLabel: string;
  ariaLabel: string;
  /** Legenda z nazwami serii (np. województwa). */
  legend?: boolean;
  /** Kliknięcie linii albo kropki: klucz serii (np. wybór ośrodka). */
  onSelect?: (key: string) => void;
  /** Najechanie na serię i zjechanie z wykresu (`null`). */
  onHover?: (key: string | null) => void;
  height?: number;
  /** Kolor linii wybranego ośrodka (domyślnie kolor sygnału). */
  selectedColor?: string;
  /** Podpis na końcu linii wybranego ośrodka (nazwa; długa w kilku liniach). */
  selectedLabel?: string;
  /** Gdy jest wybrany ośrodek, dymek i najechanie działają tylko na jego linii. */
  hoverSelectedOnly?: boolean;
  /** Rok wyróżniony tłem (jak pasek „wybrany rok” w dokumencie karty), np. rok wybrany na karcie. */
  highlightYear?: string;
  /** Objaśnienie pod osią X, wewnątrz wykresu (zamiast osobnego akapitu pod nim). */
  note?: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  // Funkcje z rodzica trzymamy w refach: nowa funkcja po rerenderze nie przerysowuje wykresu.
  const selectRef = useRef(onSelect);
  const hoverRef = useRef(onHover);
  useEffect(() => { selectRef.current = onSelect; hoverRef.current = onHover; });

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      const yearly = period === "year";
      const { years, monthCounts } = monthYears(months);
      // Rok niepełny (np. pierwszy rok kodu w katalogu) ma w podpowiedzi liczbę miesięcy.
      const labels = yearly
        ? years.map((year, i) => monthCounts[i] < 12 ? `${year} (${monthCounts[i]} mies.)` : year)
        : months.map((month) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`);
      // Punkt roku w połowie roku: tło wybranego roku i podpisy osi są te same co w trybie miesięcy.
      const x = yearly ? years.map((year) => `${year}-07-01`) : months.map((month) => `${month}-01`);
      // Wybrany szpital rysujemy na końcu, żeby był nad innymi seriami.
      const ordered = [...lines.filter((line) => line.tone !== "selected"), ...lines.filter((line) => line.tone === "selected")].map((line) => yearly ? yearlyLine(line, months) : line);
      const emphasized = (line: ChartLine) => Boolean(line.tone || line.color) && !line.thin;
      const color = (line: ChartLine) => line.tone === "selected" ? selectedColor : line.color ?? (line.tone === "primary" ? PRIMARY : BASE);
      const opacity = (line: ChartLine) => emphasized(line) ? 1 : 0.5;
      const width = (line: ChartLine) => emphasized(line) ? 2.5 : 1.5;
      const markerSize = (line: ChartLine) => (emphasized(line) ? 7 : 5) + (yearly ? 2 : 0);
      const percent = ordered.some((line) => line.base);
      const series = new Map(ordered.map((line) => [line.key, seriesOf(line, period)]));
      const hasSelected = ordered.some((line) => line.tone === "selected");
      const hoverable = (line: ChartLine) => !hoverSelectedOnly || !hasSelected || line.tone === "selected";
      const shown = (value: number | null) => value === null ? "—" : percent ? `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : Math.round(value).toLocaleString("pl-PL");
      // Dwie serie na linię: kropki (wartości) i średnia 3M. Indeks serii = indeks śladu / 2.
      const traces = ordered.flatMap((line) => {
        const { points, average } = series.get(line.key)!;
        const custom = labels.map((label, i) => [label, wrapChartLabel(line.name), line.detail ?? "", shown(average[i]), integer(line.values[i]), integer(line.base?.[i] ?? 0)]);
        const head = `<b>%{customdata[1]}</b><br>${line.detail ? "%{customdata[2]}<br>" : ""}%{customdata[0]}`;
        // Udział: procent z liczbami, z których powstał (np. „2,4% (3 z 125 hosp.)”).
        const value = percent ? `%{y:.1f}% (%{customdata[4]} ${valueLabel} z %{customdata[5]} hosp.)` : `%{y:,.0f} ${valueLabel}`;
        return [
          {
            type: "scattergl", mode: "markers", name: line.name, legendgroup: line.key, showlegend: legend,
            x, y: points, customdata: custom,
            marker: { color: color(line), size: markerSize(line), line: { color: "#FFFFFF", width: 1 } },
            opacity: opacity(line),
            hovertemplate: `${head}: ${value}${yearly ? "" : "<br>średnia 3M: %{customdata[3]}"}<extra></extra>`,
            ...(hoverable(line) ? {} : { hoverinfo: "skip" }),
          },
          {
            type: "scattergl", mode: "lines", name: yearly ? line.name : `${line.name} · średnia 3M`, legendgroup: line.key, showlegend: false,
            x, y: average, customdata: custom, connectgaps: false,
            line: { color: color(line), width: width(line) },
            opacity: opacity(line),
            hovertemplate: yearly ? `${head}: ${value}<extra></extra>` : `${head}<br>średnia 3M: %{customdata[3]}${percent ? "" : ` ${valueLabel}`}<extra></extra>`,
            ...(hoverable(line) ? {} : { hoverinfo: "skip" }),
          },
        ];
      });
      // Nakładka: wyróżniona seria (kropki + średnia) i znacznik wskazanego punktu. Na start puste.
      const overlayStart = traces.length;
      const empty = { x: [null], y: [null] };
      traces.push(
        { type: "scattergl", mode: "lines", ...empty, showlegend: false, hoverinfo: "skip", line: { color: PRIMARY, width: 3.5 } } as never,
        { type: "scattergl", mode: "markers", ...empty, showlegend: false, hoverinfo: "skip", marker: { color: PRIMARY, size: 8, line: { color: "#FFFFFF", width: 1 } } } as never,
        makeHoverTrace() as never,
      );
      const plot = chartRef.current as PlotElement;
      // Objaśnienie pod osią: na wąskim ekranie w dwóch wierszach (adnotacje Plotly nie zawijają tekstu).
      const noteText = note && plot.clientWidth < 640 ? note.replace(/\. /, ".<br>") : note;
      const noteLines = noteText ? noteText.split("<br>").length : 0;
      const allPoints = ordered.flatMap((line) => series.get(line.key)!.points);
      const yAxis = percent ? percentAxis(allPoints, { fit: fitAxis }) : countAxis(allPoints);
      await Plotly.react(plot, traces, {
        ...chartLayout(),
        height,
        autosize: true,
        margin: { l: 56, r: 16, t: legend ? 36 : 12, b: 44 + noteLines * 16 },
        showlegend: legend,
        legend: { orientation: "h", x: 0, y: 1.1, font: { size: 12 } },
        // Tło wybranego roku: od 1 stycznia do końca grudnia (pół miesiąca zapasu po obu stronach kropek).
        // Podstawa (zero) pod danymi, gdy zero jest w zakresie osi.
        shapes: [
          ...(highlightYear && months.some((month) => month.startsWith(highlightYear)) ? [{
            type: "rect", xref: "x", yref: "paper", layer: "below",
            x0: `${Number(highlightYear) - 1}-12-16`, x1: `${highlightYear}-12-16`, y0: 0, y1: 1,
            fillcolor: YEAR_BAND, line: { width: 0 },
          }] : []),
          ...(yAxis.range[0] <= 0 ? [baselineShape("y")] : []),
        ],
        // Podpis wybranego ośrodka przy ostatnim punkcie jego średniej 3M.
        annotations: (() => {
          const line = selectedLabel ? ordered.find((item) => item.tone === "selected") : undefined;
          const last = line ? series.get(line.key)!.average.at(-1) : null;
          const label = line && last !== null && last !== undefined ? [{ x: x.at(-1), y: last, text: wrapChartLabel(selectedLabel!), xanchor: "right", yanchor: "bottom", align: "right", showarrow: false, font: { size: 12, color: selectedColor }, bgcolor: "rgba(255,255,255,0.85)" }] : [];
          const explain = noteText ? [{ xref: "paper", yref: "paper", x: 0, y: 0, yshift: -40, xanchor: "left", yanchor: "top", align: "left", showarrow: false, text: noteText, font: { size: 12, color: CHART_COLORS.textTertiary } }] : [];
          return [...label, ...explain];
        })(),
        // Lata: podpis roku na środku roku (pod punktem), zakres od stycznia pierwszego do grudnia ostatniego roku.
        // Oś lat to kategorie (bez siatki); oś miesięcy ma siatkę tylko na granicy roku (podziałka co rok, DESIGN.md 6.1).
        xaxis: yearly
          ? categoryAxis({ type: "date", tickformat: "%Y", dtick: "M12", tick0: "2000-01-01", ticklabelmode: "period", range: [`${years[0]}-01-01`, `${years.at(-1)}-12-31`] })
          : measureAxis({ ...monthAxis(x.length), ...(x.length > 72 ? {} : { showgrid: false }) }),
        // Margines pod zerem i całkowita podziałka także przy bardzo małych liczbach (np. pojedyncze zgony).
        yaxis: measureAxis(yAxis),
      }, PLOTLY_CONFIG);
      if (cancelled) return;
      const overlay = [overlayStart, overlayStart + 1, overlayStart + 2];
      plot.removeAllListeners("plotly_hover");
      plot.removeAllListeners("plotly_unhover");
      plot.removeAllListeners("plotly_click");
      plot.on("plotly_click", (event) => {
        const point = event?.points?.[0];
        if (!point || point.curveNumber >= overlayStart) return;
        selectRef.current?.(ordered[Math.floor(point.curveNumber / 2)].key);
      });
      let restyleInProgress = false;
      plot.on("plotly_hover", (event) => {
        const point = event?.points?.[0];
        if (restyleInProgress || !point || point.curveNumber >= overlayStart) return;
        const line = ordered[Math.floor(point.curveNumber / 2)];
        hoverRef.current?.(line.key);
        const highlight = line.tone === "selected" ? selectedColor : line.color ?? line.accent ?? PRIMARY;
        // Kropka wskazanego miesiąca (także przy najechaniu na linię średniej).
        const { points, average } = series.get(line.key)!;
        const y = points[point.pointNumber] ?? null;
        restyleInProgress = true;
        void Plotly.restyle(plot, {
          x: [x, x, [point.x]],
          y: [average, points, [y]],
          "line.color": [highlight, highlight, "#FFFFFF"],
          "marker.color": [highlight, highlight, CHART_COLORS.text],
        }, overlay);
        restyleInProgress = false;
      });
      plot.on("plotly_unhover", () => {
        if (restyleInProgress) return;
        hoverRef.current?.(null);
        restyleInProgress = true;
        void Plotly.restyle(plot, { x: [[null], [null], [null]], y: [[null], [null], [null]] }, overlay);
        restyleInProgress = false;
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [months, lines, valueLabel, legend, height, selectedColor, selectedLabel, hoverSelectedOnly, highlightYear, note, fitAxis, period]);

  // Wysokość zarezerwowana od razu: wykres rysuje się asynchronicznie i nie przesuwa treści pod nim.
  return <div ref={chartRef} role="img" aria-label={ariaLabel} style={{ minHeight: height }} />;
}
