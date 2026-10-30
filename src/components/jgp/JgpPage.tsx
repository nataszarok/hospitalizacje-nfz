import Link from "next/link";
import { ProviderLink } from "@/components/TableLinks";
import { TrendView } from "@/components/trends/TrendView";
import { formatCityName } from "@/lib/formatters";
import type { JgpPageData } from "@/lib/jgpPage";
import styles from "./JgpPage.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const pct = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function yearRange(years: string[]) {
  return years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0] ?? "—";
}

/** Strona grupy JGP: trend we wszystkich latach i ranking świadczeniodawców z najnowszego roku. */
export function JgpPage({ data }: { data: JgpPageData }) {
  const explorerHref = `/analizy?jgp=${encodeURIComponent(data.jgpCode)}`;
  return <main className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Ścieżka">
      <Link href="/analizy">Analizy</Link> <span aria-hidden>›</span> <span>Grupy JGP</span>
    </nav>

    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Grupa JGP</div>
        <h1><span className={styles.code}>{data.jgpCode}</span> {data.name}</h1>
        <p>
          Produkt {data.productCodes.join(", ")} · w danych: {yearRange(data.catalogYears)} ·
          {" "}{integer(data.hospitalizations)} hospitalizacji u {integer(data.providerCount)} świadczeniodawców w {data.year} r.
        </p>
      </div>
      <Link className={styles.explorerLink} href={explorerHref}>Pokaż w eksploratorze →</Link>
    </header>

    <section className={styles.section} aria-labelledby="jgp-trend">
      <h2 id="jgp-trend" className={styles.sectionTitle}>Jak to się zmieniało w czasie</h2>
      <TrendView productCodes={data.productCodes} method="min" />
    </section>

    <section className={styles.section} aria-labelledby="jgp-providers">
      <h2 id="jgp-providers" className={styles.sectionTitle}>Kto leczy najwięcej · {data.year}</h2>
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th><th>Świadczeniodawca</th><th>Miasto</th><th>Województwo</th>
              <th className={styles.num}>Hospitalizacje</th><th className={styles.num}>Śmiertelność</th><th className={styles.num}>Nagłe</th>
            </tr>
          </thead>
          <tbody>
            {data.topProviders.map((row, index) => <tr key={row.key}>
              <td>{index + 1}</td>
              <td><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /></td>
              <td>{formatCityName(row.city)}</td>
              <td>{row.voivodeship}</td>
              <td className={styles.num}>{integer(row.hospitalizations)}</td>
              <td className={styles.num}>{pct(row.mortalityPct)}</td>
              <td className={styles.num}>{pct(row.urgentPct)}</td>
            </tr>)}
          </tbody>
        </table>
        <p className={styles.note}>
          {data.topProviders.length} z {integer(data.providerCount)} świadczeniodawców. Wartości &lt;5 liczone metodą konserwatywną (każde &lt;5 = 1).
          {" "}<Link href={`/analizy?t=k&jgp=${encodeURIComponent(data.jgpCode)}`}>Wszyscy świadczeniodawcy: wolumen a śmiertelność →</Link>
        </p>
      </div>
    </section>

    <RegionsSection data={data} />

    <section className={styles.planned}>
      <strong>Planowane:</strong> wycena grupy i jej zmiany, artykuły o tej grupie.
    </section>
  </main>;
}

function RegionsSection({ data }: { data: JgpPageData }) {
  const max = Math.max(...data.regions.map((row) => row.per100k), 0);
  const people = data.regions.reduce((sum, row) => sum + row.population, 0);
  const national = people ? (data.regions.reduce((sum, row) => sum + row.hospitalizations, 0) / people) * 100_000 : 0;
  const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <section className={styles.section} aria-labelledby="jgp-regions">
    <h2 id="jgp-regions" className={styles.sectionTitle}>Gdzie · {data.year}</h2>
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Województwo</th><th>Na 100 tys. mieszkańców</th>
            <th className={styles.num}>Hospitalizacje</th><th className={styles.num}>Śmiertelność</th><th className={styles.num}>Nagłe</th>
          </tr>
        </thead>
        <tbody>
          {data.regions.map((row) => <tr key={row.owNfz}>
            <td>{row.name}</td>
            <td>
              <div className={styles.barCell}>
                <span className={styles.bar} style={{ width: `${max ? (row.per100k / max) * 100 : 0}%` }} aria-hidden />
                <span className={styles.barValue}>{decimal(row.per100k)}</span>
              </div>
            </td>
            <td className={styles.num}>{integer(row.hospitalizations)}</td>
            <td className={styles.num}>{pct(row.mortalityPct)}</td>
            <td className={styles.num}>{pct(row.urgentPct)}</td>
          </tr>)}
        </tbody>
      </table>
      <p className={styles.note}>
        Średnia dla Polski: {decimal(national)} na 100 tys. Województwo świadczeniodawcy, nie miejsce zamieszkania pacjenta.
        {" "}<Link href={`/analizy?t=g&jgp=${encodeURIComponent(data.jgpCode)}`}>Porównaj w eksploratorze →</Link>
      </p>
    </div>
  </section>;
}
