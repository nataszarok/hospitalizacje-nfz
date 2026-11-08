import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

/** Liczba w pasku nagłówka: etykieta, wartość i krótki dopisek. */
export interface PageHeaderKpi { label: ReactNode; value: ReactNode; note?: ReactNode }

/**
 * Nagłówek strony modułu (np. „Hospitalizacje w Polsce”, „Grupy JGP”): kolorowy pas na całą szerokość,
 * etykieta nad tytułem, tytuł, wstęp i pola z liczbami. `children`: elementy pod liczbami (spis treści, metoda).
 */
export function PageHeader({ eyebrow, title, lead, kpis, children }: { eyebrow: ReactNode; title: ReactNode; lead?: ReactNode; kpis?: PageHeaderKpi[]; children?: ReactNode }) {
  return <header className={styles.header}>
    <div className={styles.container}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      {lead ? <div className={styles.lead}>{lead}</div> : null}
      {kpis?.length ? <dl className={styles.kpis}>
        {kpis.map((kpi, i) => <div key={i}><dt>{kpi.label}</dt><dd>{kpi.value}</dd>{kpi.note ? <span>{kpi.note}</span> : null}</div>)}
      </dl> : null}
      {children}
    </div>
  </header>;
}

/** Kontener treści o szerokości nagłówka. */
export const pageContainerClass = styles.container;
