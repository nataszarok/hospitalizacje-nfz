"use client";

import { Fragment, isValidElement, useState, type ReactNode } from "react";
import styles from "./ExpandableTable.module.css";

/**
 * Tabela z ukrytą częścią wierszy (DESIGN.md 7.1, punkt 6): na starcie `initial` wierszy, pod tabelą przycisk
 * „Pokaż wszystkie (N)” / „Zwiń”. Wiersze i nagłówek przychodzą gotowe (komponent serwerowy składa `<tr>`).
 */
export function ExpandableTable({ caption, head, rows, initial = 2, className, tableClassName }: {
  caption: ReactNode;
  /** Wiersz nagłówka (`<tr>` z `<th>`). */
  head: ReactNode;
  /** Wiersze ciała tabeli (`<tr>` z kluczem). */
  rows: ReactNode[];
  initial?: number;
  /** Klasa kontenera (np. `priority-table`). */
  className?: string;
  tableClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = rows.length - initial;
  return <div className={className}>
    <table className={tableClassName}>
      <caption>{caption}</caption>
      <thead>{head}</thead>
      {/* Wiersze z komponentu serwerowego: klucz każdego wiersza jawnie na liście (bez ostrzeżenia Reacta o kluczach). */}
      <tbody>{(open || hidden <= 0 ? rows : rows.slice(0, initial)).map((row, i) => <Fragment key={isValidElement(row) && row.key !== null ? row.key : i}>{row}</Fragment>)}</tbody>
    </table>
    {hidden > 0 ? <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? "Zwiń" : `Pokaż wszystkie (${rows.length})`}
    </button> : null}
  </div>;
}
