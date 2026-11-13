import Link from "next/link";
import { PageHeader } from "@/components/portal/PageHeader";
import { articleHref, type Article } from "@/lib/articles";
import styles from "./Article.module.css";

/** Lista artykułów (`/artykuly`). */
export function ArticleIndexPage({ articles }: { articles: readonly Article[] }) {
  return <main>
    <PageHeader
      eyebrow="Artykuły"
      title="Artykuły"
      lead={<p>Teksty o publicznej ochronie zdrowia: jak działa system, skąd biorą się liczby i jak je czytać.</p>}
    />
    <div className={styles.list}>
      <ul>
        {articles.map((article) => <li key={article.slug}>
          <Link className={styles.listItem} href={articleHref(article.slug)}>
            <span className={styles.listKicker}>{article.kicker}</span>
            <span className={styles.listTitle}>{article.title}</span>
            <span className={styles.listDescription}>{article.description}</span>
          </Link>
        </li>)}
      </ul>
    </div>
  </main>;
}
