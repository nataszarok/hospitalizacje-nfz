"use client";

import { useRef, useState } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import styles from "./ControlCoverageGrid.module.css";

const MONTH_NAMES = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

/** Wiersz siatki: placówka, jej szereg miesięczny i okresy objęte kontrolami (brak = placówka bez kontroli). */
export interface CoverageRow {
  key: string;
  label: string;
  /** Kontekst w dymku, np. pełna nazwa albo wydział kontroli. */
  detail?: string;
  values: number[];
  /** Okresy objęte kontrolami (miesiące „RRRR-MM”, włącznie); placówka może mieć kilka kontroli. */
  periods?: { from: string; to: string }[];
  /** Podpis po prawej, np. „12 z 108”. */
  summary: string;
}

export interface CoverageGroup { title?: string; rows: CoverageRow[] }

type Status = "studied" | "outside" | "none";

/** Status miesiąca z H55: w okresie badanym, poza nim, w placówce bez kontroli. */
export function monthStatus(row: Pick<CoverageRow, "periods">, month: string): Status {
  if (!row.periods?.length) return "none";
  return row.periods.some((period) => month >= period.from && month <= period.to) ? "studied" : "outside";
}

const STATUS_TEXT: Record<Status, string> = {
  studied: "w okresie objętym kontrolą",
  outside: "poza okresem objętym kontrolą",
  none: "placówka bez kontroli",
};

/** Progi odcieni: miesiąc z 1–9, 10–29, 30–79 i co najmniej 80 hospitalizacjami (od najjaśniejszego). */
export const SHADE_LIMITS = [10, 30, 80] as const;
const SHADE_LABELS = ["1–9", "10–29", "30–79", "80+"];

/** Stopień odcienia (0–3) dla liczby hospitalizacji w miesiącu. */
export function shadeLevel(value: number): number {
  return SHADE_LIMITS.filter((limit) => value >= limit).length;
}

/**
 * Siatka miesięcy: jeden wiersz = placówka (nazwa, pasek miesięcy, podsumowanie w jednej linii), kratka = miesiąc z H55.
 * Błękit danych = miesiąc w okresie objętym kontrolą; sygnał = miesiąc poza nim albo w placówce bez kontroli.
 * Odcień = liczba hospitalizacji w miesiącu (4 stopnie, `SHADE_LIMITS`); legenda pokazuje oba kolory we wszystkich stopniach.
 * Dymek: `ChartTooltip` przy kratce (DESIGN.md 6.3). Dane liczbowe są też w tabeli obok wykresu.
 */
export function ControlCoverageGrid({ months, groups, ariaLabel, controlled = true }: {
  /** Miesiące „RRRR-MM” (wspólna oś wszystkich wierszy). */
  months: string[];
  groups: CoverageGroup[];
  ariaLabel: string;
  /** Legenda z kolorem „w okresie kontroli” (siatka placówek bez kontroli ma tylko sygnał). */
  controlled?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ anchor: Box; row: CoverageRow; index: number } | null>(null);
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];
  const legendRow = (status: "studied" | "outside", label: string) => <li>
    <span className={styles.ramp} aria-hidden="true">{SHADE_LABELS.map((_, level) => <i key={level} className={`${styles.swatch} ${styles[status]} ${styles[`s${level}`]}`} />)}</span>
    {label}
  </li>;

  return <div ref={shellRef} className={styles.shell} onMouseLeave={() => setTip(null)}>
    <ul className={styles.legend} aria-label="Legenda">
      {controlled ? legendRow("studied", "miesiąc w okresie objętym kontrolą") : null}
      {legendRow("outside", controlled ? "miesiąc poza okresem kontroli" : "miesiąc z H55, placówka bez kontroli")}
      <li className={styles.scale}>od jaśniejszego: {SHADE_LABELS.join(", ")} hospitalizacji w miesiącu</li>
    </ul>
    <div className={`${styles.row} ${styles.axisRow}`} aria-hidden="true">
      <span />
      <div className={styles.axis}>
        {years.map((year, i) => <span key={year} style={{ left: `${(i * 12 / months.length) * 100}%` }}>{year}</span>)}
      </div>
      <span />
    </div>
    <div role="img" aria-label={ariaLabel}>
      {groups.map((group, g) => <div key={group.title ?? g} className={styles.group}>
        {group.title ? <div className={styles.groupTitle}>{group.title}</div> : null}
        {group.rows.map((row) => <div key={row.key} className={styles.row}>
          <span className={styles.label}>{row.label}</span>
          <svg className={styles.strip} viewBox={`0 0 ${months.length} 1`} preserveAspectRatio="none" aria-hidden="true">
            {years.slice(1).map((year, i) => <rect key={year} className={styles.yearLine} x={(i + 1) * 12 - 0.04} y={0} width={0.08} height={1} />)}
            {row.values.map((value, i) => value > 0 ? <rect
              key={i}
              className={`${styles[monthStatus(row, months[i]) === "studied" ? "studied" : "outside"]} ${styles[`s${shadeLevel(value)}`]}`}
              x={i + 0.08} y={0} width={0.84} height={1}
              onMouseEnter={(event) => setTip({ anchor: elementBox(event.currentTarget), row, index: i })}
            /> : null)}
          </svg>
          <span className={styles.summary}>{row.summary}</span>
        </div>)}
      </div>)}
    </div>
    {tip ? <ChartTooltip anchor={tip.anchor} container={shellRef} kind="bar">
      <TooltipHead title={tip.row.label} context={[tip.row.detail, `${MONTH_NAMES[Number(months[tip.index].slice(5)) - 1]} ${months[tip.index].slice(0, 4)}`].filter(Boolean).join(" · ")} />
      <TooltipLines lines={[
        <>Hospitalizacje H55: <b>{integer(tip.row.values[tip.index])}</b></>,
        STATUS_TEXT[monthStatus(tip.row, months[tip.index])],
      ]} />
    </ChartTooltip> : null}
  </div>;
}
