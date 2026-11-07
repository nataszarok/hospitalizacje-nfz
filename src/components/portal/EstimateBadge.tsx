import styles from "./EstimateBadge.module.css";

const DEFAULT_TITLE = "Wartości „<5” w danych NFZ liczone jako 1 (metoda konserwatywna).";

/** Plakietka „szacunek” przy liczbach z estymacją wartości „<5” (DESIGN.md, sekcja 7). */
export function EstimateBadge({ title = DEFAULT_TITLE }: { title?: string }) {
  return <span className={styles.badge} title={title}>Szacunek</span>;
}
