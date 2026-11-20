"use client";

import { useRef, useState } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import base from "@/components/jgp/JgpPage.module.css";
import styles from "@/components/jgp/JgpTabs.module.css";
import own from "./ShareBars.module.css";

const pct = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * Część słupka 100%: nazwa, wartość i klasa koloru (np. `base.segmentUrgent`). `short`: podpis w odcinku (np. litera sekcji JGP);
 * `dark`: odcinek w ciemnym kolorze (biały podpis).
 */
export interface SharePart { key: string; label: string; value: number; className: string; short?: string; dark?: boolean }

/** Najmniejszy udział (%), przy którym odcinek ma podpis (skrót); udziały są w podpowiedzi. */
export const MIN_LABEL_SHARE = 6;
/** Wiersz: etykieta (np. rok), części i czy wiersz jest wybrany (rok karty). */
export interface ShareRow { key: string; label: string; parts: SharePart[]; on?: boolean }

/**
 * Legenda części słupków (kolor + nazwa); klasy kolorów jak w słupkach. `detail` (np. „: 14 316”) znika na telefonie
 * (DESIGN.md 7.1b): pozycje stoją obok siebie, liczby są w arkuszu słupka.
 */
export function ShareLegend({ parts }: { parts: (Pick<SharePart, "key" | "label" | "className"> & { detail?: string })[] }) {
  return <ul className={`${base.legend} ${own.legend}`} aria-label="Legenda">
    {parts.map((part) => <li key={part.key}><span className={`${base.swatch} ${part.className}`} aria-hidden />{part.label}{part.detail ? <span className={own.detail}>{part.detail}</span> : null}</li>)}
  </ul>;
}

/**
 * Słupki 100% w wierszach (np. tryb przyjęcia albo długość pobytu w latach). Udziały w dymku `ChartTooltip`
 * (DESIGN.md 6.3): najechanie albo fokus (Tab) na szerokim ekranie, dotknięcie wiersza na telefonie (arkusz od dołu).
 * Wybrany wiersz ma tło jak wybrany rok na wykresach.
 */
export function ShareBars({ rows, ariaLabel, labels = false }: { rows: ShareRow[]; ariaLabel: string; labels?: boolean }) {
  const phone = useMediaQuery(PHONE_QUERY) === true;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ key: string; anchor: Box } | null>(null);
  const shares = (row: ShareRow) => {
    const total = row.parts.reduce((sum, part) => sum + part.value, 0);
    return (value: number) => total ? (value / total) * 100 : 0;
  };
  const open = rows.find((row) => row.key === tip?.key);
  // Kotwica dymka: sam słupek (bez etykiety roku), więc dymek stoi obok słupka.
  const show = (key: string, target: Element) => setTip({ key, anchor: elementBox(target.querySelector("[data-bar]") ?? target) });
  return <div ref={wrapRef} style={{ position: "relative" }}>
    <ul className={styles.admRows} aria-label={ariaLabel}>
      {rows.map((row) => {
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
          <span data-bar className={`${styles.admBar} ${labels ? own.tall : ""}`} aria-hidden>
            {row.parts.map((part) => {
              if (!part.value) return null;
              const value = share(part.value);
              const text = labels && value >= MIN_LABEL_SHARE ? part.short ?? null : null;
              return <span key={part.key} className={`${base.segment} ${part.className} ${labels ? own.label : ""} ${part.dark ? own.onDark : ""}`} style={{ width: `${value}%` }}>{text}</span>;
            })}
          </span>
        </li>;
      })}
    </ul>
    {tip && open ? <ChartTooltip anchor={tip.anchor} container={wrapRef} kind="bar-horizontal" onClose={() => setTip(null)}>
      <TooltipHead title={open.label} />
      <TooltipLines lines={open.parts.map((part) => <span key={part.key} className={own.tipLine}>
        <i className={`${base.swatch} ${part.className}`} aria-hidden />{part.label}<b>{pct(shares(open)(part.value))}</b>
      </span>)} />
    </ChartTooltip> : null}
  </div>;
}
