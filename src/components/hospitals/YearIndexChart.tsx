"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { CHART_COLORS } from "@/lib/chartPalette";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import { useElementWidth } from "@/lib/useElementWidth";
import styles from "./HospitalFinance.module.css";

/** Linia indeksu: nazwa, wartości w latach (`null` = przerwa), styl: szpital (ciągła z punktami) albo odniesienie (kropkowana / przerywana). */
export interface IndexLine { key: string; label: string; values: (number | null)[]; tone: "primary" | "reference" | "context" }

/**
 * Szerokość rysunku przed pomiarem (px). Wykres rysujemy w szerokości kontenera (1 jednostka = 1 px), więc napisy
 * mają ten sam rozmiar co w wykresach Plotly (12 px) także na telefonie; bez skalowania całego SVG w dół.
 */
const DEFAULT_WIDTH = 980;
/** Najmniejszy odstęp między podpisami lat (px): przy węższym kroku podpis co 2. (3.…) rok, zawsze ostatni i wybrany. */
const YEAR_LABEL_GAP = 36;
/** Czy pokazać podpis roku `y` przy kroku `step` px. */
export const showYearLabel = (y: number, count: number, selected: number, step: number) => {
  const every = Math.max(1, Math.ceil(YEAR_LABEL_GAP / step));
  if (every === 1 || y === selected) return true;
  return (count - 1 - y) % every === 0 && (selected < 0 || Math.abs(y - selected) >= every);
};
const BASE_MARGIN = { left: 48, right: 64, top: 16, bottom: 30 };
/** Krok osi indeksu (punkty), linia bazy = 100. */
const TICK = 50;
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const STROKES: Record<IndexLine["tone"], { color: string; width: number; dash?: string }> = {
  primary: { color: CHART_COLORS.data, width: 2.5 },
  reference: { color: CHART_COLORS.textSecondary, width: 2, dash: "2 4" },
  context: { color: CHART_COLORS.borderStrong, width: 1.5, dash: "6 4" },
};

/** Zakres osi: od wielokrotności 50 nie większej niż minimum (i 100) do wielokrotności 50 nie mniejszej niż maksimum. */
export function indexAxis(values: readonly number[]): { min: number; max: number } {
  const all = [...values, 100];
  return { min: Math.floor(Math.min(...all) / TICK) * TICK, max: Math.ceil(Math.max(...all) / TICK) * TICK };
}

/**
 * Indeks w latach (pierwszy rok = 100): szpital i linie odniesienia na wspólnej osi lat. Linia bazy 100, wybrany rok na tle pasma,
 * kliknięcie roku zmienia rok karty, dymek z wartościami roku (`tooltipLines` — własne wiersze dymka, np. kwota i zmiana r/r).
 * Na końcu linii ostatnia wartość. `selected` < 0: rok karty poza osią (bez pasma).
 */
export function YearIndexChart({ years, lines, selected, onYear, ariaLabel, context, tooltipLines, height = 280 }: {
  years: string[]; lines: IndexLine[]; selected: number; onYear: (year: string) => void; ariaLabel: string; context: string;
  tooltipLines?: (y: number) => ReactNode[]; height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { ref: measureRef, width } = useElementWidth();
  const WIDTH = width || DEFAULT_WIDTH;
  // Wąski wykres: mniejszy margines na wartość końca linii (np. „201”).
  const MARGIN = { ...BASE_MARGIN, right: WIDTH < 560 ? 40 : BASE_MARGIN.right };
  const [hover, setHover] = useState<{ y: number; anchor: Box } | null>(null);
  // Telefon: dotknięcie roku wybiera rok i otwiera arkusz z liczbami roku (DESIGN.md 6.3).
  const phone = useMediaQuery(PHONE_QUERY) === true;
  const { min, max } = indexAxis(lines.flatMap((line) => line.values.filter((value): value is number => value !== null)));
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const step = innerWidth / Math.max(years.length, 1);
  const xOf = (y: number) => MARGIN.left + y * step + step / 2;
  const yOf = (value: number) => MARGIN.top + innerHeight - ((value - min) / (max - min || 1)) * innerHeight;
  const ticks = Array.from({ length: Math.round((max - min) / TICK) + 1 }, (_, i) => min + i * TICK);
  // Odcinki linii bez przerw (rok bez wartości przerywa linię).
  const path = (values: (number | null)[]) => values.map((value, y) => value === null ? "" : `${y && values[y - 1] !== null ? "L" : "M"}${xOf(y)},${yOf(value)}`).join("");
  // Wartości na końcach linii: co najmniej 14 px odstępu w pionie (bliskie indeksy, np. 229 i 225, nie nachodzą na siebie).
  const ends = lines.map((line) => {
    const last = line.values.reduce<number>((found, value, y) => value === null ? found : y, -1);
    return { key: line.key, last, y: last >= 0 ? yOf(line.values[last]!) + 4 : 0 };
  }).filter((end) => end.last >= 0).sort((a, b) => a.y - b.y);
  ends.forEach((end, i) => { if (i && end.y - ends[i - 1].y < 14) end.y = ends[i - 1].y + 14; });
  const endY = new Map(ends.map((end) => [end.key, end.y]));
  const describe = (y: number) => lines.map((line) => `${line.label} ${line.values[y] === null ? "brak" : integer(line.values[y]!)}`).join(", ");
  return <div ref={wrapRef} className={styles.chartWrap} onMouseLeave={() => setHover(null)}>
    <div ref={measureRef}><svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${height}`} role="group" aria-label={ariaLabel}>
      {selected >= 0 ? <rect x={MARGIN.left + selected * step} y={MARGIN.top} width={step} height={innerHeight} className={styles.band} /> : null}
      {ticks.map((tick) => <g key={tick}>
        <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} className={tick === 100 ? styles.axis : styles.grid} />
        <text x={MARGIN.left - 8} y={yOf(tick) + 4} className={styles.tickY}>{integer(tick)}</text>
      </g>)}
      {lines.map((line) => {
        const stroke = STROKES[line.tone];
        const last = line.values.reduce<number>((found, value, y) => value === null ? found : y, -1);
        return <g key={line.key} aria-hidden>
          <path d={path(line.values)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeDasharray={stroke.dash} strokeLinecap="round" strokeLinejoin="round" />
          {line.tone === "primary" ? line.values.map((value, y) => value === null ? null : <circle key={y} cx={xOf(y)} cy={yOf(value)} r={y === selected ? 5 : 3.5} fill={stroke.color} stroke="#fff" strokeWidth="1.5" />) : null}
          {last >= 0 ? <text x={xOf(last) + 10} y={endY.get(line.key)} className={line.tone === "primary" ? styles.endLabelStrong : styles.endLabel}>{integer(line.values[last]!)}</text> : null}
        </g>;
      })}
      {years.map((year, y) => <g
        key={year}
        className={styles.yearHit}
        role="button"
        tabIndex={0}
        aria-label={`${year}: ${describe(y)}`}
        aria-pressed={y === selected}
        onClick={(event) => { onYear(year); setHover(phone ? { y, anchor: elementBox(event.currentTarget.querySelector("[data-anchor]") ?? event.currentTarget) } : null); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onYear(year); } }}
        onMouseEnter={(event) => setHover({ y, anchor: elementBox(event.currentTarget.querySelector("[data-anchor]") ?? event.currentTarget) })}
        onFocus={(event) => setHover({ y, anchor: elementBox(event.currentTarget.querySelector("[data-anchor]") ?? event.currentTarget) })}
        onBlur={() => setHover(null)}
      >
        <rect x={MARGIN.left + y * step} y={MARGIN.top} width={step} height={innerHeight} fill="transparent" />
        {lines[0]?.values[y] != null ? <rect data-anchor x={xOf(y) - 4} y={yOf(lines[0].values[y]!) - 4} width="8" height="8" fill="transparent" /> : null}
        {showYearLabel(y, years.length, selected, step) ? <text x={xOf(y)} y={height - 8} className={y === selected ? styles.tickOn : styles.tickX}>{year}</text> : null}
      </g>)}
    </svg></div>
    {hover ? <ChartTooltip anchor={hover.anchor} container={wrapRef} onClose={() => setHover(null)}>
      <TooltipHead title={years[hover.y]} context={context} />
      <TooltipLines lines={tooltipLines?.(hover.y) ?? lines.map((line) => <>{line.label}: <b>{line.values[hover.y] === null ? "brak" : integer(line.values[hover.y]!)}</b></>)} />
    </ChartTooltip> : null}
  </div>;
}
