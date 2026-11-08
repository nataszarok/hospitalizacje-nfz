import Link from "next/link";
import type { ReactNode } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import styles from "./DataCard.module.css";

export const HOSPITALIZATION_SOURCE = "Dane NFZ o hospitalizacjach";

export interface DataCardProps {
  id: string;
  kicker: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  /** Opis pod wykresem: jak czytać wykres i co stoi za liczbami. */
  description?: ReactNode;
  href?: string;
  cta?: string;
  source?: string;
  /** Dane z estymacją wartości „<5” (znacznik „Szacunek”). */
  estimate?: boolean;
  wide?: boolean;
  /** `start`: wykres od góry (karty obok siebie z listami mają wiersze na tej samej wysokości). */
  chartAlign?: "center" | "start";
  headingLevel?: 2 | 3;
}

/** Karta z wykresem: pytanie, liczba, wykres, opis i stopka ze źródłem oraz linkiem do pełnego widoku. */
export function DataCard({ id, kicker, title, lead, children, description, href, cta, source = HOSPITALIZATION_SOURCE, estimate = true, wide = false, chartAlign = "center", headingLevel = 3 }: DataCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return <article className={`${styles.card} ${wide ? styles.wide : ""} ${chartAlign === "start" ? styles.alignStart : ""}`} aria-labelledby={id}>
    <span className={styles.kicker}>{kicker}</span>
    <Heading id={id} className={styles.title}>{title}</Heading>
    {lead ? <p className={styles.lead}>{lead}</p> : null}
    <div className={`${styles.chart} ${chartAlign === "start" ? styles.chartStart : ""}`}>{children}</div>
    {description ? <div className={styles.description}>{description}</div> : null}
    <footer className={styles.footer}>
      {estimate ? <span className={styles.badge} title="Wartości „<5” w danych NFZ liczone jako 1 (metoda konserwatywna).">Szacunek</span> : null}
      <span className={styles.source}>{source}</span>
      {href && cta ? <Link className={styles.link} href={href}>{cta} <PortalIcon name="arrow" size={16} /></Link> : null}
    </footer>
  </article>;
}

/** Legenda wykresu: kolorowe kwadraty z etykietami. */
export function Legend({ items }: { items: { label: string; color: string; border?: string }[] }) {
  return <div className={styles.legend} aria-hidden="true">
    {items.map((item) => <span key={item.label}><i style={{ background: item.color, border: item.border ? `1px solid ${item.border}` : undefined }} />{item.label}</span>)}
  </div>;
}
