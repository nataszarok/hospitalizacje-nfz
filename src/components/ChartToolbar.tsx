import type { ReactNode } from "react";
import { plural } from "@/lib/jgpDescription";
import type { MortalityDisplayMode } from "@/lib/mortality";
import styles from "./ChartToolbar.module.css";

/**
 * Pasek nad wykresem punktowym eksploratora („Kto leczy”, „Tryb przyjęcia”), jak nagłówek „W czasie”:
 * opis punktów po lewej, przełączniki po prawej. Pasek nie leży na wykresie, więc nie zasłania punktów ani legendy.
 * Kolejność przełączników: dane („Zestawienie JGP”) → wygląd → oś X → statystyki obszarów.
 */
export function ChartToolbar({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return <div className={styles.chartHeader}>
    <p className={styles.chartCaption}>{caption}</p>
    <div className={styles.controls}>{children}</div>
  </div>;
}

/** Opis punktów nad wykresem: ile ich jest i co oznacza jeden punkt. */
export function pointCaption(count: number, displayMode: MortalityDisplayMode): string {
  const number = count.toLocaleString("pl-PL");
  return displayMode === "combined"
    ? `${number} ${plural(count, "świadczeniodawca", "świadczeniodawców", "świadczeniodawców")} · wszystkie wybrane grupy razem`
    : `${number} ${plural(count, "punkt", "punkty", "punktów")} · każda grupa JGP osobno`;
}
