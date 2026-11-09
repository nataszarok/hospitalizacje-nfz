import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

/**
 * Miejsce na treść, która jeszcze się ładuje (szkielet strony): szary blok o docelowym rozmiarze.
 * Strona od razu ma swój układ, więc po załadowaniu danych nic nie przeskakuje.
 */
export function Skeleton({ height, width = "100%", style }: { height: number | string; width?: number | string; style?: CSSProperties }) {
  return <span className={styles.block} style={{ height, width, ...style }} aria-hidden />;
}

/** Komunikat o ładowaniu dla czytników ekranu (`role="status"`), niewidoczny na ekranie. */
export function LoadingStatus({ children }: { children: string }) {
  return <span className={styles.status} role="status">{children}</span>;
}
