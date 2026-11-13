import Link from "next/link";
import { HospitalCatalogView } from "@/components/hospitals/HospitalCatalog";
import { PageHeader, pageContainerClass } from "@/components/portal/PageHeader";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import type { HospitalCatalog } from "@/lib/hospitalCatalog";
import styles from "@/components/jgp/JgpCatalog.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const millions = (value: number) => `${(value / 1_000_000).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mln`;

/** Strona katalogu szpitali (`/szpitale`), w układzie katalogu grup JGP (`PageHeader` + lista). */
export function HospitalCatalogPage({ catalog }: { catalog: HospitalCatalog }) {
  const range = catalog.years.length > 1 ? `${catalog.years[0]}–${catalog.latestYear}` : catalog.latestYear;
  const { totals } = catalog;
  return <main className={styles.page}>
    <PageHeader
      eyebrow={<>Szpitale · świadczeniodawcy · {range}</>}
      title="Szpitale"
      lead={<>
        <p>Szpitale i inni świadczeniodawcy, którzy leczyli pacjentów w szpitalu w ramach umowy z NFZ. Dla każdego: liczba hospitalizacji, śmiertelność, łóżka i miejsce w sieci szpitali (PSZ).</p>
        <p>Kliknij nazwę, aby otworzyć kartę szpitala (szpitale sieci PSZ i wybrane placówki; pozostałe są bez linku). Porównanie z podobnymi placówkami: <Link href={DASHBOARD_HREFS.comparison}>Porównania</Link>.</p>
      </>}
      kpis={[
        { label: `Świadczeniodawcy w ${catalog.latestYear} r.`, value: integer(totals.providers), note: "z hospitalizacjami w umowie z NFZ" },
        { label: "W sieci szpitali (PSZ)", value: integer(totals.inPsz), note: totals.latest ? `${Math.round((totals.inPszLatest / totals.latest) * 100)}% hospitalizacji` : null },
        { label: `Hospitalizacje w ${catalog.latestYear} r.`, value: millions(totals.latest), note: catalog.previousYear ? `w ${catalog.previousYear} r.: ${millions(totals.previous)}` : null },
        { label: "Łóżka (RPWDL)", value: integer(totals.beds), note: "stan rejestru" },
      ]}
    />
    <div className={pageContainerClass}>
      <HospitalCatalogView catalog={catalog} />
    </div>
  </main>;
}
