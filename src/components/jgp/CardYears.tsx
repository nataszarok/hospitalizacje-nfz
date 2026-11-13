"use client";

import styles from "./JgpTabs.module.css";

/**
 * Wybór roku karty w pasku zakładek (karta grupy JGP, karta szpitala): przełącznik „‹ 2025 ▾ ›”.
 * Strzałki przechodzą do poprzedniego i następnego roku, lista (natywny `<select>`) pozwala skoczyć do dowolnego roku.
 * Stała, mała szerokość niezależnie od liczby lat (dawny rząd przycisków lat zajmował ok. 600 px).
 */
export function CardYears({ years, selected, onSelect }: { years: readonly string[]; selected: string; onSelect: (year: string) => void }) {
  const index = years.indexOf(selected);
  const previous = index > 0 ? years[index - 1] : null;
  const next = index >= 0 && index < years.length - 1 ? years[index + 1] : null;
  return <div className={styles.years} role="group" aria-label="Rok karty">
    <span aria-hidden>Rok</span>
    <span className={styles.yearStep}>
      <button type="button" aria-label={previous ? `Poprzedni rok: ${previous}` : "Poprzedni rok"} disabled={!previous} onClick={() => previous && onSelect(previous)}>‹</button>
      <label className={styles.yearSelect}>
        <select aria-label="Rok" value={selected} onChange={(event) => onSelect(event.target.value)}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <button type="button" aria-label={next ? `Następny rok: ${next}` : "Następny rok"} disabled={!next} onClick={() => next && onSelect(next)}>›</button>
    </span>
  </div>;
}
