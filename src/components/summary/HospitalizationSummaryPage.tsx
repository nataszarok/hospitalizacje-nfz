import Link from "next/link";
import { DataCard, Legend } from "@/components/portal/DataCard";
import { AdmissionBars, ChangeList, GroupBars, MapLegend, RegionsMiniMap, YearBars } from "@/components/portal/HomeCharts";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { FamilyRows, MonthLines, SectionChanges, ValueBars } from "@/components/summary/SummaryCharts";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { formatYearRange } from "@/lib/formatters";
import type { HospitalizationSummary } from "@/lib/hospitalizationSummary";
import styles from "./HospitalizationSummaryPage.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = (value: number) => `${decimal(value / 1_000_000)} mln`;
const pct = (value: number) => `${decimal(value)}%`;
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}%`;

// Spis treści: kotwice sekcji karty.
const TOC = [
  { id: "ile", label: "Ile hospitalizacji JGP?" },
  { id: "tryb", label: "Tryb przyjęcia" },
  { id: "gdzie", label: "Gdzie?" },
  { id: "co", label: "Co leczą?" },
  { id: "zmiany", label: "Co rośnie, co maleje?" },
  { id: "zgony", label: "Zgony" },
  { id: "kto", label: "Kto leczy?" },
];

/** Karta „Hospitalizacje w Polsce”: wszystkie grupy JGP, wszystkie lata, z opisem każdego wykresu. */
export function HospitalizationSummaryPage({ summary }: { summary: HospitalizationSummary }) {
  const { years, summaryYears, latestYear, previousYear, firstYear } = summary;
  const latest = years.at(-1);
  const previous = years.length > 1 ? years[years.length - 2] : null;
  const first = years[0];
  const latestMetrics = summaryYears.at(-1);
  const range = formatYearRange(firstYear, latestYear);
  const yearChange = latest && previous?.hospitalizations ? ((latest.hospitalizations - previous.hospitalizations) / previous.hospitalizations) * 100 : null;
  const lowest = years.reduce((min, y) => (y.hospitalizations < min.hospitalizations ? y : min), years[0]);
  const highestMortality = summaryYears.reduce((max, y) => (y.mortalityPct > max.mortalityPct ? y : max), summaryYears[0]);
  const partial = latest && latest.months < 12;
  const urgent = (y: typeof first) => (y.hospitalizations * y.urgentPct) / 100;
  const planned = (y: typeof first) => (y.hospitalizations * y.plannedPct) / 100;
  const label = (y: string) => `${y} r.`;

  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>Hospitalizacje w Polsce · {range}</span>
        <h1>Hospitalizacje w Polsce</h1>
        <p className={styles.lead}>Podsumowanie wszystkich hospitalizacji rozliczonych przez NFZ w grupach JGP. Każda część odpowiada na jedno pytanie, opisuje, jak czytać wykres, i prowadzi do szczegółów.</p>
        {latest && latestMetrics ? <dl className={styles.kpis}>
          <div><dt>Hospitalizacje JGP {latestYear}</dt><dd>{millions(latest.hospitalizations)}</dd>{yearChange !== null ? <span>{signedPct(yearChange)} r/r</span> : null}</div>
          <div><dt>Przyjęcia nagłe</dt><dd>{pct(latest.urgentPct)}</dd><span>{pct(first.urgentPct)} w {first.year} r.</span></div>
          <div><dt>Zgony w szpitalu</dt><dd>{pct(latestMetrics.mortalityPct)}</dd><span>hospitalizacji w {latestYear} r.</span></div>
          <div><dt>Świadczeniodawcy</dt><dd>{integer(latestMetrics.providers)}</dd><span>rozliczających hospitalizacje</span></div>
        </dl> : null}
        <nav className={styles.toc} aria-label="Części karty">
          {TOC.filter((item) => item.id !== "gdzie" || summary.regions).map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
        <p className={styles.method}><span className={styles.badge}>Szacunek</span> Wartości „&lt;5” w danych NFZ liczymy jako 1 (metoda konserwatywna, jak w eksploratorze). {partial ? <>Rok {latestYear} ma dane za {latest!.months} mies.</> : null} <Link href={DASHBOARD_HREFS.methodology}>Metodologia</Link></p>
      </div>
    </header>

    <div className={styles.container}>
      <section id="ile" className={styles.section} aria-labelledby="ile-title">
        <h2 id="ile-title" className={styles.sectionTitle}>Ile hospitalizacji JGP?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-years"
            kicker={`Hospitalizacje · ${range}`}
            title="Hospitalizacje JGP w kolejnych latach"
            lead={latest ? <><strong>{millions(latest.hospitalizations)}</strong> w {latestYear} r.{yearChange !== null ? <> ({signedPct(yearChange)} r/r)</> : null}. Liczby w milionach.</> : null}
            description={<>
              <p>Hospitalizacja JGP to jeden pobyt w szpitalu rozliczony przez NFZ w grupie JGP. Ten sam pacjent może mieć kilka hospitalizacji w roku.</p>
              <p>NFZ rozlicza też pobyty poza JGP, np. w psychiatrii, rehabilitacji i opiece długoterminowej. Tych pobytów nie ma w tych danych.</p>
              <p>Najmniej hospitalizacji było w {label(lowest.year)} ({millions(lowest.hospitalizations)}).{lowest.year === "2020" ? " To rok pandemii COVID-19: szpitale ograniczyły przyjęcia planowe." : null}</p>
            </>}
            href={DASHBOARD_HREFS.trend}
            cta="W czasie: dowolne grupy"
          >
            <YearBars years={years} />
          </DataCard>
          {summary.months.length ? <DataCard
            id="summary-months"
            kicker={`Miesiące · ${summary.months.map((m) => m.year).join(" i ")}`}
            title="Hospitalizacje w miesiącach"
            lead={<>Ciemna linia: {latestYear} r., jasna: {previousYear} r.</>}
            description={<p>Linie pokazują sezonowość. Mniej przyjęć w miesiącach wakacyjnych i w grudniu to głównie mniej leczenia planowego. Porównanie z poprzednim rokiem pokazuje, w których miesiącach zmieniła się liczba hospitalizacji.</p>}
            href={DASHBOARD_HREFS.trend}
            cta="W czasie"
          >
            <MonthLines months={summary.months} />
            <Legend items={summary.months.map((m, i) => ({ label: m.year, color: i === summary.months.length - 1 ? "#2856A3" : "#9DB4DB" }))} />
          </DataCard> : null}
        </div>
      </section>

      <section id="tryb" className={styles.section} aria-labelledby="tryb-title">
        <h2 id="tryb-title" className={styles.sectionTitle}>Jak przyjmowani są pacjenci?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-admissions"
            kicker={`Tryb przyjęcia · ${range}`}
            title="Przyjęcia nagłe i planowe"
            lead={latest ? <>Przyjęcia nagłe: <strong>{Math.round(latest.urgentPct)}%</strong> w {latestYear} r., {Math.round(first.urgentPct)}% w {first.year} r.</> : null}
            description={<>
              <p><b>Nagłe</b>: przyjęcia w trybie nagłym (kody trybu 2 i 3 w danych NFZ). <b>Planowe</b>: przyjęcia na podstawie skierowania (kod 6). <b>Pozostałe</b>: inne tryby, np. przeniesienie z innego szpitala.</p>
              {latest ? <p>Przyjęć nagłych: {millions(urgent(first))} w {first.year} r. i {millions(urgent(latest))} w {latestYear} r. Planowych: {millions(planned(first))} i {millions(planned(latest))}.</p> : null}
            </>}
            href={DASHBOARD_HREFS.admissions}
            cta="Tryb przyjęcia"
            wide
          >
            <AdmissionBars years={years} />
            <Legend items={[{ label: "Nagłe (%)", color: "#2856A3" }, { label: "Planowe", color: "#B5C7E6" }, { label: "Pozostałe", color: "#E4EAF4", border: "#D3DCEA" }]} />
          </DataCard>
        </div>
      </section>

      {summary.regions ? <section id="gdzie" className={styles.section} aria-labelledby="gdzie-title">
        <h2 id="gdzie-title" className={styles.sectionTitle}>Gdzie szpitale leczą najwięcej?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-regions"
            kicker={`Województwa · ${latestYear}`}
            title="Hospitalizacje na 100 tys. mieszkańców"
            lead={<>Średnia Polski: <strong>{integer(summary.regions.national)}</strong> na 100 tys. mieszkańców w {latestYear} r.</>}
            description={<>
              <p>Kolor i liczba pokazują odchylenie od średniej Polski. Kliknij województwo, aby otworzyć widok „Gdzie” z tym obszarem.</p>
              <p>Województwo to siedziba świadczeniodawcy, a nie miejsce zamieszkania pacjenta. Województwa z dużymi ośrodkami klinicznymi leczą też pacjentów z innych regionów.</p>
            </>}
            href={DASHBOARD_HREFS.regions}
            cta="Gdzie: województwa i miasta"
            wide
          >
            <RegionsMiniMap regions={summary.regions} />
            <MapLegend />
          </DataCard>
        </div>
      </section> : null}

      <section id="co" className={styles.section} aria-labelledby="co-title">
        <h2 id="co-title" className={styles.sectionTitle}>Co leczą szpitale?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-sections"
            kicker={`Sekcje katalogu JGP · ${firstYear}–${latestYear}`}
            title="Obszary leczenia"
            lead={<>Udział sekcji w hospitalizacjach {latestYear} r. i zmiana liczby hospitalizacji od {firstYear} r.</>}
            description={<>
              <p>Sekcja to pierwsza litera kodu JGP i odpowiada obszarowi leczenia. Nazwy sekcji są opisowe.</p>
              <p>Zmiany kodów wewnątrz sekcji się znoszą (np. B19 → B19G). Przesunięcia między sekcjami zostają: skok sekcji P (pediatria) w 2019 r. wynika najpewniej z nowych grup dla dzieci w katalogu.</p>
            </>}
            href="/jgp"
            cta="Katalog grup JGP"
          >
            <SectionChanges sections={summary.sections} firstYear={firstYear} latestYear={latestYear} />
          </DataCard>
          <DataCard
            id="summary-groups"
            kicker={`Grupy JGP · ${latestYear}`}
            title="Najczęstsze grupy JGP"
            lead={<>Hospitalizacje w {latestYear} r. Kliknij grupę, aby otworzyć jej kartę.</>}
            description={<p>Na liście dominują zabiegi krótkie i powtarzalne (np. zaćma) oraz porody. Karta grupy pokazuje, kto leczy, gdzie i za ile.</p>}
            href="/jgp"
            cta="Katalog grup JGP"
          >
            <GroupBars groups={summary.topGroups} />
          </DataCard>
        </div>
      </section>

      <section id="zmiany" className={styles.section} aria-labelledby="zmiany-title">
        <h2 id="zmiany-title" className={styles.sectionTitle}>Co rośnie, co maleje?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-families"
            kicker={`Rodziny grup JGP · ${firstYear}–${latestYear}`}
            title={`Zmiana od ${firstYear} r.`}
            lead={<>Wybrane rodziny grup, od największego wzrostu. Kliknij rodzinę, aby otworzyć kartę jej głównej grupy.</>}
            description={<>
              <p>Rodzina łączy grupy, między którymi przesuwa się kodowanie tego samego leczenia. Przykład: operacje zaćmy od 2019 r. rozlicza głównie B19G zamiast B19 i B18. Porównanie wielu lat liczymy więc dla rodzin, a nie dla pojedynczych grup.</p>
              <p>Spadek porodów i opieki nad noworodkami odpowiada spadkowi liczby urodzeń. Lista obejmuje wybrane rodziny i będzie rozszerzana.</p>
            </>}
            href="/jgp"
            cta="Katalog grup JGP"
          >
            <FamilyRows families={summary.families} firstYear={firstYear} latestYear={latestYear} />
          </DataCard>
          {previousYear && (summary.changes.up.length || summary.changes.down.length) ? <DataCard
            id="summary-changes"
            kicker={`Zmiana r/r · ${previousYear}–${latestYear}`}
            title={`Co zmieniło się w ${latestYear} r.?`}
            lead={<>Grupy z co najmniej 1000 hospitalizacji w {previousYear} r.</>}
            description={<p>Duża zmiana jednej grupy to często zmiana kodowania, a nie zmiana liczby pacjentów. Sprawdź na karcie grupy, czy rośnie cała rodzina.</p>}
            href="/jgp?sort=zmiana"
            cta="Wszystkie zmiany"
          >
            <div className={styles.changes}>
              <ChangeList title="Największe wzrosty" groups={summary.changes.up} direction="up" />
              <ChangeList title="Największe spadki" groups={summary.changes.down} direction="down" />
            </div>
          </DataCard> : null}
        </div>
      </section>

      <section id="zgony" className={styles.section} aria-labelledby="zgony-title">
        <h2 id="zgony-title" className={styles.sectionTitle}>Ilu pacjentów umiera w szpitalu?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-mortality"
            kicker={`Zgony · ${range}`}
            title="Odsetek hospitalizacji zakończonych zgonem"
            lead={latestMetrics ? <><strong>{pct(latestMetrics.mortalityPct)}</strong> w {latestYear} r. ({integer(latestMetrics.deaths)} zgonów). Najwięcej: {pct(highestMortality.mortalityPct)} w {label(highestMortality.year)}</> : null}
            description={<>
              <p>Wskaźnik to liczba zgonów w szpitalu podzielona przez liczbę hospitalizacji. Rośnie, gdy szpitale przyjmują mniej pacjentów planowych, bo przyjęcia planowe rzadko kończą się zgonem.</p>
              <p>Wskaźnik nie uwzględnia wieku i stanu pacjentów, więc nie mierzy jakości leczenia. Porównania szpitali są w widoku „Kto leczy”.</p>
            </>}
            href={DASHBOARD_HREFS.mortality}
            cta="Kto leczy"
            wide
          >
            <ValueBars years={summaryYears.map((y) => y.year)} values={summaryYears.map((y) => y.mortalityPct)} format={(v) => decimal(v)} label="Odsetek zgonów w latach (%)" />
          </DataCard>
        </div>
      </section>

      <section id="kto" className={styles.section} aria-labelledby="kto-title">
        <h2 id="kto-title" className={styles.sectionTitle}>Kto leczy?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-providers"
            kicker={`Świadczeniodawcy · ${range}`}
            title="Świadczeniodawcy rozliczający hospitalizacje"
            lead={latestMetrics ? <><strong>{integer(latestMetrics.providers)}</strong> w {latestYear} r. 10% największych rozlicza <strong>{Math.round(latestMetrics.top10Pct)}%</strong> hospitalizacji.</> : null}
            description={<>
              <p>Świadczeniodawca to podmiot z umową z NFZ (para: oddział wojewódzki NFZ i NIP). To szpitale, ale też kliniki zabiegów jednego dnia, np. okulistyczne.</p>
              <p>Udział 10% największych pokazuje koncentrację: im wyższy, tym więcej leczenia w dużych ośrodkach.</p>
            </>}
            href={DASHBOARD_HREFS.hospital}
            cta="Profile szpitali"
            source="Dane NFZ o hospitalizacjach"
            wide
          >
            <ValueBars years={summaryYears.map((y) => y.year)} values={summaryYears.map((y) => y.providers)} format={integer} label="Świadczeniodawcy w latach" />
          </DataCard>
        </div>
      </section>

      <p className={styles.footerNote}>
        Dane: NFZ, hospitalizacje rozliczone w grupach JGP, {range}. <Link href={DASHBOARD_HREFS.methodology}>Źródła i metodologia <PortalIcon name="arrow" size={15} /></Link>
      </p>
    </div>
  </main>;
}
