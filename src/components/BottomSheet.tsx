"use client";

import { Portal } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./BottomSheet.module.css";

/**
 * Arkusz od dołu na telefonie (DESIGN.md 6.3): objaśnienie „?” (`InfoTip`) i dymek danych (np. rzut w zakładce „Struktura”).
 * Pełna szerokość z marginesem 8 px, do 60% wysokości; tytuł i „Zamknij”; dotknięcie tła zamyka.
 * Otwieraj na `click`, nie na `pointerdown`: tło arkusza otwartego przy dotknięciu przejmuje `click` i od razu go zamyka.
 */
export function BottomSheet({ id, title, onClose, sheetData, children }: { id?: string; title: ReactNode; onClose: () => void; sheetData?: string; children: ReactNode }) {
  return <Portal>
    <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
    <section id={id} role="dialog" aria-modal="false" aria-label={typeof title === "string" ? title : undefined} className={styles.sheet} data-tooltip-sheet={sheetData}>
      <header className={styles.head}>
        <b>{title}</b>
        <button type="button" className={styles.close} onClick={onClose}>Zamknij</button>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  </Portal>;
}
