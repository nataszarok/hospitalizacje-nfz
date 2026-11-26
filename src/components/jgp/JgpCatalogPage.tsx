import { plural } from "@/lib/jgpDescription";
import Link from "next/link";
import { JgpCatalogView } from "@/components/jgp/JgpCatalog";
import { articleHref, findArticle } from "@/lib/articles";
import { PageHeader, pageContainerClass } from "@/components/portal/PageHeader";
import type { JgpCatalog } from "@/lib/jgpCatalog";
import styles from "./JgpCatalog.module.css";

/** Artykuł wprowadzający, linkowany we wstępie katalogu. */
const intro = findArticle("czym-sa-jgp");

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const millions = (value: number) => `${(value / 1_000_000).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mln`;

/** Strona katalogu grup JGP (`/jgp`). Nagłówek w stylu kart modułów (`PageHeader`). */
export function JgpCatalogPage({ catalog }: { catalog: JgpCatalog }) {
  const range = catalog.years.length > 1 ? `${catalog.years[0]}–${catalog.latestYear}` : catalog.latestYear;
  return <main className={styles.page}>
    <PageHeader
      eyebrow={<>Hospitalizacje · grupy JGP · {range}</>}
      title="Grupy JGP"
      lead={<>
        <p>Przeglądaj wszystkie grupy JGP. Kliknij kod lub nazwę grupy, aby zobaczyć trendy hospitalizacji, realizujące je szpitale, rozkład regionalny, tryby przyjęcia oraz wycenę świadczeń.</p>
        <p><Link className={styles.introArticle} href={articleHref(intro.slug)}>{intro.title} Wyjaśniamy od zera, na historii czterech pacjentów →</Link></p>
      </>}
      kpis={[
        { label: `Grupy aktywne ${catalog.latestYear}`, value: integer(catalog.totals.groups), unit: plural(catalog.totals.groups, "grupa aktywna", "grupy aktywne", "grup aktywnych"), note: `z ${integer(catalog.totals.all)} grup (${range})` },
        { label: `Hospitalizacje ${catalog.latestYear}`, value: millions(catalog.totals.latest), unit: "hospitalizacji", note: catalog.previousYear ? `w ${catalog.previousYear} r.: ${millions(catalog.totals.previous)}` : null },
        { label: `Nowe grupy ${catalog.latestYear}`, value: integer(catalog.totals.added), unit: plural(catalog.totals.added, "nowa grupa", "nowe grupy", "nowych grup"), note: catalog.previousYear ? `brak w katalogu ${catalog.previousYear}` : null },
        { label: "Grupy wycofane", value: integer(catalog.totals.discontinued), unit: plural(catalog.totals.discontinued, "grupa wycofana", "grupy wycofane", "grup wycofanych"), note: `brak w katalogu ${catalog.latestYear}` },
      ]}
    />
    <div className={pageContainerClass}>
      <JgpCatalogView catalog={catalog} />
    </div>
  </main>;
}
