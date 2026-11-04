import { JgpTabbedCard } from "@/components/jgp/JgpTabbedCard";
import { packPageData, type RegionsMap } from "@/lib/jgpCard";
import type { JgpPageData } from "@/lib/jgpPage";
import styles from "./JgpPage.module.css";

/** Strona grupy JGP: karta w zakładkach „Przegląd” i „Ośrodki” (docs/karta-jgp-pytania.html). */
export function JgpPage({ data, map = null }: { data: JgpPageData; map?: RegionsMap | null }) {
  return <main className={styles.page}><JgpTabbedCard packed={packPageData(data)} map={map} /></main>;
}
