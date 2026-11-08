"use client";

import { useEffect, useState } from "react";
import styles from "./YearPlayer.module.css";

/** Czas wyświetlania jednego roku przy odtwarzaniu (ms). */
export const PLAY_STEP_MS = 900;

/**
 * Wybór roku na osi czasu: przycisk odtwarzania, suwak z podziałką lat i duży rok.
 * Odtwarzanie przechodzi po latach do ostatniego; z ostatniego roku zaczyna od pierwszego.
 * Używają go mapy w czasie (karta „Hospitalizacje w Polsce”, widok „Gdzie” eksploratora).
 */
export function YearPlayer({ years, index, onIndex, compact = false }: {
  years: string[];
  index: number;
  onIndex: (index: number) => void;
  /** Mniejszy rok obok suwaka (wąski panel). */
  compact?: boolean;
}) {
  const last = years.length - 1;
  const [playing, setPlaying] = useState(false);
  const isPlaying = playing && index < last;

  useEffect(() => {
    if (!playing || index >= last) return;
    const timer = setTimeout(() => onIndex(index + 1), PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last, onIndex]);

  const toggle = () => {
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (index >= last) onIndex(0);
    setPlaying(true);
  };

  return <div className={`${styles.controls} ${compact ? styles.compact : ""}`}>
    <button type="button" className={styles.play} onClick={toggle} aria-label={isPlaying ? "Zatrzymaj" : "Odtwórz lata"}>
      {isPlaying ? <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
        : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" /></svg>}
    </button>
    <div className={styles.track}>
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={last}
        step={1}
        value={index}
        onChange={(event) => { setPlaying(false); onIndex(Number(event.target.value)); }}
        aria-label="Rok"
        aria-valuetext={`${years[index]} r.`}
      />
      <div className={styles.ticks} aria-hidden="true">{years.map((year, i) => <span key={year} className={i === index ? styles.tickActive : undefined}>{`’${year.slice(2)}`}</span>)}</div>
    </div>
    <output className={styles.year} aria-live="polite">{years[index]}</output>
  </div>;
}
