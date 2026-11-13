import Link from "next/link";
import { PageHeader, pageContainerClass } from "@/components/portal/PageHeader";
import { PlannedBadge } from "@/components/portal/PlannedBadge";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import styles from "./ArticlesPage.module.css";

/**
 * Strona `/artykuly`. Moduł jest planowany: strona nie ma jeszcze tekstów, pokazuje stan „Planowane”
 * (ta sama plakietka co wiersz działu na stronie głównej) i odsyła do działających modułów.
 */
export function ArticlesPage() {
  return <main id="main-content">
    <PageHeader
      eyebrow="Artykuły"
      title="Artykuły"
      lead="Teksty o publicznej ochronie zdrowia na podstawie danych NFZ, m.in. o rozliczeniach i kontrolach NFZ."
    />
    <div className={`${pageContainerClass} ${styles.body}`}>
      <section className={styles.empty} aria-labelledby="articles-empty-title">
        <PlannedBadge />
        <h2 id="articles-empty-title">Pierwsze artykuły są w przygotowaniu.</h2>
        <p>Do tego czasu dane są w działających modułach portalu.</p>
        <ul className={styles.links}>
          <li><Link href={DASHBOARD_HREFS.summary}>Hospitalizacje w Polsce</Link></li>
          <li><Link href="/jgp">Grupy JGP</Link></li>
          <li><Link href={DASHBOARD_HREFS.hospitals}>Szpitale publiczne</Link></li>
        </ul>
      </section>
    </div>
  </main>;
}
