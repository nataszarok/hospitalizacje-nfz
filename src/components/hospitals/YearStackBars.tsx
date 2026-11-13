"use client";

import { useId, useRef, useState } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { CHART_COLORS } from "@/lib/chartPalette";
import { plnScale } from "@/lib/formatters";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import styles from "./HospitalFinance.module.css";

/** Część słupka: nazwa, wartości w latach, kolor; `hatch` = kreskowanie (pozycje bez danych o rozliczeniu), `dark` = biały podpis. */
export interface StackPart { key: string; label: string; values: number[]; fill: string; hatch?: boolean; dark?: boolean }

const WIDTH = 980;
const MARGIN = { left: 56, right: 16, top: 22, bottom: 30 };
const decimal = (value: number) => value.toLocaleString("pl-PL", { maximumFractionDigits: 0 });

/** Oś wartości: krok 1, 2, 2,5 albo 5 × 10ᵏ (najwyżej 5 odstępów), górna granica = najbliższa wielokrotność kroku nie mniejsza niż `value`. */
export function niceAxis(value: number): { max: number; step: number } {
  if (value <= 0) return { max: 1, step: 0.25 };
  const raw = value / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const n = raw / power;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * power;
  return { max: Math.ceil(value / step - 1e-9) * step, step };
}

/**
 * Słupki skumulowane w latach (kwoty zł): wybrany rok na tle pasma, kliknięcie albo Enter na roku zmienia rok karty, dymek z częściami.
 * `marker`: kreska w kolorze sygnału na wysokości wartości roku (np. przychody ze sprawozdania). `percentLabels`: udział części
 * w słupku zamiast sumy nad słupkiem. Rok bez kwot nie ma słupka (oś lat stała).
 */
export function YearStackBars({ years, parts, selected, onYear, marker, percentLabels = false, height = 270, ariaLabel, context }: {
  years: string[];
  parts: StackPart[];
  selected: number;
  onYear: (year: string) => void;
  marker?: { label: string; values: (number | null)[] };
  percentLabels?: boolean;
  height?: number;
  ariaLabel: string;
  /** Kontekst w dymku pod rokiem, np. „Umowy z NFZ”. */
  context: string;
}) {
  const id = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ y: number; anchor: Box } | null>(null);
  const totals = years.map((_, y) => parts.reduce((sum, part) => sum + (part.values[y] ?? 0), 0));
  const { max, step: tickStep } = niceAxis(Math.max(...totals, ...(marker?.values ?? []).map((value) => value ?? 0)));
  const scale = plnScale([max]);
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const step = innerWidth / Math.max(years.length, 1);
  const barWidth = Math.min(64, step * 0.6);
  const yOf = (value: number) => MARGIN.top + innerHeight - (value / max) * innerHeight;
  const ticks = Array.from({ length: Math.round(max / tickStep) + 1 }, (_, i) => i * tickStep);
  const share = (value: number, total: number) => total ? (value / total) * 100 : 0;
  const lines = (y: number) => [
    <>Razem: <b>{scale.format(totals[y])} {scale.unit}</b></>,
    ...parts.filter((part) => part.values[y]).map((part) => <>{part.label}: {scale.format(part.values[y])} {scale.unit} ({decimal(share(part.values[y], totals[y]))}%)</>),
    ...(marker && marker.values[y] !== null ? [<>{marker.label}: {scale.format(marker.values[y]!)} {scale.unit}</>] : []),
  ];
  return <div ref={wrapRef} className={styles.chartWrap} onMouseLeave={() => setHover(null)}>
    <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${height}`} role="group" aria-label={ariaLabel}>
      <defs>
        <pattern id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fff" />
          <rect width="2.5" height="6" fill={CHART_COLORS.dataSoft} />
        </pattern>
      </defs>
      <rect x={MARGIN.left + selected * step} y={MARGIN.top} width={step} height={innerHeight} className={styles.band} />
      {ticks.map((tick) => <g key={tick}>
        <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} className={tick ? styles.grid : styles.axis} />
        <text x={MARGIN.left - 8} y={yOf(tick) + 4} className={styles.tickY}>{scale.format(tick)}</text>
      </g>)}
      <text x={MARGIN.left - 8} y={MARGIN.top - 8} className={styles.tickY}>{scale.unit}</text>
      {years.map((year, y) => {
        const cx = MARGIN.left + y * step + step / 2;
        let acc = 0;
        const label = `${year}: razem ${scale.format(totals[y])} ${scale.unit}; ${parts.filter((part) => part.values[y]).map((part) => `${part.label} ${scale.format(part.values[y])}`).join(", ")}`;
        const show = (target: Element) => setHover({ y, anchor: elementBox(target) });
        return <g
          key={year}
          className={styles.yearHit}
          role="button"
          tabIndex={0}
          aria-label={label}
          aria-pressed={y === selected}
          onClick={() => { setHover(null); onYear(year); }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onYear(year); } }}
          onMouseEnter={(event) => show(event.currentTarget.querySelector("[data-bar]") ?? event.currentTarget)}
          onFocus={(event) => show(event.currentTarget.querySelector("[data-bar]") ?? event.currentTarget)}
          onBlur={() => setHover(null)}
        >
          <rect x={cx - step / 2} y={MARGIN.top} width={step} height={innerHeight} fill="transparent" />
          {totals[y] > 0 ? <rect data-bar x={cx - barWidth / 2} y={yOf(totals[y])} width={barWidth} height={yOf(0) - yOf(totals[y])} fill="transparent" /> : null}
          {parts.map((part) => {
            const value = part.values[y] ?? 0;
            if (!value) return null;
            const top = yOf(acc + value);
            const h = Math.max(0, yOf(acc) - top - 1);
            const middle = top + h / 2 + 4;
            acc += value;
            const pct = share(value, totals[y]);
            return <g key={part.key}>
              <rect x={cx - barWidth / 2} y={top} width={barWidth} height={h} fill={part.hatch ? `url(#hatch-${id})` : part.fill} stroke={part.hatch ? CHART_COLORS.dataSoft : undefined} />
              {percentLabels && h >= 14 ? <text x={cx} y={middle} className={part.dark ? styles.segmentDark : styles.segmentLight}>{decimal(pct)}%</text> : null}
            </g>;
          })}
          {marker && marker.values[y] !== null ? <line x1={cx - barWidth / 2 - 5} x2={cx + barWidth / 2 + 5} y1={yOf(marker.values[y]!)} y2={yOf(marker.values[y]!)} stroke={CHART_COLORS.signal} strokeWidth="2.5" /> : null}
          {!percentLabels && totals[y] > 0 ? <text x={cx} y={yOf(Math.max(totals[y], marker?.values[y] ?? 0)) - 6} className={styles.total}>{scale.format(totals[y])}</text> : null}
          <text x={cx} y={height - 8} className={y === selected ? styles.tickOn : styles.tickX}>{year}</text>
        </g>;
      })}
    </svg>
    {hover ? <ChartTooltip anchor={hover.anchor} container={wrapRef} kind="bar">
      <TooltipHead title={years[hover.y]} context={context} />
      <TooltipLines lines={lines(hover.y)} />
    </ChartTooltip> : null}
  </div>;
}
