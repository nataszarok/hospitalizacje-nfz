import Link from "next/link";
import { JgpCardSections } from "@/components/jgp/JgpCard";
import { packPageData, topShare, yearChangePct, type RegionsMap } from "@/lib/jgpCard";
import type { JgpPageData } from "@/lib/jgpPage";
import styles from "./JgpPage.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (value: number) => `${decimal(value)}%`;

function yearRange(years: string[]) {
  return years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0] ?? "—";
}

/** Strona grupy JGP: liczby grupy, trend, ośrodki, województwa, tryb przyjęcia i wycena. */
export function JgpPage({ data, map = null }: { data: JgpPageData; map?: RegionsMap | null }) {
  const explorerHref = `/analizy?jgp=${encodeURIComponent(data.jgpCode)}`;
  const deaths = data.providers.reduce((sum, row) => sum + row.deaths, 0);
  const urgent = data.providers.reduce((sum, row) => sum + (row.urgentPct / 100) * row.hospitalizations, 0);
  const change = yearChangePct(data.hospitalizations, data.previousHospitalizations);
  const latestValue = data.valuePln.at(-1);
  const firstValue = data.valuePln[0];
  return <main className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Ścieżka">
      <Link href="/jgp">Grupy JGP</Link> <span aria-hidden>›</span> <span>{data.jgpCode}</span>
    </nav>

    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Grupa JGP · {data.procedural ? "zabiegowa" : "zachowawcza"}</div>
        <h1><span className={styles.code}>{data.jgpCode}</span> {data.name}</h1>
        <p>Produkt {data.productCodes.join(", ")} · w danych: {yearRange(data.catalogYears)}</p>
      </div>
      <Link className={styles.explorerLink} href={explorerHref}>Pokaż w eksploratorze →</Link>
    </header>

    {!data.catalogYears.includes(data.year) ? <p className={styles.notice}>
      Grupa nie występuje w danych z {data.year} r. (w danych: {yearRange(data.catalogYears)}) — zmiana katalogu JGP.
      Wykres „W czasie” pokazuje lata, w których grupa istniała.
    </p> : null}

    <dl className={styles.kpiBand} aria-label="Liczby grupy">
      <div><dt>Hospitalizacje {data.year}</dt><dd>{integer(data.hospitalizations)}</dd><span>{change === null ? "brak poprzedniego roku" : `${change > 0 ? "+" : ""}${decimal(change)}% r/r`}</span></div>
      <div><dt>Świadczeniodawcy</dt><dd>{integer(data.providerCount)}</dd><span>top 25 = {pct(topShare(data.providers))} hospitalizacji</span></div>
      <div><dt>Przyjęcia nagłe</dt><dd>{data.hospitalizations ? pct((urgent / data.hospitalizations) * 100) : "—"}</dd><span>tryb 2 i 3</span></div>
      <div><dt>Śmiertelność</dt><dd>{data.hospitalizations ? pct((deaths / data.hospitalizations) * 100) : "—"}</dd><span>zgony w szpitalu</span></div>
      {data.valuation?.points ? <div className={styles.kpiValue}><dt>Wycena {data.valuation.year}</dt><dd>{integer(data.valuation.points)} pkt</dd><span>za hospitalizację</span></div> : null}
      {latestValue ? <div className={styles.kpiValue}><dt>Rozliczenia NFZ {latestValue.year}</dt><dd>{(latestValue.value / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mln zł</dd><span>{firstValue && firstValue !== latestValue ? `${firstValue.year}: ${(firstValue.value / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mln zł` : "w kraju"}</span></div> : null}
    </dl>

    <JgpCardSections packed={packPageData(data)} map={map} />

    <section className={styles.planned}>
      <strong>Planowane:</strong> ośrodki na mapie, rodzina grup OZW, wycena w kolejnych latach, artykuły o tej grupie.
    </section>
  </main>;
}
