"use client";

import type { SortDirection } from "@/lib/tableSort";
import styles from "./SortableTableHeader.module.css";

type SortableTableHeaderProps = {
  label: string;
  active: boolean;
  direction?: SortDirection;
  onSort: () => void;
  /** Klasy komórki nagłówka (np. liczby do prawej, priorytet kolumny `col-p2` / `col-p3`). */
  className?: string;
};

export function SortableTableHeader({
  label,
  active,
  direction,
  onSort,
  className,
}: SortableTableHeaderProps) {
  const ariaSort = active
    ? direction === "asc" ? "ascending" : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={className}>
      <button
        type="button"
        className={`${styles.button} ${active ? styles.active : ""}`}
        onClick={onSort}
        title={`Sortuj po kolumnie: ${label}`}
      >
        <span>{label}</span>
        <span className={styles.icon} aria-hidden="true">
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
