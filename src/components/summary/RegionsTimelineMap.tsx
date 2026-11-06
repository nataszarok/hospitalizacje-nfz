"use client";

import { useState } from "react";
import { YearPlayer } from "@/components/YearPlayer";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import type { SummaryRegionTimeline } from "@/lib/hospitalizationSummary";
import { scaleColor } from "@/lib/jgpCard";
import styles from "./RegionsTimelineMap.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const thousands = (value: number) => (value / 1000).toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export { PLAY_STEP_MS } from "@/components/YearPlayer";

/**
 * Mapa województw: hospitalizacje na 100 tys. mieszkańców w wybranym roku.
 * Suwak wybiera rok, przycisk odtwarza lata po kolei. Skala koloru jest wspólna dla wszystkich lat,
 * więc kolor pokazuje też zmianę w czasie.
 */
export function RegionsTimelineMap({ timeline }: { timeline: SummaryRegionTimeline }) {
  const last = timeline.years.length - 1;
  const [index, setIndex] = useState(last);

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

  return <div className={styles.wrap}>
    <YearPlayer years={timeline.years.map((y) => y.year)} index={index} onIndex={setIndex} />
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
