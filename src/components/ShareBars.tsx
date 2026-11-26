"use client";

import { useRef, useState } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { useElementWidth } from "@/lib/useElementWidth";
import base from "@/components/jgp/JgpPage.module.css";
import styles from "@/components/jgp/JgpTabs.module.css";
import own from "./ShareBars.module.css";

const pct = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * Część słupka 100%: nazwa, wartość i klasa koloru (np. `base.segmentUrgent`). `short`: podpis w odcinku (np. litera sekcji JGP);
 * `dark`: odcinek w ciemnym kolorze (biały podpis); `color`: kolor spoza klas (np. paleta wariantów rodziny JGP);
 * `outlined`: ramka w odcinku (np. ta grupa JGP wśród wariantów rodziny).
 */
export interface SharePart { key: string; label: string; value: number; className: string; short?: string; dark?: boolean; color?: string; outlined?: boolean }

/** Najmniejszy udział (%), przy którym odcinek ma podpis (skrót), zanim znamy szerokość słupka; udziały są w podpowiedzi. */
export const MIN_LABEL_SHARE = 6;
/** Przybliżona szerokość podpisu w odcinku (`--fs-xs`, półgruby) z marginesem 6 px. */
export const shareLabelWidth = (text: string) => text.length * 6.6 + 6;
/** Wiersz: etykieta (np. rok), części, czy wiersz jest wybrany (rok karty) i opcjonalna suma po prawej (np. „59 680”). */
export interface ShareRow { key: string; label: string; parts: SharePart[]; on?: boolean; total?: string }

/**
 * Legenda części słupków (kolor + nazwa); klasy kolorów jak w słupkach. `detail` (np. „: 14 316”) znika na telefonie
 * (DESIGN.md 7.1b): pozycje stoją obok siebie, liczby są w arkuszu słupka.
 */
export function ShareLegend({ parts }: { parts: (Pick<SharePart, "key" | "label" | "className" | "color"> & { detail?: string })[] }) {
  return <ul className={`${base.legend} ${own.legend}`} aria-label="Legenda">
    {parts.map((part) => <li key={part.key}><span className={`${base.swatch} ${part.className}`} style={part.color ? { background: part.color } : undefined} aria-hidden />{part.label}{part.detail ? <span className={own.detail}>{part.detail}</span> : null}</li>)}
  </ul>;
}

/**
 * Słupki 100% w wierszach (np. tryb przyjęcia albo długość pobytu w latach). Udziały w dymku `ChartTooltip`
 * (DESIGN.md 6.3): najechanie albo fokus (Tab) na szerokim ekranie, dotknięcie wiersza na telefonie (arkusz od dołu).
 * Wybrany wiersz ma tło jak wybrany rok na wykresach.
 */
export function ShareBars({ rows, ariaLabel, labels = false, totalUnit }: {
  rows: ShareRow[]; ariaLabel: string; labels?: boolean;
  /** Słowo po sumie w dymku wiersza („59 680 hospitalizacji rodziny”); w kolumnie sumy sama liczba. */
  totalUnit?: string;
}) {
  const phone = useMediaQuery(PHONE_QUERY) === true;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ key: string; anchor: Box } | null>(null);
  const shares = (row: ShareRow) => {
    const total = row.parts.reduce((sum, part) => sum + part.value, 0);
    return (value: number) => total ? (value / total) * 100 : 0;
  };
  const open = rows.find((row) => row.key === tip?.key);
  // Podpis w odcinku tylko wtedy, gdy się mieści (szerokość pierwszego słupka; wszystkie są równe).
  // Przed pomiarem (render na serwerze) — próg udziału `MIN_LABEL_SHARE`.
  const { ref: barRef, width: barWidth } = useElementWidth<HTMLSpanElement>();
  const fits = (text: string, value: number) => barWidth > 0 ? shareLabelWidth(text) <= (barWidth * value) / 100 : value >= MIN_LABEL_SHARE;
  const withTotals = rows.some((row) => row.total !== undefined);
  // Kotwica dymka: sam słupek (bez etykiety roku), więc dymek stoi obok słupka.
  const show = (key: string, target: Element) => setTip({ key, anchor: elementBox(target.querySelector("[data-bar]") ?? target) });
  return <div ref={wrapRef} style={{ position: "relative" }}>
    <ul className={`${styles.admRows} ${withTotals ? own.withTotals : ""}`} aria-label={ariaLabel}>
      {rows.map((row, r) => {
        const share = shares(row);
        const label = `${row.label}: ${row.parts.map((part) => `${part.label} ${pct(share(part.value))}`).join(", ")}`;
        return <li
          key={row.key} className={`${styles.admRow} ${row.on ? styles.admRowOn : ""}`} tabIndex={0} aria-label={label}
          onClick={phone ? (event) => show(row.key, event.currentTarget) : undefined}
          onMouseEnter={phone ? undefined : (event) => show(row.key, event.currentTarget)}
          onMouseLeave={phone ? undefined : () => setTip(null)}
          onFocus={phone ? undefined : (event) => show(row.key, event.currentTarget)}
          onBlur={phone ? undefined : () => setTip(null)}
        >
          <span className={styles.admYear} aria-hidden>{row.label}</span>
          <span ref={r === 0 ? barRef : undefined} data-bar className={`${styles.admBar} ${labels ? own.tall : ""}`} aria-hidden>
            {row.parts.map((part) => {
              if (!part.value) return null;
              const value = share(part.value);
              const text = labels && part.short && fits(part.short, value) ? part.short : null;
              return <span key={part.key}
                className={`${base.segment} ${part.className} ${labels ? own.label : ""} ${part.dark ? own.onDark : ""} ${part.outlined ? own.outlined : ""}`}
                style={{ width: `${value}%`, ...(part.color ? { background: part.color } : {}) }}>{text}</span>;
            })}
          </span>
          {withTotals ? <span className={own.total} aria-hidden>{row.total}</span> : null}
        </li>;
      })}
    </ul>
    {tip && open ? <ChartTooltip anchor={tip.anchor} container={wrapRef} kind="bar-horizontal" onClose={() => setTip(null)}>
      <TooltipHead title={open.label} context={open.total && totalUnit ? `${open.total} ${totalUnit}` : open.total} />
      <TooltipLines lines={open.parts.map((part) => <span key={part.key} className={own.tipLine}>
        <i className={`${base.swatch} ${part.className}`} style={part.color ? { background: part.color } : undefined} aria-hidden />{part.label}<b>{pct(shares(open)(part.value))}</b>
      </span>)} />
    </ChartTooltip> : null}
  </div>;
}
