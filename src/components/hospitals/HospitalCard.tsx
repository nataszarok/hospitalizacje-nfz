"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroupLineChart, type ChartLine } from "@/components/jgp/GroupLineChart";
import { CardKpis } from "@/components/jgp/CardKpis";
import { CardYears } from "@/components/jgp/CardYears";
import { SectionHead } from "@/components/jgp/JgpTabbedCard";
import { PeriodToggle } from "@/components/jgp/PeriodToggle";
import { ConcentrationChart } from "@/components/ConcentrationChart";
import { ShareBars, ShareLegend } from "@/components/ShareBars";
import { GroupsSection } from "./HospitalGroupsSection";
import { HospitalFinanceTab } from "./HospitalFinanceTab";
import { HospitalStructureTab } from "./HospitalStructureTab";
import { acuteSummary } from "@/lib/hospitalStructure";
import { formatCityName, formatPln } from "@/lib/formatters";
import { JGP_SECTION_LABELS } from "@/lib/hospitalizationSummary";
import { sectionTotals, yearlySums, type HospitalPageData } from "@/lib/hospitalPage";
import type { ChartPeriod } from "@/lib/jgpCard";
import { plural } from "@/lib/jgpDescription";
import { hospitalComparisonHref } from "@/lib/portalLinks";
import { TREND_METRICS, type TrendMetric } from "@/lib/trendMetrics";
import base from "@/components/jgp/JgpPage.module.css";
import tabs from "@/components/jgp/JgpTabs.module.css";
import styles from "./HospitalCard.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number, digits = 1) => value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}%`;
const signedPp = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value), 2)} pp`;

const YEAR_PARAM = "rok";
const PERIOD_PARAM = "okres";
const TAB_PARAM = "widok";
type CardTab = "przeglad" | "struktura" | "finanse";
type CardState = { year: string; period: ChartPeriod; tab: CardTab };
const TOP_SECTIONS = 5;
const SECTION_CLASSES = [styles.part0, styles.part1, styles.part2, styles.part3, styles.part4];
// Długość pobytu: od najkrótszego (najciemniejszy) do najdłuższego.
const DURATION_CLASSES = [styles.part0, styles.part1, styles.part2, styles.part4];

/**
 * Stan karty w adresie: `rok` (bez parametru = najnowszy rok), `okres=miesiace` (wykres „Ile?” domyślnie w latach)
 * i `widok=struktura` / `widok=finanse` (zakładka; bez parametru = Działalność; Finanse tylko gdy karta je ma).
 */
function useCardState(years: string[], hasFinance: boolean) {
  const latest = years.at(-1)!;
  const [state, setState] = useState<CardState>({ year: latest, period: "year", tab: "przeglad" });
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const year = params.get(YEAR_PARAM);
      setState({
        year: year && years.includes(year) ? year : latest,
        period: params.get(PERIOD_PARAM) === "miesiace" ? "month" : "year",
        tab: params.get(TAB_PARAM) === "struktura" ? "struktura" : hasFinance && params.get(TAB_PARAM) === "finanse" ? "finanse" : "przeglad",
      });
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [years, latest, hasFinance]);
  const current = useRef(state);
  useEffect(() => { current.current = state; }, [state]);
  const write = useCallback((patch: Partial<CardState>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    const url = new URL(window.location.href);
    if (next.year !== latest) url.searchParams.set(YEAR_PARAM, next.year); else url.searchParams.delete(YEAR_PARAM);
    if (next.period === "month") url.searchParams.set(PERIOD_PARAM, "miesiace"); else url.searchParams.delete(PERIOD_PARAM);
    if (next.tab !== "przeglad") url.searchParams.set(TAB_PARAM, next.tab); else url.searchParams.delete(TAB_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setState(next);
  }, [latest]);
  return { state, write };
}

/**
 * Karta szpitala `/szpitale/[nip]` w układzie karty grupy JGP. Zakładki: „Działalność” (hospitalizacje, grupy JGP),
 * „Struktura” (oddziały, budynki, poradnie, sposób zapłaty — `HospitalStructureTab`) i „Finanse” (szpitale sieci PSZ z umowami NFZ);
 * „Porównanie” jest zapowiedziane. Wewnętrzny klucz pierwszej zakładki zostaje „przeglad” (adres bez parametru).
 */
export function HospitalCard({ data }: { data: HospitalPageData }) {
  // Rok karty tylko spośród lat z hospitalizacjami szpitala (np. świadczeniodawca, który przestał leczyć w 2022 r.);
  // domyślnie ostatni taki rok. Wykres „Ile?” pokazuje wszystkie lata.
  const activeYears = useMemo(() => {
    const totals = yearlySums(data.monthly.hospitalizations, data.years);
    const active = data.years.filter((_, y) => totals[y] > 0);
    return active.length ? active : data.years;
  }, [data]);
  const { state, write } = useCardState(activeYears, data.finance !== null);
  const yearIndex = data.years.indexOf(state.year);
  const onYear = (year: string) => write({ year });
  return <>
    <CardHeader data={data} yearIndex={yearIndex} />
    <div className={tabs.tabbar}>
      <div className={tabs.tabs} role="tablist" aria-label="Zakładki karty">
        <button type="button" role="tab" id="tab-przeglad" aria-controls="panel-przeglad" aria-selected={state.tab === "przeglad"} onClick={() => write({ tab: "przeglad" })}>Działalność</button>
        <button type="button" role="tab" id="tab-struktura" aria-controls="panel-struktura" aria-selected={state.tab === "struktura"} onClick={() => write({ tab: "struktura" })}>Struktura</button>
        {data.finance ? <button type="button" role="tab" id="tab-finanse" aria-controls="panel-finanse" aria-selected={state.tab === "finanse"} onClick={() => write({ tab: "finanse" })}>Finanse</button> : null}
        {[...(data.finance ? [] : ["Finanse"]), "Porównanie"].map((label) => <button key={label} type="button" role="tab" aria-selected="false" aria-disabled="true" className={styles.tabSoon} title="Zakładka w przygotowaniu">
          {label}<small>wkrótce</small>
        </button>)}
      </div>
      <CardYears years={activeYears} selected={state.year} onSelect={onYear} />
    </div>
    {state.tab === "finanse" && data.finance ? <div role="tabpanel" id="panel-finanse" aria-labelledby="tab-finanse" className={tabs.panel}>
      <HospitalFinanceTab data={data} finance={data.finance} yearIndex={yearIndex} onYear={onYear} />
    </div> : state.tab === "struktura" ? <div role="tabpanel" id="panel-struktura" aria-labelledby="tab-struktura" className={tabs.panel}>
      <HospitalStructureTab data={data} yearIndex={yearIndex} />
    </div> : <div role="tabpanel" id="panel-przeglad" aria-labelledby="tab-przeglad" className={tabs.panel}>
      <HowManySection data={data} year={state.year} period={state.period} onPeriod={(period) => write({ period })} />
      <TreatsSection data={data} yearIndex={yearIndex} />
      <GroupsSection data={data} yearIndex={yearIndex} />
      {/* Jeden wiersz: koncentracja (3/5 szerokości) i długość pobytu (2/5); na wąskim ekranie jedna pod drugą.
          Sekcja bez sensu dla małej placówki (mało grup, mało lat) znika; druga zajmuje wtedy cały wiersz. */}
      {(() => {
        const concentration = data.groups.filter((row) => row[2][yearIndex] > 0).length > CONCENTRATION_MIN_GROUPS ? <ConcentrationSection data={data} yearIndex={yearIndex} /> : null;
        const stay = activeYears.length >= STAY_MIN_YEARS ? <StaySection data={data} yearIndex={yearIndex} /> : null;
        return concentration && stay ? <div className={tabs.pair}>{concentration}{stay}</div> : concentration ?? stay;
      })()}
    </div>}
  </>;
}

function CardHeader({ data, yearIndex }: { data: HospitalPageData; yearIndex: number }) {
  const hosp = yearlySums(data.monthly.hospitalizations, data.years);
  const deaths = yearlySums(data.monthly.deaths, data.years);
  const networkHosp = data.network ? yearlySums(data.network.hospitalizations, data.years) : null;
  const networkDeaths = data.network ? yearlySums(data.network.deaths, data.years) : null;
  const year = data.years[yearIndex];
  const rate = (i: number) => hosp[i] ? (deaths[i] / hosp[i]) * 100 : null;
  const latestRate = rate(yearIndex);
  const previousRate = yearIndex > 0 ? rate(yearIndex - 1) : null;
  const network = networkHosp?.[yearIndex] && networkDeaths ? (networkDeaths[yearIndex] / networkHosp[yearIndex]) * 100 : null;
  const change = yearIndex > 0 && hosp[yearIndex - 1] ? ((hosp[yearIndex] - hosp[yearIndex - 1]) / hosp[yearIndex - 1]) * 100 : null;
  const groups = data.groups.filter((row) => row[2][yearIndex] > 0);
  const leaders = groups.filter((row) => row[3][yearIndex] > 0 && row[3][yearIndex] <= 3).length;
  const [owNfz, nip] = data.key.split("|");
  // Łóżka i oddziały leczenia szpitalnego: te same liczby co boks w zakładce „Struktura”.
  const acute = data.structure ? acuteSummary(data.structure) : null;
  return <header className={tabs.head}>
    <div className={tabs.headText}>
      <nav className={base.breadcrumbs} aria-label="Ścieżka"><Link href="/szpitale">Szpitale</Link> <span aria-hidden>›</span> <span>{formatCityName(data.city)}</span></nav>
      <div className={base.eyebrow}>Szpital · {data.pszLevel ? `sieć szpitali (PSZ): ${data.pszLevel}` : "poza siecią szpitali"}</div>
      <h1 className={tabs.title}>{data.name}</h1>
      <p className={tabs.meta}>
        <span>{formatCityName(data.city)} · woj. {data.region}</span>
        <span>NIP {nip}</span>
        <span>Dane: <b>{data.years[0]}–{data.years.at(-1)}</b></span>
        <span><Link href={hospitalComparisonHref(owNfz, nip)}>Porównanie z podobnymi szpitalami →</Link></span>
      </p>
    </div>
    <CardKpis label="Liczby szpitala" items={[
      { label: `Hospitalizacje ${year}`, value: integer(hosp[yearIndex]), unit: plural(hosp[yearIndex], "hospitalizacja", "hospitalizacje", "hospitalizacji"), note: change === null ? "pierwszy rok" : `${signedPct(change)} r/r` },
      { label: `Śmiertelność ${year}`, value: latestRate === null ? "—" : `${decimal(latestRate, 2)}%`, unit: latestRate === null ? undefined : "zgonów",
        note: [latestRate !== null && previousRate !== null ? `${signedPp(latestRate - previousRate)} r/r` : null, network !== null ? `sieć PSZ ${decimal(network, 2)}%` : null].filter(Boolean).join(" · ") },
      { label: `Łóżka szpitalne (stan ${data.rpwdlYear ?? "bieżący"})`, value: acute?.beds ? integer(acute.beds) : "—", unit: acute?.beds ? plural(acute.beds, "łóżko", "łóżka", "łóżek") : undefined,
        note: acute?.wards ? `${acute.wards} ${plural(acute.wards, "oddział", "oddziały", "oddziałów")}` : "brak profilu w rejestrze" },
      { label: `Grupy JGP ${year}`, value: integer(groups.length), unit: plural(groups.length, "grupa JGP", "grupy JGP", "grup JGP"), note: leaders ? `${leaders} w pierwszej trójce w Polsce` : "z hospitalizacjami w roku" },
    ]} />
  </header>;
}

const METRICS = TREND_METRICS;
/** „Ile grup daje większość?” ma sens dopiero przy więcej niż tylu grupach JGP w roku karty. */
export const CONCENTRATION_MIN_GROUPS = 10;
/** „Jak długo leżą?” (słupki w latach) tylko dla szpitala z hospitalizacjami w co najmniej tylu latach. */
export const STAY_MIN_YEARS = 5;

const NETWORK_DETAIL = "wszystkie szpitale sieci w Polsce";
const periodWord = (period: ChartPeriod) => period === "year" ? "rocznie" : "miesięcznie";

/**
 * „Ile?”: szpital w czasie na stałej osi wszystkich lat; rok bez hospitalizacji to przerwa w linii (`activeYearsOnly`), nie zero.
 * Udziały (śmiertelność, % nagłych) szpitala sieci PSZ z linią odniesienia „sieć PSZ”; poza siecią bez linii odniesienia.
 */
function HowManySection({ data, year, period, onPeriod }: { data: HospitalPageData; year: string; period: ChartPeriod; onPeriod: (period: ChartPeriod) => void }) {
  const [metric, setMetric] = useState<TrendMetric>("hospitalizations");
  const shown = METRICS[metric];
  const lines = useMemo((): ChartLine[] => {
    const { hospitalizations, deaths, urgent } = data.monthly;
    if (metric === "hospitalizations") return [{ key: data.key, name: data.name, values: hospitalizations, tone: "primary", activeYearsOnly: true }];
    const own: ChartLine = { key: data.key, name: data.name, values: metric === "mortality" ? deaths : urgent, base: hospitalizations, tone: "primary", activeYearsOnly: true };
    if (!data.network) return [own];
    const reference = metric === "mortality" ? data.network.deaths : data.network.urgent;
    return [{ key: "psz", name: "Sieć PSZ", detail: NETWORK_DETAIL, values: reference, base: data.network.hospitalizations, tone: "reference" }, own];
  }, [data, metric]);
  return <section className={tabs.sec} aria-labelledby="s-ile">
    <SectionHead id="s-ile" question="Ile?" context={`${shown.title} ${periodWord(period)}, wszystkie lata`} tools={<PeriodToggle period={period} onPeriod={onPeriod} />} />
    <div className={base.segmented} role="group" aria-label="Miara">
      {(Object.keys(METRICS) as TrendMetric[]).map((key) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{METRICS[key].button}</button>)}
    </div>
    {metric !== "hospitalizations" && data.network ? <ul className={styles.lineKey} aria-label="Linie wykresu">
      <li><span className={styles.keySolid} aria-hidden />ten szpital</li>
      <li><span className={styles.keyDot} aria-hidden />Sieć PSZ ({NETWORK_DETAIL})</li>
    </ul> : null}
    <GroupLineChart months={data.months} lines={lines} valueLabel={shown.unit} height={380} highlightYear={year} fitAxis={metric === "urgent"} note={shown.note[period]} period={period} ariaLabel={`Wykres liniowy: ${shown.title.toLowerCase()} ${periodWord(period)} we wszystkich latach`} />
  </section>;
}

/** „Co leczy?”: sekcje JGP w słupkach 100% (pierwszy rok i rok karty) i największe grupy z miejscem w Polsce. */
function TreatsSection({ data, yearIndex }: { data: HospitalPageData; yearIndex: number }) {
  const year = data.years[yearIndex];
  const sections = useMemo(() => sectionTotals(data.groups, data.years), [data]);
  // Pięć największych sekcji roku karty w kolorach, reszta razem; ta sama kolejność w obu słupkach.
  const order = [...sections.entries()].sort((a, b) => b[1][yearIndex] - a[1][yearIndex]).slice(0, TOP_SECTIONS).map(([letter]) => letter);
  const label = (letter: string) => `${letter} · ${(JGP_SECTION_LABELS[letter] ?? "inne").toLocaleLowerCase("pl-PL")}`;
  const firstIndex = data.groups.length ? Math.max(0, data.years.findIndex((_, y) => [...sections.values()].some((totals) => totals[y] > 0))) : 0;
  const shownYears = firstIndex === yearIndex ? [yearIndex] : [firstIndex, yearIndex];
  const total = (y: number) => [...sections.values()].reduce((sum, totals) => sum + totals[y], 0);
  const leaders = data.groups.filter((row) => row[3][yearIndex] > 0 && row[3][yearIndex] <= 3).sort((a, b) => a[3][yearIndex] - b[3][yearIndex]).map((row) => row[0]);
  const first = order[0];
  return <section className={tabs.sec} aria-labelledby="s-co">
    <SectionHead id="s-co" question="Co leczy?" context={`Sekcje i grupy JGP, ${data.years[shownYears[0]]}${shownYears.length > 1 ? ` wobec ${year}` : ""}`} tag="Rok" />
    {first && total(yearIndex) > 0 ? <p className={base.lead}>
      Największa sekcja w {year} r.: <b>{label(first)}</b> ({decimal((sections.get(first)![yearIndex] / (total(yearIndex) || 1)) * 100, 0)}% hospitalizacji).
      {leaders.length ? <> Szpital jest w pierwszej trójce w Polsce w {leaders.length} {leaders.length === 1 ? "grupie" : "grupach"}: <b>{leaders.slice(0, 8).join(", ")}{leaders.length > 8 ? "…" : ""}</b>.</> : null}
    </p> : null}
    {/* Legenda z liczbą hospitalizacji sekcji w roku karty; na słupkach litera sekcji i udział. */}
    <ShareLegend parts={[
      ...order.map((letter, i) => ({ key: letter, label: `${label(letter)}: ${integer(sections.get(letter)![yearIndex])}`, className: SECTION_CLASSES[i] })),
      { key: "other", label: `pozostałe sekcje: ${integer(total(yearIndex) - order.reduce((sum, letter) => sum + sections.get(letter)![yearIndex], 0))}`, className: styles.partOther },
    ]} />
    <ShareBars labels ariaLabel="Sekcje JGP w hospitalizacjach szpitala" rows={shownYears.map((y) => ({
      key: data.years[y], label: data.years[y], on: y === yearIndex,
      parts: [
        ...order.map((letter, i) => ({ key: letter, label: label(letter), short: letter, dark: i < 2, value: sections.get(letter)![y], className: SECTION_CLASSES[i] })),
        { key: "other", label: "pozostałe", value: total(y) - order.reduce((sum, letter) => sum + sections.get(letter)![y], 0), className: styles.partOther },
      ],
    }))} />
  </section>;
}

/** „Ile grup daje większość?”: koncentracja kwoty NFZ (albo hospitalizacji) w grupach JGP, z suwakiem liczby grup. */
function ConcentrationSection({ data, yearIndex }: { data: HospitalPageData; yearIndex: number }) {
  const hasPln = data.groups.some((row) => row[5][yearIndex] > 0);
  const [measure, setMeasure] = useState<"pln" | "hosp">("pln");
  const shown = hasPln ? measure : "hosp";
  const items = data.groups.map(([code, name, hosp, , , pln]) => ({
    key: code, label: name, value: shown === "pln" ? pln[yearIndex] : hosp[yearIndex], href: `/jgp/${encodeURIComponent(code)}?osrodek=${encodeURIComponent(data.key)}`,
  }));
  const year = data.years[yearIndex];
  return <section className={tabs.sec} aria-labelledby="s-koncentracja">
    <SectionHead id="s-koncentracja" question="Ile grup daje większość?" context={`${shown === "pln" ? "Kwota NFZ" : "Hospitalizacje"} w grupach JGP od największej, ${year}`} tag="Rok" />
    <div className={base.segmented} role="group" aria-label="Miara">
      <button type="button" aria-pressed={shown === "pln"} disabled={!hasPln} title={hasPln ? undefined : "Kwoty NFZ za grupy JGP są od 2019 r."} onClick={() => setMeasure("pln")}>Kwota NFZ</button>
      <button type="button" aria-pressed={shown === "hosp"} onClick={() => setMeasure("hosp")}>Hospitalizacje</button>
    </div>
    <ConcentrationChart
      key={`${shown}-${year}`}
      items={items}
      measure={shown === "pln" ? "kwoty NFZ za grupy JGP" : "hospitalizacji"}
      format={shown === "pln" ? formatPln : (value) => `${integer(value)} hosp.`}
      words={["kod JGP", "kody JGP", "kodów JGP"]}
      ariaLabel={`Skumulowany udział grup JGP w ${shown === "pln" ? "kwocie NFZ" : "hospitalizacjach"} szpitala w ${year} r.`}
    />
    <p className={base.note}>Przesuń suwak, żeby wybrać liczbę grup. Krzywa: suma udziałów grup od największej. Kwota NFZ to rozliczenia grup JGP (zestawienie świadczeń, od 2019 r.), także grup w ryczałcie — przychód, nie zysk.{hasPln ? "" : ` W ${year} r. nie ma kwot, wykres pokazuje hospitalizacje.`}</p>
  </section>;
}

/** „Jak długo leżą?”: długość pobytu w słupkach 100% w latach. */
function StaySection({ data, yearIndex }: { data: HospitalPageData; yearIndex: number }) {
  const { labels, values } = data.durations;
  const parts = labels.map((label, i) => ({ key: label, label: label.replace(/-/g, "–"), className: DURATION_CLASSES[i] ?? styles.partOther }));
  const zero = values[yearIndex]?.[0] ?? 0;
  const all = values[yearIndex]?.reduce((sum, value) => sum + value, 0) ?? 0;
  return <section className={tabs.sec} aria-labelledby="s-pobyt">
    <SectionHead id="s-pobyt" question="Jak długo leżą?" context="Długość pobytu, wszystkie lata" tag="Lata" />
    {all ? <p className={base.lead}>W {data.years[yearIndex]} r. <b>{decimal((zero / all) * 100, 0)}%</b> pobytów trwało krócej niż dobę (np. zabiegi jednego dnia).</p> : null}
    <ShareLegend parts={parts} />
    <ShareBars ariaLabel="Długość pobytu w latach" rows={data.years.map((year, y) => ({
      key: year, label: year, on: y === yearIndex,
      parts: parts.map((part, i) => ({ ...part, value: values[y]?.[i] ?? 0 })),
    }))} />
    <p className={base.note}>Najedź na rok, żeby zobaczyć udziały. Długość pobytu według dat przyjęcia i wypisu w danych NFZ.</p>
  </section>;
}
