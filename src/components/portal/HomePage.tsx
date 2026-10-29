import Link from "next/link";
import { LegacyDashboardRedirect } from "@/components/portal/LegacyDashboardRedirect";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { SITE_NAME } from "@/lib/site";
import { formatCompactCount } from "@/lib/formatters";
import type { DatasetHighlights } from "@/lib/staticData";
import { PortalIcon } from "@/components/portal/PortalIcon";
import styles from "./HomePage.module.css";

// Kafel bez href jest pokazywany jako „Planowane”.
type Topic = {
  title: string;
  description: string;
  icon: Parameters<typeof PortalIcon>[0]["name"];
  href?: string;
  label: string;
};

const topics: readonly Topic[] = [
  { title: "Śmiertelność", description: "Wskaźniki i zależności dla wybranych grup JGP.", icon: "heart", href: DASHBOARD_HREFS.mortality, label: "Analizuj śmiertelność" },
  { title: "Hospitalizacje", description: "Liczba hospitalizacji i tryb przyjęcia.", icon: "bed", href: DASHBOARD_HREFS.admissions, label: "Analizuj hospitalizacje" },
  { title: "Znajdź szpital", description: "Wybierz placówkę i otwórz jej profil.", icon: "hospital", href: DASHBOARD_HREFS.hospital, label: "Znajdź szpital" },
  { title: "Porównaj szpitale", description: "Porównaj wybrany szpital z grupą automatycznie dobranych, podobnych placówek.", icon: "compare", href: DASHBOARD_HREFS.comparison, label: "Porównaj szpitale" },
];

export function HomePage({ highlights }: { highlights: DatasetHighlights }) {
  return <>
    <LegacyDashboardRedirect />
    <main id="main-content" className={styles.home}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroPhoto} role="img" aria-label="Ilustracja: szpital, rozliczenie z NFZ, kontrola i dane" />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}><span className={styles.eyebrowLine} /> Portal analityczny · Dane NFZ</span>
            <h1 id="hero-title">Polskie szpitalnictwo<br />w oparciu o dane.</h1>
            <p>Analizuj hospitalizacje, poznawaj profile szpitali i porównuj placówki. Zacznij od wybranego tematu lub otwórz zaawansowane analizy.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="#odkrywaj">Odkrywaj dane <PortalIcon name="arrow" size={18} /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.facts}`} aria-label="Informacje o danych">
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="calendar" /></span><div><strong>{highlights.analysisYear}</strong><span>Rok danych NFZ</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="bed" /></span><div><strong>{formatCompactCount(highlights.hospitalizations)}</strong><span>Hospitalizacji (szacunek)</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="hospital" /></span><div><strong>{formatCompactCount(highlights.providers)}</strong><span>Świadczeniodawców</span></div></div>
        <div className={styles.fact}><span className={styles.factIcon}><PortalIcon name="chart" /></span><div><strong>{formatCompactCount(highlights.jgpGroups)}</strong><span>Grup JGP</span></div></div>
      </section>

      <section id="odkrywaj" className={`${styles.container} ${styles.discover}`} aria-labelledby="discover-title">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionEyebrow}>ODKRYWAJ DANE</span>
          <h2 id="discover-title">Co chcesz sprawdzić?</h2>
          <p>Wybierz temat. Nie musisz znać wszystkich filtrów ani wskaźników.</p>
        </div>
        <div className={styles.topicGrid}>
          {topics.map((topic) => {
            const content = <>
              <span className={styles.topicIcon}><PortalIcon name={topic.icon} size={29} /></span>
              <strong>{topic.title}</strong>
              <span className={styles.topicDescription}>{topic.description}</span>
              {topic.href ? <span className={styles.topicArrow}><PortalIcon name="arrow" size={18} /></span> : <span className={styles.topicPlanned}>Planowane</span>}
            </>;
            return topic.href
              ? <Link key={topic.title} className={styles.topic} href={topic.href} aria-label={topic.label}>{content}</Link>
              : <article key={topic.title} className={`${styles.topic} ${styles.topicDisabled}`} aria-label={`${topic.label} — planowane`}>{content}</article>;
          })}
        </div>
      </section>

      <section className={`${styles.container} ${styles.workbench}`} aria-labelledby="workbench-title">
        <div className={styles.workbenchIcon}><PortalIcon name="chart" size={29} /></div>
        <div className={styles.workbenchText}>
          <span className={styles.sectionEyebrow}>DLA ANALITYKÓW</span>
          <h2 id="workbench-title">Potrzebujesz szczegółowej analizy?</h2>
          <p>Otwórz dashboard. Ustaw grupy JGP, filtry i parametry analizy. Udostępnij link do wybranego widoku.</p>
        </div>
        <Link className={styles.primaryButton} href={DASHBOARD_HREFS.mortality}>Przejdź do analiz <PortalIcon name="arrow" size={18} /></Link>
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
      <div className={styles.container}><span>© {SITE_NAME}</span><span>Portal analityczny · Dane NFZ</span><Link href={DASHBOARD_HREFS.methodology}>Metodologia</Link></div>
    </footer>
  </>;
}
