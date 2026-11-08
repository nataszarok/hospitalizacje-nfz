"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import styles from "./ChartExpand.module.css";

/**
 * Powiększenie wykresu (DESIGN.md, 7, „Powiększenie wykresu”): przycisk w prawym górnym rogu wykresu otwiera okno
 * z tym samym wykresem w dużym rozmiarze. Wybór (ośrodek, rok, województwo) działa w oknie tak jak na karcie,
 * więc użytkownik nie traci kontekstu. Stopka prowadzi do eksploratora, gdy ma on odpowiedni widok.
 * `children(expanded)`: wykres; `expanded = true` w oknie (np. większa wysokość).
 */
export function ChartExpand({ title, explorer, children }: {
  title: string;
  /** Widok eksploratora z tymi samymi danymi (adres i nazwa widoku). */
  explorer?: { href: string; label: string };
  children: (expanded: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  // Okno: Esc zamyka, strona pod spodem się nie przewija, fokus na „Zamknij”, po zamknięciu wraca na przycisk.
  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open]);

  return <div className={styles.frame}>
    <button ref={openerRef} type="button" className={styles.open} onClick={() => setOpen(true)} aria-label={`Powiększ wykres: ${title}`} title="Powiększ wykres">
      <PortalIcon name="expand" size={16} />
    </button>
    {children(false)}
    {open ? <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button ref={closeRef} type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Zamknij powiększenie">
            <PortalIcon name="close" size={18} />
          </button>
        </header>
        <div className={styles.body}>{children(true)}</div>
        {explorer ? <footer className={styles.foot}>
          <Link href={explorer.href} className={styles.explorer}>{explorer.label} w eksploratorze <PortalIcon name="arrow" size={15} /></Link>
        </footer> : null}
      </section>
    </div> : null}
  </div>;
}
