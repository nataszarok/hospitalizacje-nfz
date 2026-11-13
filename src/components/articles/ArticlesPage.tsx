import Link from "next/link";
import { PageHeader, pageContainerClass } from "@/components/portal/PageHeader";
import { PlannedBadge } from "@/components/portal/PlannedBadge";
import { articleHref, type Article } from "@/lib/articles";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import listStyles from "./Article.module.css";
import styles from "./ArticlesPage.module.css";

/**
 * Strona `/artykuly`: lista artykułów (wiersze oddzielone linią, jak lista działów na stronie głównej).
 * Bez artykułów pokazuje stan „Planowane” (ta sama plakietka co wiersz działu) i odsyła do działających modułów.
 */
export function ArticlesPage({ articles }: { articles: readonly Article[] }) {
  return <main id="main-content">
    <PageHeader
      eyebrow="Artykuły"
      title="Artykuły"
      lead="Teksty o publicznej ochronie zdrowia: jak działa system, skąd biorą się liczby i jak je czytać."
    />
    {articles.length ? <div className={listStyles.list}>
      <ul>
        {articles.map((article) => <li key={article.slug}>
          <Link className={listStyles.listItem} href={articleHref(article.slug)}>
            <span className={listStyles.listKicker}>{article.kicker}</span>
            <span className={listStyles.listTitle}>{article.title}</span>
            <span className={listStyles.listDescription}>{article.description}</span>
          </Link>
        </li>)}
      </ul>
    </div> : <div className={`${pageContainerClass} ${styles.body}`}>
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
    </div>}
  </main>;
}
