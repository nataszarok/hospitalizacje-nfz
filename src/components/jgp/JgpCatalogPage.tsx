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
      <p><b>J</b>ednorodne <b>G</b>rupy <b>P</b>acjentów (JGP) to system klasyfikacji hospitalizacji stosowany przez NFZ, 
      który grupuje przypadki o podobnym charakterze klinicznym i kosztach leczenia. Jest wykorzystywany do sprawozdawania
      świadczeń szpitalnych oraz, w zależności od sposobu finansowania, ich rozliczania.</p>
      <p>Przeglądaj wszystkie grupy JGP. Kliknij kod lub nazwę grupy, aby zobaczyć trendy hospitalizacji, realizujące je szpitale, rozkład regionalny, tryby przyjęcia oraz wycenę świadczeń.</p>
    </header>
    <JgpCatalogView catalog={catalog} />
  </main>;
}
