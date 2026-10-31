import { JgpCatalogView } from "@/components/jgp/JgpCatalog";
import type { JgpCatalog } from "@/lib/jgpCatalog";
import styles from "./JgpCatalog.module.css";

/** Strona katalogu grup JGP (`/jgp`). */
export function JgpCatalogPage({ catalog }: { catalog: JgpCatalog }) {
  const range = catalog.years.length > 1 ? `${catalog.years[0]}–${catalog.latestYear}` : catalog.latestYear;
  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.eyebrow}>Hospitalizacje · grupy JGP · {range}</div>
      <h1>Grupy JGP</h1>
      <p>Wszystkie grupy JGP z danych NFZ. Kod albo nazwa otwiera kartę grupy: trend, ośrodki, województwa, tryb przyjęcia i wycena.</p>
    </header>
    <JgpCatalogView catalog={catalog} />
  </main>;
}
