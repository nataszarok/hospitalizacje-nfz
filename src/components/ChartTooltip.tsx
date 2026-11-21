"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { placeTooltip, viewportBox, type AnchorKind, type Box } from "@/lib/tooltipPosition";
import styles from "./ChartTooltip.module.css";

/**
 * Dymek rozszerzony (HTML) dla wykresów: porównanie z podobnymi szpitalami, profil szpitala, mapa drzewa
 * (DESIGN.md, 6.3). Pozycję liczy `placeTooltip` z prostokąta obiektu, więc dymek nie zasłania punktu,
 * słupka ani kafla. Treść składamy z części: `TooltipHead`, `TooltipKeyValue`, `TooltipCompareTable`,
 * `TooltipSection`, `TooltipNote`.
 *
 * Telefon (< 640 px) z `onClose`: arkusz od dołu (`BottomSheet`) zamiast dymka; strona przewija się tak, że obiekt
 * stoi nad arkuszem. Wykres bez `onClose` zostaje przy dymku (zamyka go tylko zjechanie kursora).
 */
export function ChartTooltip({ anchor, container, kind = "point", onClose, sheetTitle = "Szczegóły", children }: {
  /** Prostokąt opisywanego obiektu we współrzędnych okna. */
  anchor: Box;
  /** Element z `position: relative`, w którym stoi dymek (ref czytamy po renderze). */
  container: RefObject<HTMLElement | null>;
  kind?: AnchorKind;
  /** Zamknięcie arkusza na telefonie („Zamknij”, dotknięcie tła, Esc). */
  onClose?: () => void;
  /** Tytuł paska arkusza; nazwa obiektu jest w treści (`TooltipHead`). */
  sheetTitle?: string;
  children: ReactNode;
}) {
  const phone = useMediaQuery(PHONE_QUERY) === true && !!onClose;
  if (phone) return <TooltipSheet anchor={anchor} title={sheetTitle} onClose={onClose!}>{children}</TooltipSheet>;
  return <FloatingTooltip anchor={anchor} container={container} kind={kind}>{children}</FloatingTooltip>;
}

/** Arkusz dymka na telefonie: po otwarciu obiekt (`anchor`) przesuwa się nad górną krawędź arkusza. */
function TooltipSheet({ anchor, title, onClose, children }: { anchor: Box; title: string; onClose: () => void; children: ReactNode }) {
  const top = anchor.top, bottom = anchor.top + anchor.height;
  useEffect(() => {
    const sheet = document.querySelector<HTMLElement>("[data-tooltip-sheet]");
    if (!sheet) return;
    const limit = sheet.getBoundingClientRect().top - 12;
    // Obiekt pod arkuszem: przewijamy w dół, ale nie wyżej niż górna krawędź obiektu (zostaje na ekranie).
    if (bottom > limit) window.scrollBy({ top: Math.min(bottom - limit, Math.max(0, top - 64)), behavior: "smooth" });
  }, [top, bottom]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <BottomSheet title={title} onClose={onClose} sheetData="tooltip">{children}</BottomSheet>;
}

function FloatingTooltip({ anchor, container, kind, children }: { anchor: Box; container: RefObject<HTMLElement | null>; kind: AnchorKind; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Pozycja po pomiarze dymka: wysokość zależy od treści. Ustawiamy styl wprost (bez drugiego renderu).
  useLayoutEffect(() => {
    const element = ref.current;
    // Przy pierwszym renderze razem z kontenerem jego ref może być jeszcze pusty: wtedy rodzic dymka.
    const host = container.current ?? element?.parentElement;
    if (!element || !host) return;
    const box = host.getBoundingClientRect();
    const place = placeTooltip({
      anchor,
      tooltip: { width: element.offsetWidth, height: element.offsetHeight },
      viewport: viewportBox(),
      container: { left: box.left, top: box.top },
      kind,
    });
    element.style.left = `${place.left}px`;
    element.style.top = `${place.top}px`;
    element.style.setProperty("--tooltip-arrow", `${place.arrow}px`);
    element.dataset.placement = place.placement;
    element.dataset.ready = "true";
  });

  return <div ref={ref} className={styles.tooltip} role="tooltip">{children}</div>;
}

/** Nazwa (pogrubiona, cała, w kilku liniach) i kontekst szarym: miejscowość · województwo · kod. */
export function TooltipHead({ title, context }: { title: ReactNode; context?: ReactNode }) {
  return <div className={styles.head}>
    <b className={styles.title}>{title}</b>
    {context ? <span className={styles.context}>{context}</span> : null}
  </div>;
}

/** Jedna wartość kluczowa: etykieta, duża liczba (granat) i różnica słowami w kolorze znaku. */
export function TooltipKeyValue({ label, value, delta, tone }: {
  label: ReactNode;
  value: ReactNode;
  /** Różnica słowami, np. „+5,7 pp wobec grupy porównawczej”. */
  delta?: ReactNode;
  /** Znak różnicy: „up” = powyżej (ciepły), „down” = poniżej (błękit). */
  tone?: "up" | "down";
}) {
  return <div className={styles.keyValue}>
    <span className={styles.label}>{label}</span>
    <strong className={styles.value}>{value}</strong>
    {delta ? <span className={`${styles.delta} ${tone === "up" ? styles.up : tone === "down" ? styles.down : ""}`}>{delta}</span> : null}
  </div>;
}

/** Tabela porównania: wiersze = miary, kolumny = obiekty („Ten szpital”, „Podobne (12)”); liczby do prawej. */
export function TooltipCompareTable({ columns, rows }: { columns: ReactNode[]; rows: { label: ReactNode; values: ReactNode[] }[] }) {
  return <table className={styles.compare}>
    <thead><tr><th scope="col"><span className={styles.srOnly}>Miara</span></th>{columns.map((column, i) => <th key={i} scope="col">{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{row.label}</th>{row.values.map((value, j) => <td key={j}>{value}</td>)}</tr>)}</tbody>
  </table>;
}

/** Sekcja z tytułem (wersaliki) i wierszami „Etykieta: wartość”. Najwyżej 2 sekcje w dymku. */
export function TooltipSection({ title, rows }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; hint?: ReactNode }[] }) {
  return <div className={styles.section}>
    {title ? <div className={styles.sectionTitle}>{title}</div> : null}
    <dl className={styles.rows}>
      {rows.map((row, i) => <div key={i} className={styles.row}>
        <dt>{row.label}{row.hint ? <small>{row.hint}</small> : null}</dt>
        <dd>{row.value}</dd>
      </div>)}
    </dl>
  </div>;
}

/** Wiersze tekstu pod nagłówkiem (np. „411 hosp. · nagłe 85,9%”). */
export function TooltipLines({ lines }: { lines: ReactNode[] }) {
  return <div className={styles.lines}>{lines.map((line, i) => <div key={i}>{line}</div>)}</div>;
}

/** Przypis metody pod treścią dymka. */
export function TooltipNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}
