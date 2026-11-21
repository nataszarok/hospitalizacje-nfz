"use client";

import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import styles from "./CellTip.module.css";

/**
 * Wartość w komórce tabeli ze szczegółami (np. kropka śmiertelności, zmiana r/r, udział ryczałtu).
 * Szeroki ekran: podpowiedź `title` po najechaniu. Telefon (< 640 px): `title` nie działa po dotknięciu, więc wartość
 * jest przyciskiem, który otwiera arkusz od dołu (DESIGN.md 6.3) z tymi samymi liniami.
 */
export function CellTip({ title, lines, className, children }: { title: string; lines: string[]; className?: string; children: ReactNode }) {
  const phone = useMediaQuery(PHONE_QUERY) === true;
  const [open, setOpen] = useState(false);
  if (!phone || !lines.length) return <span className={className} title={lines.length ? lines.join("\n") : undefined}>{children}</span>;
  return <>
    <button type="button" className={`${styles.button} ${className ?? ""}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>{children}</button>
    {open ? <BottomSheet title={title} onClose={() => setOpen(false)}>
      {lines.map((line, i) => <p key={i} className={styles.line}>{line}</p>)}
    </BottomSheet> : null}
  </>;
}
