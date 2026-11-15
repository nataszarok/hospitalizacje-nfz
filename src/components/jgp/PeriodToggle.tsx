"use client";

import type { ChartPeriod } from "@/lib/jgpCard";
import styles from "./JgpTabs.module.css";

/**
 * Przełącznik okresu wykresu „Miesiące / Lata” (`GroupLineChart`, prop `period`). Na karcie JGP stoi w miejscu
 * etykiety sekcji, w artykule — w nagłówku wykresu.
 */
export function PeriodToggle({ period, onPeriod }: { period: ChartPeriod; onPeriod: (period: ChartPeriod) => void }) {
  return <div className={styles.periodToggle} role="group" aria-label="Okres na wykresie">
    <button type="button" aria-pressed={period === "month"} onClick={() => onPeriod("month")}>Miesiące</button>
    <button type="button" aria-pressed={period === "year"} onClick={() => onPeriod("year")}>Lata</button>
  </div>;
}
