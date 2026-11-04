import Link from "next/link";
import type { ReactNode } from "react";
import { LegacyDashboardRedirect } from "@/components/portal/LegacyDashboardRedirect";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { SITE_NAME } from "@/lib/site";
import { formatCompactCount, formatYearRange } from "@/lib/formatters";
import type { DatasetHighlights } from "@/lib/staticData";
import type { HomeStats } from "@/lib/homeStats";
import { AdmissionBars, ChangeList, GroupBars, MapLegend, RegionsMiniMap, YearBars } from "@/components/portal/HomeCharts";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { SearchBox } from "@/components/search/SearchBox";
import styles from "./HomePage.module.css";

// Dział bez href jest pokazywany jako „Planowane”.
type Topic = {
  title: string;
  description: string;
  icon: Parameters<typeof PortalIcon>[0]["name"];
  href?: string;
  label: string;
};

const topics: readonly Topic[] = [
  { title: "Grupy JGP", description: "Karta każdej grupy: hospitalizacje w czasie, ośrodki, województwa, tryb przyjęcia i wycena.", icon: "bed", href: "/jgp", label: "Przeglądaj grupy JGP" },
  { title: "Szpitale publiczne", description: "Profil szpitala: oddziały, łóżka, świadczenia i wyniki finansowe.", icon: "hospital", href: DASHBOARD_HREFS.hospital, label: "Znajdź szpital" },
  { title: "Porównanie szpitali", description: "Porównaj szpital z grupą podobnych placówek dobranych przez model.", icon: "compare", href: DASHBOARD_HREFS.comparison, label: "Porównaj szpitale" },
  { title: "Analizy", description: "Eksplorator dla analityków: kilka grup naraz, obszary, filtry i tryb przyjęcia.", icon: "heart", href: DASHBOARD_HREFS.trend, label: "Otwórz eksplorator" },
  { title: "Wyceny JGP", description: "Jak wygląda system wycen JGP i jak zmieniają się wyceny.", icon: "chart", label: "Wyceny JGP" },
  { title: "Artykuły", description: "Analizy i komentarze, m.in. o rozliczeniach i kontrolach NFZ.", icon: "book", label: "Artykuły" },
];

// Ścieżki „Od czego zacząć”: punkt wyjścia według pytania, a nie według modułu.
type Path = { kicker: string; title: string; description: string; href: string; cta: string; links: { label: string; href: string }[] };

const paths: readonly Path[] = [
  {
    kicker: "Pytam o leczenie",
    title: "Co, gdzie i za ile leczą szpitale",
    description: "Karta grupy JGP pokazuje hospitalizacje w czasie, województwa, ośrodki, tryb przyjęcia i kwoty NFZ.",
    href: "/jgp",
    cta: "Katalog grup JGP",
    links: [
      { label: "Najczęstsze grupy", href: "/jgp" },
      { label: "Największe zmiany", href: "/jgp?sort=zmiana" },
      { label: "Zawał serca (E10)", href: "/jgp/E10" },
    ],
  },
  {
    kicker: "Pytam o szpital",
    title: "Jak wygląda konkretny szpital",
    description: "Profil szpitala: oddziały, łóżka, świadczenia i finanse. Porównanie z grupą podobnych placówek.",
    href: DASHBOARD_HREFS.hospital,
    cta: "Znajdź szpital",
    links: [
      { label: "Profil szpitala", href: DASHBOARD_HREFS.hospital },
      { label: "Porównanie z podobnymi", href: DASHBOARD_HREFS.comparison },
      { label: "Kto leczy", href: DASHBOARD_HREFS.mortality },
    ],
  },
  {
    kicker: "Analizuję dane",
    title: "Własny zakres: grupy, obszar, okres",
    description: "Eksplorator łączy kilka grup JGP, województwo albo miasto i rok. Link zapisuje cały widok.",
    href: DASHBOARD_HREFS.trend,
    cta: "Otwórz eksplorator",
    links: [
      { label: "W czasie", href: DASHBOARD_HREFS.trend },
      { label: "Tryb przyjęcia", href: DASHBOARD_HREFS.admissions },
      { label: "Gdzie", href: DASHBOARD_HREFS.regions },
    ],
  },
];

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}%`;

/** Karta z wykresem: pytanie, liczba, wykres i stopka ze źródłem oraz linkiem do pełnego widoku. */
function DataCard({ id, kicker, title, lead, children, href, cta, wide = false }: { id: string; kicker: string; title: string; lead?: ReactNode; children: ReactNode; href: string; cta: string; wide?: boolean }) {
  return <article className={`${styles.dataCard} ${wide ? styles.dataCardWide : ""}`} aria-labelledby={id}>
    <span className={styles.dataKicker}>{kicker}</span>
    <h3 id={id}>{title}</h3>
    {lead ? <p className={styles.dataLead}>{lead}</p> : null}
    <div className={styles.dataChart}>{children}</div>
    <footer className={styles.dataFooter}>
      <span className={styles.badge} title="Wartości „<5” w danych NFZ liczone jako 1 (metoda konserwatywna).">Szacunek</span>
      <span className={styles.dataSource}>Dane NFZ o hospitalizacjach</span>
      <Link className={styles.textLink} href={href}>{cta} <PortalIcon name="arrow" size={16} /></Link>
    </footer>
  </article>;
}

export function HomePage({ highlights, stats }: { highlights: DatasetHighlights; stats: HomeStats }) {
  const latest = stats.years.at(-1);
  const previous = stats.years.length > 1 ? stats.years[stats.years.length - 2] : null;
  const first = stats.years[0];
  const yearChange = latest && previous?.hospitalizations ? ((latest.hospitalizations - previous.hospitalizations) / previous.hospitalizations) * 100 : null;
  const range = formatYearRange(highlights.yearFrom, highlights.yearTo);
  return <>
    <LegacyDashboardRedirect />
    <main id="main-content" className={styles.home}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroPhoto} role="img" aria-label="Ilustracja: szpital, rozliczenie z NFZ, kontrola i dane" />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}><span className={styles.eyebrowLine} /> Publiczna ochrona zdrowia · Dane NFZ</span>
            <h1 id="hero-title">Publiczna ochrona<br />zdrowia w liczbach.</h1>
            <p>Sprawdź, jak wyglądały hospitalizacje, porównuj publiczne szpitale i poznaj system wycen JGP. Czytaj analizy i artykuły, m.in. o kontrolach NFZ.</p>
            <div className={styles.heroSearch}>
              <SearchBox variant="hero" />
              <p className={styles.searchHint}>Np. <b>E10</b>, <b>ozw</b>, <b>Nowa Sól</b> albo <b>E10 Nowa Sól na tle innych</b>. <Link href="#odkrywaj">Albo wybierz temat ↓</Link></p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.facts}`} aria-label="Informacje o danych">
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="calendar" /></span><div><strong>{formatYearRange(highlights.yearFrom, highlights.yearTo)}</strong><span>Zakres danych NFZ</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="bed" /></span><div><strong>{formatCompactCount(highlights.hospitalizations)}</strong><span>Hospitalizacji (szacunek)</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="hospital" /></span><div><strong>{formatCompactCount(highlights.providers)}</strong><span>Świadczeniodawców</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="chart" /></span><div><strong>{formatCompactCount(highlights.jgpGroups)}</strong><span>Grup JGP</span></div></div>
      </section>

      <section id="odkrywaj" className={`${styles.container} ${styles.paths}`} aria-labelledby="paths-title">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionEyebrow}>OD CZEGO ZACZĄĆ</span>
          <h2 id="paths-title">Trzy ścieżki przez dane.</h2>
          <p>Wybierz pytanie, które pasuje do Ciebie. Każda ścieżka prowadzi od przeglądu do szczegółowych danych.</p>
        </div>
        <ol className={styles.pathList}>
          {paths.map((path, i) => <li key={path.title} className={styles.path}>
            <span className={styles.pathNumber}>{String(i + 1).padStart(2, "0")}.</span>
            <span className={styles.pathKicker}>{path.kicker}</span>
            <h3>{path.title}</h3>
            <p>{path.description}</p>
            <ul className={styles.chips} aria-label={`Na skróty: ${path.kicker.toLocaleLowerCase("pl-PL")}`}>
              {path.links.map((link) => <li key={link.label}><Link href={link.href}>{link.label}</Link></li>)}
            </ul>
            <Link className={styles.pathCta} href={path.href}>{path.cta} <PortalIcon name="arrow" size={17} /></Link>
          </li>)}
        </ol>
      </section>

      <section id="dane" className={`${styles.container} ${styles.data}`} aria-labelledby="data-title">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionEyebrow}>DANE · {range}</span>
          <h2 id="data-title">Liczby, które warto znać.</h2>
          <p>Wybrane wskaźniki z danych NFZ. Każdy wykres prowadzi do pełnego widoku z filtrami.</p>
        </div>
        <div className={styles.dataGrid}>
          <DataCard
            id="data-years"
            kicker={`Hospitalizacje · ${range}`}
            title="Ile hospitalizacji rozlicza NFZ w roku?"
            lead={latest ? <><strong>{decimal(latest.hospitalizations / 1_000_000)} mln</strong> w {latest.year} r.{yearChange !== null ? <> ({signedPct(yearChange)} r/r)</> : null}. Liczby w milionach.</> : null}
            href={DASHBOARD_HREFS.trend}
            cta="W czasie"
          >
            <YearBars years={stats.years} />
          </DataCard>

          <DataCard
            id="data-groups"
            kicker={`Grupy JGP · ${stats.latestYear}`}
            title="Które grupy JGP są najczęstsze?"
            lead={<>Hospitalizacje w {stats.latestYear} r. Kliknij grupę, aby otworzyć jej kartę.</>}
            href="/jgp"
            cta="Katalog grup JGP"
          >
            <GroupBars groups={stats.topGroups} />
          </DataCard>

          {stats.regions ? <DataCard
            id="data-regions"
            kicker={`Województwa · ${stats.latestYear}`}
            title="Gdzie szpitale leczą najwięcej?"
            lead={<>Hospitalizacje na 100 tys. mieszkańców wobec średniej Polski (<strong>{integer(stats.regions.national)}</strong>). Województwo = siedziba świadczeniodawcy, nie pacjenta.</>}
            href={DASHBOARD_HREFS.regions}
            cta="Gdzie"
          >
            <RegionsMiniMap regions={stats.regions} />
            <MapLegend />
          </DataCard> : null}

          <DataCard
            id="data-admissions"
            kicker={`Tryb przyjęcia · ${range}`}
            title="Jak przyjmowani są pacjenci?"
            lead={latest && first ? <>Przyjęcia nagłe: <strong>{Math.round(latest.urgentPct)}%</strong> w {latest.year} r., {Math.round(first.urgentPct)}% w {first.year} r.</> : null}
            href={DASHBOARD_HREFS.admissions}
            cta="Tryb przyjęcia"
          >
            <AdmissionBars years={stats.years} />
            <div className={styles.legend} aria-hidden="true">
              <span><i className={styles.swatchUrgent} />Nagłe (%)</span>
              <span><i className={styles.swatchPlanned} />Planowe</span>
              <span><i className={styles.swatchOther} />Pozostałe</span>
            </div>
          </DataCard>

          {stats.previousYear && (stats.changes.up.length || stats.changes.down.length) ? <DataCard
            id="data-changes"
            kicker={`Zmiana r/r · ${stats.previousYear}–${stats.latestYear}`}
            title={`Co zmieniło się w ${stats.latestYear} r.?`}
            lead={<>Grupy z co najmniej 1000 hospitalizacji w {stats.previousYear} r. Zmiana liczby hospitalizacji rok do roku.</>}
            href="/jgp?sort=zmiana"
            cta="Wszystkie zmiany"
            wide
          >
            <div className={styles.changes}>
              <ChangeList title="Największe wzrosty" groups={stats.changes.up} direction="up" />
              <ChangeList title="Największe spadki" groups={stats.changes.down} direction="down" />
            </div>
          </DataCard> : null}
        </div>
      </section>

      <section className={`${styles.container} ${styles.sections}`} aria-labelledby="sections-title">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionEyebrow}>DZIAŁY PORTALU</span>
          <h2 id="sections-title">Wszystkie działy.</h2>
        </div>
        <ul className={styles.sectionList}>
          {topics.map((topic) => {
            const content = <>
              <span className={styles.sectionIcon}><PortalIcon name={topic.icon} size={22} /></span>
              <span className={styles.sectionText}><strong>{topic.title}</strong><span>{topic.description}</span></span>
              {topic.href ? <span className={styles.sectionArrow}><PortalIcon name="arrow" size={18} /></span> : <span className={styles.topicPlanned}>Planowane</span>}
            </>;
            return <li key={topic.title}>
              {topic.href
                ? <Link className={styles.sectionRow} href={topic.href} aria-label={topic.label}>{content}</Link>
                : <article className={`${styles.sectionRow} ${styles.sectionDisabled}`} aria-label={`${topic.label} — planowane`}>{content}</article>}
            </li>;
          })}
        </ul>
      </section>

      <section className={`${styles.container} ${styles.lower}`} aria-label="Informacje o portalu">
        <div className={styles.lowerCard}>
          <span className={styles.lowerIcon}><PortalIcon name="book" /></span>
          <div><h2>Rzetelne dane i metodologia</h2><p>Sprawdź źródła danych, definicje wskaźników oraz ograniczenia interpretacji.</p></div>
          <Link className={styles.textLink} href={DASHBOARD_HREFS.methodology}>O danych <PortalIcon name="arrow" size={17} /></Link>
        </div>
        <div className={styles.lowerCard}>
          <span className={styles.lowerIcon}><PortalIcon name="shield" /></span>
          <div><h2>Porównuj z właściwym kontekstem</h2><p>Różnice we wskaźnikach nie oznaczają automatycznie różnic w jakości leczenia.</p></div>
          <Link className={styles.textLink} href={DASHBOARD_HREFS.hospital}>Profile szpitali <PortalIcon name="arrow" size={17} /></Link>
        </div>
      </section>
    </main>
    <footer className={styles.footer}>
      <div className={styles.container}><span>© {SITE_NAME}</span><span>Portal o publicznej ochronie zdrowia · Dane NFZ</span><Link href={DASHBOARD_HREFS.methodology}>Metodologia</Link></div>
    </footer>
  </>;
}
