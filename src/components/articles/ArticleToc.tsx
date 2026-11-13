import styles from "./Article.module.css";

export interface ArticleTocItem { id: string; label: string }

/**
 * Spis treści artykułu (DESIGN.md 7.2). Szeroki ekran: przyklejona lista obok tekstu.
 * Do 1100 px: zwinięty `<details>` nad tekstem, żeby tekst zaczynał się na pierwszym ekranie telefonu.
 * Lista jest w HTML dwa razy; CSS pokazuje jedną wersję (bez JS, bez przesunięcia układu po załadowaniu).
 */
export function ArticleToc({ items }: { items: readonly ArticleTocItem[] }) {
  const list = <ol>{items.map((item) => <li key={item.id}><a href={`#${item.id}`}>{item.label}</a></li>)}</ol>;
  return <nav className={styles.toc} aria-label="Spis treści">
    <div className={styles.tocWide}>
      <span className={styles.tocTitle}>W tym tekście</span>
      {list}
    </div>
    <details className={styles.tocNarrow}>
      <summary>W tym tekście <span>{items.length} części</span></summary>
      {list}
    </details>
  </nav>;
}
