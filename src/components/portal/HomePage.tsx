import Link from "next/link";
import { LegacyDashboardRedirect } from "@/components/portal/LegacyDashboardRedirect";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { SITE_NAME } from "@/lib/site";
import { formatAtLeastCount, formatCompactCount, formatYearRange } from "@/lib/formatters";
import type { DatasetHighlights } from "@/lib/staticData";
import type { HomeStats } from "@/lib/homeStats";
import type { HospitalHomeStats, HospitalMapStats } from "@/lib/hospitalHomeStats";
import { hospitalComparisonHref } from "@/lib/portalLinks";
import { GroupBars, Histogram, HospitalMap, PeerDistances, YearBars } from "@/components/portal/HomeCharts";
import { DataCard, Legend } from "@/components/portal/DataCard";
import { PlannedBadge } from "@/components/portal/PlannedBadge";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { SearchBox } from "@/components/search/SearchBox";
import styles from "./HomePage.module.css";
import { CHART_COLORS } from "@/lib/chartPalette";

// Dział bez href jest pokazywany jako „Planowane”.
type Topic = {
  title: string;
  description: string;
  icon: Parameters<typeof PortalIcon>[0]["name"];
  href?: string;
  label: string;
};

const topics: readonly Topic[] = [
  { title: "Hospitalizacje w Polsce", description: "Podsumowanie wszystkich lat: liczba, tryb przyjęcia, województwa, obszary leczenia, zgony i świadczeniodawcy.", icon: "chart", href: DASHBOARD_HREFS.summary, label: "Hospitalizacje w Polsce" },
  { title: "Grupy JGP", description: "Karta każdej grupy: hospitalizacje w czasie, ośrodki, województwa, tryb przyjęcia i wycena.", icon: "bed", href: "/jgp", label: "Przeglądaj grupy JGP" },
  { title: "Szpitale publiczne", description: "Katalog i mapa szpitali; karta szpitala: hospitalizacje, grupy JGP, oddziały i finanse.", icon: "hospital", href: DASHBOARD_HREFS.hospitals, label: "Znajdź szpital" },
  { title: "Porównanie szpitali", description: "Porównaj szpital z grupą podobnych placówek dobranych przez model.", icon: "compare", href: DASHBOARD_HREFS.comparison, label: "Porównaj szpitale" },
  { title: "Eksplorator JGP", description: "Narzędzie dla analityków: kilka grup naraz, obszary, filtry i tryb przyjęcia.", icon: "heart", href: DASHBOARD_HREFS.trend, label: "Otwórz eksplorator" },
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
    description: "Karta szpitala: hospitalizacje, grupy JGP, oddziały i finanse. Porównanie z grupą podobnych placówek.",
    href: DASHBOARD_HREFS.hospitals,
    cta: "Katalog szpitali",
    links: [
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

/** `hospitalMap`: mapa szpitali w sekcji szpitali; bez mapy (`null`, brak pliku mapy) karta pokazuje histogram łóżek. */
export function HomePage({ highlights, stats, hospitals, hospitalMap = null }: { highlights: DatasetHighlights; stats: HomeStats; hospitals: HospitalHomeStats; hospitalMap?: HospitalMapStats | null }) {
  const latest = stats.years.at(-1);
  const previous = stats.years.length > 1 ? stats.years[stats.years.length - 2] : null;
  const { comparison } = hospitals;
  const example = comparison.example;
  // Porównanie przykładowego szpitala z podobnymi; bez przykładu — strona porównania.
  const exampleKey = example ? (example.key.split("|") as [string, string]) : null;
  const exampleCompareHref = exampleKey ? hospitalComparisonHref(...exampleKey) : DASHBOARD_HREFS.comparison;
  const yearChange = latest && previous?.hospitalizations ? ((latest.hospitalizations - previous.hospitalizations) / previous.hospitalizations) * 100 : null;
  const range = formatYearRange(highlights.yearFrom, highlights.yearTo);
  const hospitalsIntro = <>
    <span className={styles.sectionEyebrow}>SZPITALE PUBLICZNE</span>
    <h2 id="hospitals-title">Jak wyglądają szpitale.</h2>
    <p>Profil każdego szpitala: oddziały, łóżka, SOR, grupy JGP i wynik finansowy. Wpisz nazwę albo miasto w wyszukiwarce.</p>
  </>;
  return <>
    <LegacyDashboardRedirect />
    <main id="main-content" className={styles.home}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroPhoto} role="img" aria-label="Ilustracja: sala operacyjna w szpitalu" />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}><span className={styles.eyebrowLine} /> Publiczna ochrona zdrowia · Dane NFZ</span>
            <h1 id="hero-title">Publiczna ochrona<br />zdrowia w liczbach.</h1>
            <p>Sprawdź, jak wyglądały hospitalizacje, porównuj publiczne szpitale i poznaj system wycen JGP. Czytaj analizy i artykuły.</p>
            <div className={styles.heroSearch}>
              <SearchBox variant="hero" />
              <p className={styles.searchHint}>Np. <b>E10</b>, <b>ozw</b>, <b>Nowa Sól</b> albo <b>E10 Nowa Sól na tle innych</b>. <Link href="#odkrywaj">Albo wybierz temat ↓</Link></p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.facts}`} aria-label="Informacje o danych">
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="calendar" /></span><div><strong>{formatYearRange(highlights.yearFrom, highlights.yearTo)}</strong><span>Zakres danych NFZ</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="bed" /></span><div><strong>{formatAtLeastCount(highlights.hospitalizations)}</strong><span title="Szacunek konserwatywny: każde „<5” w danych NFZ liczymy jako 1, jak na wykresach niżej.">Hospitalizacji JGP (szacunek)</span></div></div>
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
            title="Ile hospitalizacji JGP rozlicza NFZ w roku?"
            lead={latest ? <><strong>{decimal(latest.hospitalizations / 1_000_000)} mln</strong> w {latest.year} r.{yearChange !== null ? <> ({signedPct(yearChange)} r/r)</> : null}. Liczby w milionach.</> : null}
            href={DASHBOARD_HREFS.summary}
            cta="Hospitalizacje w Polsce"
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

        </div>
      </section>

      <section id="szpitale" className={`${styles.container} ${styles.data}`} aria-labelledby="hospitals-title">
        {hospitalMap ? <>
          {/* Tekst po lewej, mapa po prawej: mapa tak duża, jak pozwala wysokość okna (`.hospitalMapLarge`). */}
          <div className={styles.hospitalsLead}>
            <div className={styles.hospitalsText}>
              {hospitalsIntro}
              <p>Na mapie: każdy szpital z hospitalizacjami w {hospitalMap.year} r., w mieście siedziby. Większa kropka — więcej hospitalizacji.</p>
              <dl className={styles.compareFacts}>
                <div><dt>Szpitale</dt><dd>{integer(hospitalMap.hospitals)}</dd></div>
                <div><dt>W sieci PSZ</dt><dd>{integer(hospitalMap.inPsz)}</dd></div>
                <div><dt>Oddziały SOR</dt><dd>{integer(hospitals.sorUnits)}</dd></div>
              </dl>
              <Legend align="start" items={[{ label: "Szpital sieci (PSZ)", color: CHART_COLORS.data }, { label: "Poza siecią", color: CHART_COLORS.dataSoft }]} />
              <Link className={styles.pathCta} href={DASHBOARD_HREFS.hospitals}>Mapa i katalog szpitali <PortalIcon name="arrow" size={17} /></Link>
              <p className={styles.hospitalsSource}>Dane NFZ o hospitalizacjach; wykaz PSZ (NFZ); rejestr RPWDL</p>
            </div>
            <HospitalMap map={hospitalMap} large />
          </div>
        </> : <>
          <div className={styles.sectionIntro}>
            {hospitalsIntro}
          </div>
          <div className={styles.dataGrid}>
            <DataCard
              id="hospitals-beds"
              kicker={`Łóżka · ${integer(hospitals.profiles)} świadczeniodawców`}
              title="Jakiej wielkości są szpitale?"
              lead={<>Mediana szpitali z łóżkami: <strong>{integer(hospitals.medianBeds)}</strong>. {integer(hospitals.profiles - hospitals.withBeds)} placówek nie ma łóżek w RPWDL: to głównie kliniki zabiegów jednego dnia (np. zaćmy). <strong>{integer(hospitals.sorUnits)}</strong> oddziałów ratunkowych (SOR) działa w {integer(hospitals.withSor)} podmiotach.</>}
              href={DASHBOARD_HREFS.hospitals}
              cta="Znajdź szpital"
              source="Rejestr RPWDL"
              estimate={false}
            >
              <Histogram bins={hospitals.beds} label="Placówki według liczby łóżek" unit="" />
            </DataCard>

          </div>
        </>}
      </section>

      {example ? <section id="porownanie" className={`${styles.container} ${styles.compare}`} aria-labelledby="compare-title">
        <div className={styles.compareText}>
          <span className={styles.sectionEyebrow}>PORÓWNANIE PLACÓWEK</span>
          <h2 id="compare-title">Szpital na tle podobnych.</h2>
          <p>Model dobiera szpitale o podobnym profilu: oddziały, łóżka, grupy JGP i skala leczenia. Porównanie pokazuje różnice w hospitalizacjach, śmiertelności i finansach.</p>
          <ol className={styles.compareSteps}>
            <li><span><b>Wybierz szpital.</b> Wpisz nazwę albo miasto.</span></li>
            <li><span><b>Zobacz podobne placówki.</b> Klasa A (dystans do 10) to profil najbardziej zbliżony.</span></li>
            <li><span><b>Porównaj wskaźniki.</b> Grupy JGP, tryb przyjęcia, zgony i wynik finansowy.</span></li>
          </ol>
          <dl className={styles.compareFacts}>
            <div><dt>Pary klasy A</dt><dd>{integer(comparison.pairsA)}</dd></div>
            <div><dt>Szpitale z parą A</dt><dd>{integer(comparison.hospitalsWithPeers)}</dd></div>
          </dl>
          <Link className={styles.pathCta} href={exampleCompareHref}>Porównaj przykładowy szpital <PortalIcon name="arrow" size={17} /></Link>
        </div>
        <DataCard
          id="compare-example"
          kicker={`Przykład · ${example.city}`}
          title="Które szpitale są najbardziej podobne?"
          lead={<><strong>{example.name}</strong>: {integer(example.peerCount)} par klasy A. Poniżej {example.peers.length} najbliższych. Mniejszy dystans = bardziej podobny profil.</>}
          href={exampleCompareHref}
          cta="Pełne porównanie"
          source="Model par A/B (RPWDL, dane NFZ)"
          estimate={false}
        >
          <PeerDistances example={example} />
        </DataCard>
      </section> : null}

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
              {topic.href ? <span className={styles.sectionArrow}><PortalIcon name="arrow" size={18} /></span> : <PlannedBadge />}
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
          <Link className={styles.textLink} href={DASHBOARD_HREFS.hospitals}>Szpitale <PortalIcon name="arrow" size={17} /></Link>
        </div>
      </section>
    </main>
    <footer className={styles.footer}>
      <div className={styles.container}><span>© {SITE_NAME}</span><span>Portal o publicznej ochronie zdrowia · Dane NFZ</span><Link href={DASHBOARD_HREFS.methodology}>Metodologia</Link></div>
    </footer>
  </>;
}
