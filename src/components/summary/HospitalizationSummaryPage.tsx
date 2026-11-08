import Link from "next/link";
import { DataCard, Legend } from "@/components/portal/DataCard";
import { AdmissionBars, GroupBars, YearBars } from "@/components/portal/HomeCharts";
import { PageHeader, pageContainerClass } from "@/components/portal/PageHeader";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { formatPln, JGP_ACTIVITY_COLORS, JgpActivityBars, MonthLines, SectionChanges, STAY_COLORS, StayShares, TrendRows, ValueBars, ValueRows } from "@/components/summary/SummaryCharts";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { formatYearRange, plnScale } from "@/lib/formatters";
import { STAY_BUCKETS, TREND_MIN_HOSPITALIZATIONS, type HospitalizationSummary } from "@/lib/hospitalizationSummary";
import styles from "./HospitalizationSummaryPage.module.css";
import { CHART_COLORS } from "@/lib/chartPalette";
import { EstimateBadge } from "@/components/portal/EstimateBadge";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = (value: number) => `${decimal(value / 1_000_000)} mln`;
const pct = (value: number) => `${decimal(value)}%`;
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}%`;

// Przedziały długości pobytu na wykresie: pobyty bez nocy i 6 dni i dłuższe (indeksy w `STAY_BUCKETS`).
const STAY_SHOWN = [0, 3];

// Spis treści: kotwice sekcji karty.
const TOC = [
  { id: "ile", label: "Ile hospitalizacji JGP?" },
  { id: "kwoty", label: "Ile płaci NFZ?" },
  { id: "dni", label: "Długość pobytu i kto leczy" },
  { id: "tryb", label: "Tryb przyjęcia i zgony" },
  { id: "co", label: "Obszary leczenia" },
  { id: "aktywne", label: "Ile grup JGP?" },
  { id: "grupy", label: "Grupy JGP" },
  { id: "zmiany", label: "Co rośnie, co maleje?" },
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
  const stayShare = (stay: (typeof summary.stays)[number] | undefined, bucket: number) => {
    const total = stay ? stay.buckets.reduce((sum, value) => sum + value, 0) : 0;
    return stay && total ? (stay.buckets[bucket] / total) * 100 : 0;
  };
  const firstStay = summary.stays[0];
  const latestStay = summary.stays.at(-1);
  const { settlements, trendChanges } = summary;
  const firstTotal = settlements?.totals[0];
  const latestTotal = settlements?.totals.at(-1);
  // Jedna jednostka dla wszystkich słupków kwot (DESIGN.md 3.1).
  const totalsScale = plnScale((settlements?.totals ?? []).map((t) => t.valuePln));
  const hospitalizationsByYear = new Map(years.map((y) => [y.year, y.hospitalizations]));
  const perStay = (settlements?.totals ?? []).flatMap(({ year, valuePln }) => {
    const count = hospitalizationsByYear.get(year);
    return count ? [{ year, value: valuePln / count }] : [];
  });
  const settlementsPerStay = perStay.find((y) => y.year === settlements?.year);
  const valueChange = firstTotal && latestTotal && firstTotal.valuePln ? ((latestTotal.valuePln - firstTotal.valuePln) / firstTotal.valuePln) * 100 : null;
  const activity = summary.jgpActivity;
  const firstActivity = activity.years[0];
  const latestActivity = activity.years.at(-1);
  const mostNew = activity.years.slice(1).reduce<(typeof activity.years)[number] | null>((max, y) => (!max || y.new > max.new ? y : max), null);
  const signedCount = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0");
  const toc = TOC.filter((item) => (item.id !== "kwoty" || settlements) && (item.id !== "zmiany" || trendChanges.up.length || trendChanges.down.length) && (item.id !== "aktywne" || latestActivity));

  return <main id="main-content" className={styles.page}>
    <PageHeader
      eyebrow={<>Hospitalizacje w Polsce · {range}</>}
      title="Hospitalizacje w Polsce"
      lead={<p>Podsumowanie wszystkich hospitalizacji rozliczonych przez NFZ w grupach JGP. Każda część odpowiada na jedno pytanie, opisuje, jak czytać wykres, i prowadzi do szczegółów.</p>}
      kpis={latest && latestMetrics ? [
        { label: `Hospitalizacje JGP ${latestYear}`, value: millions(latest.hospitalizations), note: yearChange !== null ? `${signedPct(yearChange)} r/r` : null },
        { label: "Przyjęcia nagłe", value: pct(latest.urgentPct), note: `${pct(first.urgentPct)} w ${first.year} r.` },
        { label: "Zgony w szpitalu", value: pct(latestMetrics.mortalityPct), note: `hospitalizacji w ${latestYear} r.` },
        { label: "Świadczeniodawcy", value: integer(latestMetrics.providers), note: "rozliczających hospitalizacje" },
      ] : undefined}
    >
      <nav className={styles.toc} aria-label="Części karty">
        {toc.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
      </nav>
      <p className={styles.method}><EstimateBadge /> Wartości „&lt;5” w danych NFZ liczymy jako 1 (metoda konserwatywna, jak w eksploratorze). {partial ? <>Rok {latestYear} ma dane za {latest!.months} mies.</> : null} <Link href={DASHBOARD_HREFS.methodology}>Metodologia</Link></p>
    </PageHeader>

    <div className={pageContainerClass}>
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
            kicker={`Miesiące · ${summary.months.map((m) => m.year).join(", ")}`}
            title="Hospitalizacje w miesiącach"
            lead={<>Ciemna linia: {latestYear} r., jasna: {previousYear} r.{summary.months.length > 2 ? <>, przerywana: {summary.months[0].year} r.</> : null}</>}
            description={<p>Linie pokazują sezonowość. Mniej przyjęć w miesiącach wakacyjnych i w grudniu to głównie mniej leczenia planowego. Porównanie z poprzednim i pierwszym rokiem pokazuje, w których miesiącach zmieniła się liczba hospitalizacji.</p>}
            href={DASHBOARD_HREFS.trend}
            cta="W czasie"
          >
            <MonthLines months={summary.months} />
            <Legend items={summary.months.map((m, i) => ({ label: m.year, color: i === summary.months.length - 1 ? CHART_COLORS.data : i === 0 && summary.months.length > 2 ? CHART_COLORS.textTertiary : CHART_COLORS.dataSoft }))} />
          </DataCard> : null}
        </div>
      </section>

      {settlements && latestTotal && firstTotal ? <section id="kwoty" className={styles.section} aria-labelledby="kwoty-title">
        <h2 id="kwoty-title" className={styles.sectionTitle}>Ile NFZ płaci za hospitalizacje?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-spending"
            kicker={`Rozliczenia NFZ · ${formatYearRange(firstTotal.year, latestTotal.year)}`}
            title="Kwoty NFZ za hospitalizacje JGP w latach"
            lead={<><strong>{formatPln(latestTotal.valuePln)}</strong> w {latestTotal.year} r.{valueChange !== null ? <> ({signedPct(valueChange)} od {firstTotal.year} r.)</> : null}. Pod rokiem: zmiana r/r.</>}
            description={<>
              <p>Słupek to wartość świadczeń rozliczonych przez NFZ we wszystkich grupach JGP w roku, w {totalsScale.unit}. Zestawienie rozliczeń NFZ zaczyna się w {firstTotal.year} r.</p>
              <p>Kwoty rosną szybciej niż liczba hospitalizacji. Na wzrost wpływają m.in. wyższe wyceny punktów i grup JGP, wzrost wynagrodzeń w ochronie zdrowia i inflacja.</p>
            </>}
            href="/jgp?sort=kwota"
            cta="Grupy JGP według kwot"
            source="Dane NFZ o rozliczonych świadczeniach"
            estimate={false}
          >
            <ValueBars
              years={settlements.totals.map((t) => t.year)}
              values={settlements.totals.map((t) => t.valuePln)}
              format={totalsScale.format}
              notes={settlements.totals.map((t, i) => (i ? signedPct(((t.valuePln - settlements.totals[i - 1].valuePln) / settlements.totals[i - 1].valuePln) * 100) : ""))}
              label={`Kwoty NFZ w latach (${totalsScale.unit})`}
            />
          </DataCard>
          {perStay.length ? <DataCard
            id="summary-per-stay"
            kicker={`Rozliczenia NFZ · ${formatYearRange(perStay[0].year, perStay.at(-1)!.year)}`}
            title="Średnia kwota na hospitalizację"
            lead={<><strong>{integer(perStay.at(-1)!.value)} zł</strong> w {perStay.at(-1)!.year} r., {integer(perStay[0].value)} zł w {perStay[0].year} r. Pod rokiem: zmiana r/r.</>}
            description={<>
              <p>Średnia to kwota NFZ w roku podzielona przez liczbę hospitalizacji JGP w tym roku. Rośnie, gdy rosną wyceny i gdy przybywa droższego leczenia.</p>
              <p>W 2020 r. średnia wzrosła, bo szpitale leczyły mniej pacjentów planowych z prostymi zabiegami.</p>
            </>}
            href="/jgp?sort=kwota"
            cta="Grupy JGP według kwot"
            source="Dane NFZ o rozliczonych świadczeniach"
          >
            <ValueBars
              years={perStay.map((y) => y.year)}
              values={perStay.map((y) => y.value)}
              format={integer}
              notes={perStay.map((y, i) => (i ? signedPct(((y.value - perStay[i - 1].value) / perStay[i - 1].value) * 100) : ""))}
              label="Średnia kwota na hospitalizację w latach (zł)"
            />
          </DataCard> : null}
        </div>
      </section> : null}

      <section id="dni" className={styles.section} aria-labelledby="dni-title">
        <h2 id="dni-title" className={styles.sectionTitle}>Jak długo trwa pobyt i kto leczy?</h2>
        <div className={styles.grid}>
          {latestStay && firstStay ? <DataCard
            id="summary-stays"
            kicker={`Długość pobytu · ${formatYearRange(firstStay.year, latestStay.year)}`}
            title="Udział hospitalizacji według długości pobytu"
            lead={<>Pobyty 6 dni i dłuższe: <strong>{pct(stayShare(latestStay, 3))}</strong> w {latestStay.year} r., {pct(stayShare(firstStay, 3))} w {firstStay.year} r. Pobyty bez nocy (0 dni): {pct(stayShare(latestStay, 0))} i {pct(stayShare(firstStay, 0))}.</>}
            description={<>
              <p>Linie to udział pobytów bez nocy (0 dni) i pobytów 6 dni i dłuższych w hospitalizacjach roku (%). Reszta to pobyty 1–5 dni. NFZ podaje długość pobytu tylko w przedziałach (0, 1–2, 3–5, 6 i więcej dni), więc nie liczymy sumy dni (osobodni).</p>
              <p>Coraz więcej pobytów bez nocy i coraz mniej długich pobytów to skutek przenoszenia zabiegów do trybu jednego dnia, np. operacji zaćmy, i skracania pobytów.</p>
            </>}
            href={DASHBOARD_HREFS.trend}
            cta="W czasie: dowolne grupy"
          >
            <StayShares stays={summary.stays} buckets={STAY_SHOWN} />
            <Legend items={STAY_SHOWN.map((b) => ({ label: STAY_BUCKETS[b], color: STAY_COLORS[b] }))} />
          </DataCard> : null}
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
          >
            <ValueBars years={summaryYears.map((y) => y.year)} values={summaryYears.map((y) => y.providers)} format={integer} label="Świadczeniodawcy w latach" />
          </DataCard>
        </div>
      </section>

      <section id="tryb" className={styles.section} aria-labelledby="tryb-title">
        <h2 id="tryb-title" className={styles.sectionTitle}>Jak przyjmowani są pacjenci i ilu umiera w szpitalu?</h2>
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
          >
            <AdmissionBars years={years} />
            <Legend items={[{ label: "Nagłe (%)", color: CHART_COLORS.data }, { label: "Planowe", color: CHART_COLORS.dataMuted }, { label: "Pozostałe", color: CHART_COLORS.dataFaint, border: CHART_COLORS.border }]} />
          </DataCard>
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
          >
            <ValueBars years={summaryYears.map((y) => y.year)} values={summaryYears.map((y) => y.mortalityPct)} format={(v) => decimal(v)} label="Odsetek zgonów w latach (%)" />
          </DataCard>
        </div>
      </section>

      <section id="co" className={styles.section} aria-labelledby="co-title">
        <h2 id="co-title" className={styles.sectionTitle}>Obszary leczenia: co leczą szpitale i za ile?</h2>
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
            chartAlign="start"
          >
            <SectionChanges sections={summary.sections} firstYear={firstYear} latestYear={latestYear} />
          </DataCard>
          {settlements ? <DataCard
            id="summary-value-sections"
            kicker={`Rozliczenia NFZ · ${settlements.year}`}
            title="Kwoty według obszarów leczenia"
            lead={latestTotal ? <>NFZ rozliczył <strong>{formatPln(latestTotal.valuePln)}</strong> za hospitalizacje JGP w {settlements.year} r.{valueChange !== null && firstTotal ? <> ({signedPct(valueChange)} od {firstTotal.year} r.).</> : null}{settlementsPerStay ? <> Średnio <strong>{integer(settlementsPerStay.value)} zł</strong> za hospitalizację.</> : null}</> : null}
            description={<>
              <p>Kwota to wartość świadczeń rozliczonych przez NFZ w grupach JGP, zsumowana dla sekcji katalogu (pierwsza litera kodu). Kolumna „Na hosp.”: kwota sekcji podzielona przez liczbę hospitalizacji sekcji w {settlements.year} r. Ostatnia kolumna: zmiana kwoty od {settlements.firstYear} r., pierwszego roku w zestawieniu rozliczeń NFZ.</p>
              <p>Kwota to przychód szpitala z NFZ, a nie zysk. Dane nie zawierają kosztów leczenia, więc nie pokazują, które leczenie jest dla szpitala opłacalne.</p>
            </>}
            href="/jgp"
            cta="Katalog grup JGP"
            source="Dane NFZ o rozliczonych świadczeniach"
            estimate={false}
            chartAlign="start"
          >
            <ValueRows rows={settlements.sections} firstYear={settlements.firstYear} label={`Rozliczenia NFZ według sekcji katalogu JGP w ${settlements.year} r.`} />
          </DataCard> : null}
        </div>
      </section>

      {firstActivity && latestActivity ? <section id="aktywne" className={styles.section} aria-labelledby="aktywne-title">
        <h2 id="aktywne-title" className={styles.sectionTitle}>Ile grup JGP rozlicza NFZ?</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-jgp-active"
            kicker={`Grupy JGP · ${range}`}
            title="Aktywne grupy JGP w latach"
            lead={<>Aktywnych grup: <strong>{integer(latestActivity.active)}</strong> w {latestYear} r., {integer(firstActivity.active)} w {firstActivity.year} r. Pod rokiem: zmiana r/r.</>}
            description={<>
              <p>Grupa aktywna to grupa JGP z co najmniej jedną hospitalizacją rozliczoną w roku. Grupa z katalogu bez hospitalizacji nie jest aktywna.</p>
              <p>Liczba grup zmienia się głównie ze zmianami katalogu JGP: NFZ dodaje grupy, dzieli je i zastępuje stare kody nowymi.{partial ? <> Rok {latestYear} ma dane za {latest!.months} mies., więc rzadkie grupy mogą jeszcze nie mieć hospitalizacji.</> : null}</p>
            </>}
            href="/jgp"
            cta="Katalog grup JGP"
          >
            <ValueBars
              years={activity.years.map((y) => y.year)}
              values={activity.years.map((y) => y.active)}
              format={integer}
              notes={activity.years.map((y, i) => (i ? signedCount(y.active - activity.years[i - 1].active) : ""))}
              label="Aktywne grupy JGP w latach"
            />
          </DataCard>
          <DataCard
            id="summary-jgp-cohorts"
            kicker={`Grupy JGP · ${range}`}
            title="Grupy stałe i nowe"
            lead={<><strong>{integer(activity.core)}</strong> z {integer(activity.total)} grup było aktywnych w każdym roku {range}. Pod rokiem: grupy nowe (+) i grupy, które przestały być aktywne (−).</>}
            description={<>
              <p>Słupek to aktywne grupy roku. Dół słupka to grupy aktywne w każdym roku. Środek to pozostałe grupy aktywne już wcześniej. Góra to grupy, które w tym roku pierwszy raz mają hospitalizacje.</p>
              {mostNew && mostNew.new ? <p>Najwięcej nowych grup było w {label(mostNew.year)}: {integer(mostNew.new)}. W tym samym roku przestało być aktywnych: {integer(mostNew.gone)}. Duża zmiana w jednym roku to zwykle nowy katalog JGP.</p> : null}
            </>}
            href="/jgp"
            cta="Katalog grup JGP"
          >
            <JgpActivityBars years={activity.years} />
            <Legend items={[
              { label: `W każdym roku ${range}`, color: JGP_ACTIVITY_COLORS.core },
              { label: "Aktywne wcześniej", color: JGP_ACTIVITY_COLORS.earlier },
              { label: "Nowe w roku", color: JGP_ACTIVITY_COLORS.new },
            ]} />
          </DataCard>
        </div>
      </section> : null}

      <section id="grupy" className={styles.section} aria-labelledby="grupy-title">
        <h2 id="grupy-title" className={styles.sectionTitle}>Grupy JGP: najczęstsze i z największą kwotą</h2>
        <div className={styles.grid}>
          <DataCard
            id="summary-groups"
            kicker={`Grupy JGP · ${latestYear}`}
            title="Najczęstsze grupy JGP"
            lead={<>Liczba hospitalizacji w {latestYear} r.</>}
            description={<p>Na liście dominują zabiegi krótkie i powtarzalne (np. zaćma) oraz porody. Kliknij grupę, aby otworzyć jej kartę: kto leczy, gdzie i za ile.</p>}
            href="/jgp"
            cta="Katalog grup JGP"
            chartAlign="start"
          >
            <GroupBars groups={summary.topGroups} />
          </DataCard>
          {settlements ? <DataCard
            id="summary-value-groups"
            kicker={`Grupy JGP · ${settlements.year}`}
            title="Grupy z największą kwotą rozliczeń"
            lead={<>Kwota w {settlements.year} r. i zmiana od {settlements.firstYear} r.</>}
            description={<>
              <p>Na liście są grupy częste (np. zaćma, porody) i grupy drogie, rozliczane rzadziej, ale z wysoką kwotą na hospitalizację (np. zabiegi kardiologiczne). Liczba po kwocie to zmiana kwoty od {settlements.firstYear} r.</p>
              <p>Zmiana od {settlements.firstYear} r. to zmiana kwoty jednej grupy. Grupa nowa w katalogu nie ma zmiany („—”). Długie nazwy są skrócone, pełna nazwa jest w dymku. Kliknij grupę, aby otworzyć jej kartę z kwotami w latach i świadczeniodawcami.</p>
            </>}
            href="/jgp"
            cta="Katalog grup JGP"
            source="Dane NFZ o rozliczonych świadczeniach"
            estimate={false}
            chartAlign="start"
          >
            <ValueRows rows={settlements.groups} firstYear={settlements.firstYear} label={`Grupy JGP z największą kwotą rozliczeń w ${settlements.year} r.`} linkGroups />
          </DataCard> : null}
        </div>
      </section>

      {trendChanges.up.length || trendChanges.down.length ? <section id="zmiany" className={styles.section} aria-labelledby="zmiany-title">
        <h2 id="zmiany-title" className={styles.sectionTitle}>Co rośnie, co maleje?</h2>
        <div className={styles.grid}>
          {[
            { direction: "up" as const, rows: trendChanges.up, title: "Największe wzrosty" },
            { direction: "down" as const, rows: trendChanges.down, title: "Największe spadki" },
          ].map(({ direction, rows, title }) => <DataCard
            key={direction}
            id={`summary-trend-${direction}`}
            kicker={`Zmiana ${firstYear}–${latestYear}`}
            title={title}
            lead={<>{rows.length} grup i rodzin grup z co najmniej {integer(TREND_MIN_HOSPITALIZATIONS)} hospitalizacji w {firstYear} i {latestYear} r. Kliknij wiersz, aby otworzyć kartę grupy.</>}
            description={direction === "up"
              ? <p>Rodzina łączy grupy, między którymi przesuwa się kodowanie tego samego leczenia. Przykład: operacje zaćmy od 2019 r. rozlicza głównie B19G zamiast B19 i B18. Rodziny liczymy razem, pozostałe grupy osobno.</p>
              : <p>Duża zmiana jednej grupy to często zmiana katalogu albo kodowania, a nie zmiana liczby pacjentów. Sprawdź na karcie grupy, czy leczenie nie przeszło do innej grupy. Spadek porodów i opieki nad noworodkami odpowiada spadkowi liczby urodzeń.</p>}
            href="/jgp?sort=zmiana"
            cta="Wszystkie zmiany"
            chartAlign="start"
          >
            <TrendRows rows={rows} firstYear={firstYear} latestYear={latestYear} label={`${title} liczby hospitalizacji od ${firstYear} r.`} />
          </DataCard>)}
        </div>
      </section> : null}

      <p className={styles.footerNote}>
        Dane: NFZ, hospitalizacje rozliczone w grupach JGP, {range}. <Link href={DASHBOARD_HREFS.methodology}>Źródła i metodologia <PortalIcon name="arrow" size={15} /></Link>
      </p>
    </div>
  </main>;
}
