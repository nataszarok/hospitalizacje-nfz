import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

/** Liczba w pasku nagłówka: etykieta, wartość i krótki dopisek. */
export interface PageHeaderKpi { label: ReactNode; value: ReactNode; note?: ReactNode }

/**
 * Nagłówek strony modułu (np. „Hospitalizacje w Polsce”, „Grupy JGP”): kolorowy pas na całą szerokość,
 * etykieta nad tytułem, tytuł, wstęp i pola z liczbami. `children`: elementy pod liczbami (spis treści, metoda).
 * `compact`: niższy pas i mniejszy tytuł (narzędzia, w których liczy się miejsce na wykres); `actions`: przyciski obok tytułu.
 */
export function PageHeader({ eyebrow, title, lead, kpis, compact, actions, children }: {
  eyebrow: ReactNode; title: ReactNode; lead?: ReactNode; kpis?: PageHeaderKpi[]; compact?: boolean; actions?: ReactNode; children?: ReactNode;
}) {
  return <header className={`${styles.header} ${compact ? styles.compact : ""}`}>
    <div className={styles.container}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      {actions ? <div className={styles.titleRow}><h1 className={styles.title}>{title}</h1><div className={styles.actions}>{actions}</div></div> : <h1 className={styles.title}>{title}</h1>}
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
