"use client";

import Link from "next/link";
import { Slider } from "@mantine/core";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CHART_COLORS } from "@/lib/chartPalette";
import { concentration, itemsForShare } from "@/lib/concentration";
import styles from "./ConcentrationChart.module.css";

export interface ConcentrationItem { key: string; label: string; value: number; href?: string }

const pct = (value: number) => `${value.toLocaleString("pl-PL", { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
/** Odmiana rzeczownika po liczbie: [1, 2–4, 5+], np. ["kod", "kody", "kodów"]. */
export function plural(count: number, [one, few, many]: [string, string, string]) {
  if (count === 1) return one;
  const tens = count % 100;
  return count % 10 >= 2 && count % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
}

/** „największy / największe / największych” zgodnie z liczbą (jak `plural`). */
const biggest = (count: number) => plural(count, ["największy", "największe", "największych"]);

/** Progi pokazane liniami odniesienia: ile pozycji daje połowę i 80% sumy. */
const MARKS = [50, 80];
/** Lista pozycji pod wykresem ma najwyżej tyle linii (stała wysokość sekcji); reszta w plakietce „+X”. */
const CHIP_LINES = 3;
/** Najwięcej pozycji mierzonych na liście (więcej nie zmieści się w trzech liniach). */
const MAX_MEASURED = 60;

/**
 * Koncentracja z suwakiem: krzywa skumulowanego udziału pozycji od największej (np. kody JGP i kwota NFZ).
 * Suwak wybiera liczbę pozycji N; zdanie nad wykresem odpowiada „N największych daje X% sumy”, linie odniesienia —
 * ile pozycji daje 50% i 80%. Wybrany punkt w kolorze sygnału (jedno wyróżnienie), pozycje N pod wykresem.
 */
export function ConcentrationChart({ items, measure, format, words, defaultCount = 10, ariaLabel }: {
  items: ConcentrationItem[];
  /** Miara w dopełniaczu, np. „kwoty NFZ”, „hospitalizacji”. */
  measure: string;
  format: (value: number) => string;
  /** Odmiana nazwy pozycji: [1, 2–4, 5+]. */
  words: [string, string, string];
  defaultCount?: number;
  ariaLabel: string;
}) {
  const ordered = useMemo(() => [...items].filter((item) => item.value > 0).sort((a, b) => b.value - a.value), [items]);
  const { cumulativePct, total } = useMemo(() => concentration(ordered.map((item) => item.value)), [ordered]);
  const n = ordered.length;
  const [picked, setPicked] = useState(defaultCount);
  const count = Math.min(Math.max(1, picked), n);
  // Ile pozycji mieści się w trzech liniach: mierzymy ukrytą kopię listy (te same style) po każdej zmianie i zmianie szerokości.
  const measureRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState(MAX_MEASURED);
  useLayoutEffect(() => {
    const list = measureRef.current;
    if (!list) return;
    const measure = () => {
      const items = [...list.children] as HTMLElement[];
      const tops = [...new Set(items.map((item) => item.offsetTop))].sort((a, b) => a - b);
      const limit = tops[CHIP_LINES];
      // Ostatnie miejsce zajmuje plakietka „+X”, gdy nie wszystkie pozycje się mieszczą.
      setFit(limit === undefined ? items.length : Math.max(1, items.filter((item) => item.offsetTop < limit).length - 1));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [ordered, count]);
  if (!n) return <p className={styles.empty}>Brak wartości w tym roku.</p>;
  const share = cumulativePct[count - 1];
  const sum = (share / 100) * total;

  // Wykres SVG: oś X — pozycje 1…N, oś Y — skumulowany udział 0–100% (siatka tylko na osi-mierze, DESIGN.md 6.1).
  const w = 760, h = 240, m = { l: 44, r: 12, t: 12, b: 30 };
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  const x = (rank: number) => m.l + (n === 1 ? iw : ((rank - 1) / (n - 1)) * iw);
  const y = (value: number) => m.t + ih - (value / 100) * ih;
  const path = cumulativePct.map((value, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(n).toFixed(1)} ${y(0)} L${x(1).toFixed(1)} ${y(0)} Z`;
  const marks = MARKS.map((value) => ({ value, items: itemsForShare(cumulativePct, value) }));

  return <div className={styles.wrap}>
    <p className={styles.answer} aria-live="polite">
      <b>{count}</b> {biggest(count)} {plural(count, words)} z {integer(n)} {count === 1 ? "daje" : "dają"}{" "}
      <b>{pct(share)}</b> {measure} ({format(sum)} z {format(total)}).
    </p>
    <div className={styles.slider}>
      <span className={styles.sliderLabel} id="concentration-slider">Liczba {words[2]}</span>
      <Slider min={1} max={n} step={1} value={count} onChange={setPicked} label={(value) => `${value} · ${pct(cumulativePct[value - 1])}`} aria-labelledby="concentration-slider" thumbLabel={`Liczba ${words[2]}`} />
    </div>
    <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>
      {[0, 25, 50, 75, 100].map((tick) => <g key={tick}>
        <line x1={m.l} x2={w - m.r} y1={y(tick)} y2={y(tick)} stroke={tick ? CHART_COLORS.grid : CHART_COLORS.borderStrong} strokeWidth={tick ? 1 : 1.5} />
        <text x={m.l - 8} y={y(tick) + 4} textAnchor="end" className={styles.tick}>{tick}%</text>
      </g>)}
      <path d={area} fill={CHART_COLORS.dataFaint} />
      <path d={path} fill="none" stroke={CHART_COLORS.data} strokeWidth={2.5} />
      {marks.map((mark) => <g key={mark.value}>
        {/* Linia odniesienia: kropkowana, z podpisem (DESIGN.md 6.2). */}
        <line x1={m.l} x2={x(mark.items)} y1={y(mark.value)} y2={y(mark.value)} stroke={CHART_COLORS.textSecondary} strokeDasharray="1 4" strokeLinecap="round" />
        <text x={x(mark.items) + 6} y={y(mark.value) + 14} className={styles.mark}>{mark.value}% → {mark.items} {plural(mark.items, words)}</text>
      </g>)}
      <line x1={x(count)} x2={x(count)} y1={y(0)} y2={y(share)} stroke={CHART_COLORS.signal} strokeWidth={1.5} />
      <circle cx={x(count)} cy={y(share)} r={6} fill={CHART_COLORS.signal} stroke="#fff" strokeWidth={2} />
      <text x={m.l} y={h - 8} className={styles.tick}>1</text>
      <text x={w - m.r} y={h - 8} textAnchor="end" className={styles.tick}>{integer(n)} {plural(n, words)} od największego</text>
    </svg>
    <div className={styles.chipsBox}>
      <ul className={styles.chips} aria-label={`${count} ${biggest(count)} ${plural(count, words)}`}>
        {ordered.slice(0, Math.min(count, fit)).map((item) => <li key={item.key} title={`${item.label}: ${format(item.value)}`}>
          {item.href ? <Link href={item.href}>{item.key}</Link> : item.key} <small>{format(item.value)}</small>
        </li>)}
        {count > fit ? <li className={styles.more} title={`Pozostałe ${count - fit} ${plural(count - fit, words)} z wybranych`}>+{count - fit}</li> : null}
      </ul>
      {/* Kopia do pomiaru: niewidoczna, bez linków, te same style. */}
      <ul ref={measureRef} className={`${styles.chips} ${styles.measure}`} aria-hidden>
        {ordered.slice(0, Math.min(count, MAX_MEASURED)).map((item) => <li key={item.key}><b>{item.key}</b> <small>{format(item.value)}</small></li>)}
      </ul>
    </div>
  </div>;
}
