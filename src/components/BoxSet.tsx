"use client";

import type { CSSProperties, ReactNode } from "react";
import { isCompactBoxSet } from "@/lib/hospitalStructure";
import { useElementWidth } from "@/lib/useElementWidth";
import styles from "./BoxSet.module.css";

/** Boks: etykieta (z kolorem w `<i>`), wartość (liczba w `<b>` — duża), opis i szczegóły (znikają w wąskim boksie). */
export interface BoxItem { key: string; label: ReactNode; value: ReactNode; what?: ReactNode; sub?: ReactNode[]; className?: string }

/**
 * Zestaw boksów (DESIGN.md 7.1a): jedna linia, boksy kurczą się razem; gdy boks byłby węższy niż 150 px
 * (`isCompactBoxSet`) — zwarta lista: etykieta po lewej, wartość po prawej, opis pod spodem, bez szczegółów.
 * Boks węższy niż 200 px traci szczegóły (`sub`). Jeden komponent na kartach (Struktura, Finanse).
 */
export function BoxSet({ items, label }: { items: BoxItem[]; label?: string }) {
  const { ref, width } = useElementWidth();
  const compact = isCompactBoxSet(width, items.length);
  return <div ref={ref}>
    <dl className={`${styles.boxes} ${compact ? styles.compact : ""}`} style={{ "--boxes": items.length } as CSSProperties} aria-label={label} data-compact={compact || undefined}>
      {items.map((item) => <div key={item.key} className={`${styles.box} ${item.className ?? ""}`}>
        <dt>{item.label}</dt>
        <dd className={styles.val}>{item.value}</dd>
        {item.what ? <dd className={styles.what}>{item.what}</dd> : null}
        {item.sub?.map((text, i) => <dd key={i} className={styles.sub}>{text}</dd>)}
      </div>)}
    </dl>
  </div>;
}
