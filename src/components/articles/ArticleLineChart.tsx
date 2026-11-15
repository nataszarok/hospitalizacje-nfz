"use client";

import { useState, type ReactNode } from "react";
import { GroupLineChart, type ChartBand, type ChartLine, type ChartMarker } from "@/components/jgp/GroupLineChart";
import { PeriodToggle } from "@/components/jgp/PeriodToggle";
import type { ChartPeriod } from "@/lib/jgpCard";
import styles from "./ArticleFigure.module.css";

/**
 * Wykres w artykule: tytuł-pytanie, przełącznik „Miesiące / Lata”, wykres miesięcy z kart JGP (`GroupLineChart`)
 * i podpis ze źródłem. Długi okres zaczyna się od lat (czytelniej), krótki — od miesięcy.
 * Pasma i znaczniki (okres objęty kontrolą, koniec kontroli) są na obu widokach.
 */
export function ArticleLineChart({ title, caption, months, lines, valueLabel, ariaLabel, bands, markers, initialPeriod = "month", legend = true, height = 340, periodToggle = true }: {
  title: string;
  caption: ReactNode;
  months: string[];
  lines: ChartLine[];
  valueLabel: string;
  ariaLabel: string;
  bands?: ChartBand[];
  markers?: ChartMarker[];
  initialPeriod?: ChartPeriod;
  legend?: boolean;
  height?: number;
  /** Przełącznik „Miesiące / Lata”; bez niego wykres zostaje w `initialPeriod`. */
  periodToggle?: boolean;
}) {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod);
  return <figure className={styles.figure}>
    <div className={styles.head}>
      <figcaption className={styles.title}>{title}</figcaption>
      {periodToggle ? <PeriodToggle period={period} onPeriod={setPeriod} /> : null}
    </div>
    <GroupLineChart months={months} lines={lines} valueLabel={valueLabel} ariaLabel={ariaLabel} legend={legend} height={height} bands={bands} markers={markers} period={period} modeBar={false} />
    <p className={styles.note}>{caption}</p>
  </figure>;
}

/** Ramka wykresu bez przełącznika (np. siatka miesięcy): tytuł-pytanie, treść, podpis. */
export function ArticleFigure({ title, caption, children }: { title: string; caption: ReactNode; children: ReactNode }) {
  return <figure className={styles.figure}>
    <div className={styles.head}><figcaption className={styles.title}>{title}</figcaption></div>
    {children}
    <p className={styles.note}>{caption}</p>
  </figure>;
}
