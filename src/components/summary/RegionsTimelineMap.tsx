"use client";

import { useEffect, useState } from "react";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import type { SummaryRegionTimeline } from "@/lib/hospitalizationSummary";
import { scaleColor } from "@/lib/jgpCard";
import styles from "./RegionsTimelineMap.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const thousands = (value: number) => (value / 1000).toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Czas wyświetlania jednego roku przy odtwarzaniu (ms). */
export const PLAY_STEP_MS = 900;

/**
 * Mapa województw: hospitalizacje na 100 tys. mieszkańców w wybranym roku.
 * Suwak wybiera rok, przycisk odtwarza lata po kolei. Skala koloru jest wspólna dla wszystkich lat,
 * więc kolor pokazuje też zmianę w czasie.
 */
export function RegionsTimelineMap({ timeline }: { timeline: SummaryRegionTimeline }) {
  const last = timeline.years.length - 1;
  const [index, setIndex] = useState(last);
  const [playing, setPlaying] = useState(false);
  const isPlaying = playing && index < last;

  useEffect(() => {
    if (!playing || index >= last) return;
    const timer = setTimeout(() => setIndex(index + 1), PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last]);

  const values = timeline.years.flatMap((y) => y.per100k.filter((value) => value > 0));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const position = (value: number) => (max > min ? ((value - min) / (max - min)) * 2 - 1 : 0);
  const current = timeline.years[index];
  const [width, height] = timeline.map.viewBox;
  const regionIndex = new Map(timeline.regions.map(([code], i) => [code, i]));
  const shapes = timeline.map.regions.flatMap(([code, , path, label]) => {
    const i = regionIndex.get(code);
    if (i === undefined) return [];
    const value = current.per100k[i];
    return [{ code, name: timeline.regions[i][1], path, label, value, position: position(value) }];
  });

  const toggle = () => {
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (index >= last) setIndex(0);
    setPlaying(true);
  };

  return <div className={styles.wrap}>
    <div className={styles.controls}>
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
          onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }}
          aria-label="Rok"
          aria-valuetext={`${current.year} r.`}
        />
        <div className={styles.ticks} aria-hidden="true">{timeline.years.map((y, i) => <span key={y.year} className={i === index ? styles.tickActive : undefined}>{`’${y.year.slice(2)}`}</span>)}</div>
      </div>
      <output className={styles.year} aria-live="polite">{current.year}</output>
    </div>
    <svg className={styles.map} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Mapa województw: hospitalizacje na 100 tys. mieszkańców w ${current.year} r.`}>
      {shapes.map(({ code, name, path, value, position: p }) => {
        const title = `${name}: ${integer(value)} hospitalizacji na 100 tys. mieszkańców w ${current.year} r.`;
        return <a key={code} href={`${DASHBOARD_HREFS.regions}&ow=${encodeURIComponent(code)}&y=${current.year}`} aria-label={title} className={styles.mapLink}>
          <title>{title}</title>
          <path d={path} fill={scaleColor(p)} className={styles.mapShape} />
        </a>;
      })}
      {shapes.map(({ code, label, value, position: p }) => <text key={`label-${code}`} x={label[0]} y={label[1]} className={`${styles.mapLabel} ${p < 0.35 ? styles.mapLabelDark : ""}`} aria-hidden="true">{thousands(value)}</text>)}
    </svg>
    <div className={styles.legend} aria-hidden="true">
      <span>{thousands(min)}</span>
      <span className={styles.scale} style={{ background: `linear-gradient(90deg, ${scaleColor(-1)}, ${scaleColor(0)}, ${scaleColor(1)})` }} />
      <span>{thousands(max)} tys.</span>
    </div>
    <p className={styles.national}>Polska w {current.year} r.: <strong>{integer(current.national)}</strong> na 100 tys. mieszkańców</p>
  </div>;
}
