import { HospitalCard } from "@/components/hospitals/HospitalCard";
import type { HospitalPageData } from "@/lib/hospitalPage";
import styles from "@/components/jgp/JgpPage.module.css";

/** Strona szpitala `/szpitale/[nip]`: karta w układzie karty grupy JGP (docs/karta-szpitala.html). */
export function HospitalPage({ data }: { data: HospitalPageData }) {
  return <main className={styles.page}><HospitalCard data={data} /></main>;
}
