"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { CHART_COLORS } from "@/lib/chartPalette";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import styles from "./HospitalFinance.module.css";

/** Linia indeksu: nazwa, wartości w latach (`null` = przerwa), styl: szpital (ciągła z punktami) albo odniesienie (kropkowana / przerywana). */
export interface IndexLine { key: string; label: string; values: (number | null)[]; tone: "primary" | "reference" | "context" }

const WIDTH = 980;
const MARGIN = { left: 48, right: 64, top: 16, bottom: 30 };
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
  const [hover, setHover] = useState<{ y: number; anchor: Box } | null>(null);
  const { min, max } = indexAxis(lines.flatMap((line) => line.values.filter((value): value is number => value !== null)));
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const step = innerWidth / Math.max(years.length, 1);
  const xOf = (y: number) => MARGIN.left + y * step + step / 2;
  const yOf = (value: number) => MARGIN.top + innerHeight - ((value - min) / (max - min || 1)) * innerHeight;
  const ticks = Array.from({ length: Math.round((max - min) / TICK) + 1 }, (_, i) => min + i * TICK);
  // Odcinki linii bez przerw (rok bez wartości przerywa linię).
  const path = (values: (number | null)[]) => values.map((value, y) => value === null ? "" : `${y && values[y - 1] !== null ? "L" : "M"}${xOf(y)},${yOf(value)}`).join("");
  const describe = (y: number) => lines.map((line) => `${line.label} ${line.values[y] === null ? "brak" : integer(line.values[y]!)}`).join(", ");
  return <div ref={wrapRef} className={styles.chartWrap} onMouseLeave={() => setHover(null)}>
    <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${height}`} role="group" aria-label={ariaLabel}>
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
          {last >= 0 ? <text x={xOf(last) + 10} y={yOf(line.values[last]!) + 4} className={line.tone === "primary" ? styles.endLabelStrong : styles.endLabel}>{integer(line.values[last]!)}</text> : null}
        </g>;
      })}
      {years.map((year, y) => <g
        key={year}
        className={styles.yearHit}
        role="button"
        tabIndex={0}
        aria-label={`${year}: ${describe(y)}`}
        aria-pressed={y === selected}
        onClick={() => { setHover(null); onYear(year); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onYear(year); } }}
        onMouseEnter={(event) => setHover({ y, anchor: elementBox(event.currentTarget.querySelector("[data-anchor]") ?? event.currentTarget) })}
        onFocus={(event) => setHover({ y, anchor: elementBox(event.currentTarget.querySelector("[data-anchor]") ?? event.currentTarget) })}
        onBlur={() => setHover(null)}
      >
        <rect x={MARGIN.left + y * step} y={MARGIN.top} width={step} height={innerHeight} fill="transparent" />
        {lines[0]?.values[y] != null ? <rect data-anchor x={xOf(y) - 4} y={yOf(lines[0].values[y]!) - 4} width="8" height="8" fill="transparent" /> : null}
        <text x={xOf(y)} y={height - 8} className={y === selected ? styles.tickOn : styles.tickX}>{year}</text>
      </g>)}
    </svg>
    {hover ? <ChartTooltip anchor={hover.anchor} container={wrapRef}>
      <TooltipHead title={years[hover.y]} context={context} />
      <TooltipLines lines={tooltipLines?.(hover.y) ?? lines.map((line) => <>{line.label}: <b>{line.values[hover.y] === null ? "brak" : integer(line.values[hover.y]!)}</b></>)} />
    </ChartTooltip> : null}
  </div>;
}
