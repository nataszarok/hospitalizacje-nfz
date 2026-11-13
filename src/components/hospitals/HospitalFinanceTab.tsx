"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { SectionHead } from "@/components/jgp/JgpTabbedCard";
import { Sparkline } from "@/components/jgp/JgpCatalog";
import { HelpLines, InfoTip } from "@/components/InfoTip";
import { CHART_COLORS } from "@/lib/chartPalette";
import { formatPln, plnScale } from "@/lib/formatters";
import {
  FINANCE_BUCKETS, FINANCE_GROUPS, groupSums, lumpSplit, payShareText, planTotals, scopeLabel, sectionPayRows, sentenceCase, yearOverYear, levelGenitive, settledYears, wardRows, type FinanceChip,
  type FinanceGroup, type HospitalFinance,
} from "@/lib/hospitalFinance";
import { sectionTotals, type HospitalPageData } from "@/lib/hospitalPage";
import { JGP_SECTION_LABELS } from "@/lib/hospitalizationSummary";
import { plural } from "@/lib/jgpDescription";
import { YearStackBars, type StackPart } from "./YearStackBars";
import { YearIndexChart } from "./YearIndexChart";
import base from "@/components/jgp/JgpPage.module.css";
import tabs from "@/components/jgp/JgpTabs.module.css";
import card from "./HospitalCard.module.css";
import styles from "./HospitalFinance.module.css";

const decimal = (value: number, digits = 1) => value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}%`;
const pct = (value: number, digits = 0) => `${decimal(value, digits)}%`;
const lower = (text: string) => text.toLocaleLowerCase("pl-PL");

/** Kolory czterech grup pozycji umowy: ryczałt (granat), za wykonanie z JGP (jasny błękit), bez JGP (kreskowanie), poza leczeniem szpitalnym (najjaśniejszy). */
const GROUP_FILLS = [CHART_COLORS.dataStrong, CHART_COLORS.dataSoft, CHART_COLORS.dataSoft, CHART_COLORS.dataFaint];
const GROUP_SWATCH = [styles.swatchStrong, styles.swatchSoft, styles.hatch, styles.faint];
/** Rozliczenia grup JGP: ryczałt (ciemny) i za wykonanie (jasny). */
const PAY_PARTS = [{ key: "lump", label: "w zakresach ryczałtowych", fill: CHART_COLORS.dataStrong, dark: true }, { key: "paid", label: "za wykonanie", fill: CHART_COLORS.dataSoft }] as const;
/** Kody JGP w rozwinięciu wiersza. */
/** Udział za wykonanie, od którego oddział jest „w ryczałcie” (≤) albo „za wykonanie” (≥ 100 − próg). */
const FULL_SHARE = 5;

/**
 * Zakładka „Finanse” karty szpitala (docs/karta-szpitala.html): od ogółu do szczegółu — ile NFZ płaci w latach, za co płaci w roku karty,
 * ile grup JGP idzie przez ryczałt, jak NFZ płaci za oddziały i które sekcje JGP dają najwięcej pieniędzy.
 * Kliknięcie słupka zmienia rok karty.
 */
export function HospitalFinanceTab({ data, finance, yearIndex, onYear }: { data: HospitalPageData; finance: HospitalFinance; yearIndex: number; onYear: (year: string) => void }) {
  return <>
    <p className={styles.intro}>
      Zakładka odpowiada na pytania od ogółu do szczegółu: jak rósł ryczałt sieci szpitali na tle podobnych szpitali, ile NFZ płaci w latach,
      za co płaci w wybranym roku, ile grup JGP idzie przez ryczałt, jak płaci za każdy oddział i które sekcje JGP dają najwięcej pieniędzy.
      Kwoty to przychód szpitala z NFZ, nie zysk.
    </p>
    {finance.lumpIndex ? <LumpIndexSection data={data} finance={finance} yearIndex={yearIndex} onYear={onYear} /> : null}
    <MoneySection data={data} finance={finance} yearIndex={yearIndex} onYear={onYear} />
    <PaySection data={data} finance={finance} yearIndex={yearIndex} />
    <LumpSection data={data} finance={finance} yearIndex={yearIndex} onYear={onYear} />
    <WardPaySection data={data} finance={finance} yearIndex={yearIndex} />
    <SectionsPaySection data={data} finance={finance} yearIndex={yearIndex} />
    <Explain />
  </>;
}

type SectionProps = { data: HospitalPageData; finance: HospitalFinance; yearIndex: number };

/** „Ile NFZ płaci szpitalowi?”: plan umów w latach według czterech dróg pieniędzy i przychody ze sprawozdania. */
function MoneySection({ data, finance, yearIndex, onYear }: SectionProps & { onYear: (year: string) => void }) {
  const totals = planTotals(finance);
  const year = data.years[yearIndex];
  const total = totals[yearIndex];
  const first = totals.findIndex((value) => value > 0);
  const last = totals.length - 1 - [...totals].reverse().findIndex((value) => value > 0);
  let jump = -1;
  for (let y = first + 1; y <= last; y++) if (jump < 0 || totals[y] - totals[y - 1] > totals[jump] - totals[jump - 1]) jump = y;
  const revenue = finance.revenue[yearIndex];
  const net = finance.net[yearIndex];
  const reported = data.years.filter((_, y) => finance.revenue[y] !== null);
  const previous = yearIndex > 0 ? totals[yearIndex - 1] : 0;
  const parts: StackPart[] = FINANCE_GROUPS.map((label, group) => ({
    key: String(group), label, fill: GROUP_FILLS[group], hatch: group === 2,
    values: data.years.map((_, y) => groupSums(finance.plan, y)[group]),
  }));
  return <section className={tabs.sec} aria-labelledby="s-umowy">
    <SectionHead id="s-umowy" question="Ile NFZ płaci szpitalowi?" context="Umowy z NFZ, wszystkie lata" tag="Lata" />
    {first >= 0 ? <p className={base.lead}>
      {last > first
        ? <>Od {data.years[first]} r. umowy z NFZ {totals[last] >= totals[first] ? "wzrosły" : "spadły"} z <b>{formatPln(totals[first])}</b> do <b>{formatPln(totals[last])}</b> ({decimal(totals[last] / totals[first])}×).</>
        : <>Umowy z NFZ są tylko za {data.years[first]} r.: <b>{formatPln(totals[first])}</b>.</>}
      {jump > 0 ? <> Największy skok: {data.years[jump]} r. (+{formatPln(totals[jump] - totals[jump - 1])}).</> : null}
      {revenue ? <> Umowy z NFZ to <b>{pct((total / revenue) * 100)}</b> przychodów szpitala w {year} r.</> : null}
    </p> : null}
    <dl className={styles.facts}>
      <div><dt>Umowy z NFZ {year}</dt><dd>{formatPln(total)}</dd><span>{previous ? `${signedPct(((total - previous) / previous) * 100)} r/r` : "pierwszy rok w danych"}</span></div>
      {revenue ? <>
        <div><dt>Przychody {year}</dt><dd>{formatPln(revenue)}</dd><span>sprawozdanie finansowe</span></div>
        {net !== null ? <div><dt>Wynik netto {year}</dt><dd className={net >= 0 ? styles.positive : styles.negative}>{net >= 0 ? "+" : "−"}{formatPln(Math.abs(net))}</dd><span>marża {decimal((net / revenue) * 100)}%</span></div> : null}
        <div><dt>Umowy z NFZ / przychody</dt><dd>{pct((total / revenue) * 100)}</dd><span>{year}</span></div>
      </> : <div><dt>Sprawozdanie finansowe</dt><dd>—</dd><span>brak za {year} r.{reported.length ? `; jest za ${reported.join(", ")} r.` : ""}</span></div>}
    </dl>
    <YearStackBars
      years={data.years} parts={parts} selected={yearIndex} onYear={onYear} context={`Umowy z NFZ · ${data.name}`}
      marker={reported.length ? { label: "Przychody (sprawozdanie)", values: finance.revenue } : undefined}
      ariaLabel="Umowy z NFZ w latach według sposobu zapłaty; kliknięcie roku zmienia rok karty"
    />
    <ul className={base.legend} aria-label="Legenda">
      {FINANCE_GROUPS.map((label, group) => <li key={label}><span className={`${base.swatch} ${GROUP_SWATCH[group]}`} aria-hidden />{label}</li>)}
      {reported.length ? <li><span className={`${base.swatch} ${styles.markerKey}`} aria-hidden />przychody ze sprawozdania</li> : null}
    </ul>
    <p className={base.note}>
      Plan umów z NFZ z aneksami (API NFZ „Umowy”). Sieć szpitali (PSZ) działa od października 2017 r., dlatego w 2017 r. ryczałt jest mały.
      Kliknięcie słupka zmienia rok karty; szczegóły roku są w następnej sekcji.
    </p>
  </section>;
}

/** Różnica indeksów słowami: „o 20 pkt wolniej / szybciej niż średnia” albo „tak jak średnia”. */
function paceText(own: number, mean: number, group: string): string {
  const gap = Math.round(own - mean);
  if (Math.abs(gap) < 3) return `tak jak średnia szpitali ${group}`;
  return `o ${Math.abs(gap)} pkt ${gap > 0 ? "więcej" : "mniej"} niż średnia szpitali ${group}`;
}

/** Zmiana r/r ze znakiem i jednym miejscem po przecinku („+13,2% r/r”); bez wartości — pusty tekst. */
const changeText = (value: number | null) => value === null ? "" : ` · ${signedPct(value)} r/r`;

/**
 * „Jak rósł ryczałt?”: ryczałt PSZ szpitala w latach (2018 = 100) wobec średniej szpitali tego samego poziomu sieci i całej sieci.
 * Oś od roku bazowego (2017 r. to tylko 3 miesiące sieci). Dymek: kwota ryczałtu szpitala w roku i zmiana r/r każdej linii.
 */
function LumpIndexSection({ data, finance, yearIndex, onYear }: SectionProps & { onYear: (year: string) => void }) {
  const index = finance.lumpIndex!;
  const from = Math.max(0, data.years.indexOf(index.baseYear));
  const years = data.years.slice(from);
  const cut = <T,>(values: readonly T[]) => values.slice(from);
  const lines = [
    { key: "own", label: "Ten szpital", values: cut(index.own), tone: "primary" as const },
    { key: "level", label: `Średnia szpitali ${levelGenitive(index.level)}`, values: cut(index.levelMean), tone: "reference" as const },
    { key: "all", label: "Średnia sieci PSZ", values: cut(index.allMean), tone: "context" as const },
  ];
  const changes = lines.map((line) => yearOverYear(line.values));
  const amounts = cut(index.ownValues);
  const year = data.years[yearIndex];
  const own = index.own[yearIndex];
  const mean = index.levelMean[yearIndex];
  const levelName = levelGenitive(index.level);
  const hospitalsWord = (n: number) => `${n} ${plural(n, "szpital", "szpitale", "szpitali")}`;
  const tooltip = (y: number) => lines.map((line, i) => {
    const value = line.values[y];
    if (value === null) return <>{line.label}: brak</>;
    return <>{line.label}: <b>{Math.round(value)}</b>{i === 0 && amounts[y] ? ` · ${formatPln(amounts[y])}` : ""}{changeText(changes[i][y])}</>;
  });
  return <section className={tabs.sec} aria-labelledby="s-ryczalt-indeks">
    <SectionHead id="s-ryczalt-indeks" question="Jak rósł ryczałt?" context={`Ryczałt sieci szpitali, ${index.baseYear} = 100, wobec szpitali ${levelName}`} tag="Lata" />
    {own !== null && mean !== null && yearIndex > from ? <p className={base.lead}>
      W {year} r. ryczałt szpitala to <b>{formatPln(index.ownValues[yearIndex])}</b>, czyli <b>{Math.round(own)}</b> ({index.baseYear} = 100): {own >= 100 ? "wzrost" : "spadek"} o {Math.abs(Math.round(own - 100))}%.
      Średnia {index.levelCount[yearIndex]} {index.levelCount[yearIndex] === 1 ? "szpitala" : "szpitali"} {levelName}: <b>{Math.round(mean)}</b>, czyli ryczałt szpitala wzrósł {paceText(own, mean, levelName)}.
      Cała sieć: {index.allMean[yearIndex] === null ? "—" : Math.round(index.allMean[yearIndex]!)}.
    </p> : <p className={base.lead}>Ryczałt liczymy od {index.baseYear} r., pierwszego pełnego roku sieci szpitali. Wybierz późniejszy rok, żeby zobaczyć zmianę.</p>}
    <ul className={card.lineKey} aria-label="Linie wykresu">
      <li><span className={card.keySolid} aria-hidden />ten szpital</li>
      <li><span className={card.keyDot} aria-hidden />średnia szpitali {levelName} ({hospitalsWord(index.levelCount.at(-1) ?? 0)})</li>
      <li><span className={`${card.keyDot} ${styles.keyDash}`} aria-hidden />średnia całej sieci PSZ</li>
    </ul>
    <YearIndexChart
      years={years} selected={yearIndex - from} onYear={onYear} context={`Ryczałt PSZ, ${index.baseYear} = 100`} lines={lines} tooltipLines={tooltip}
      ariaLabel={`Wykres liniowy: ryczałt szpitala w latach (${index.baseYear} = 100) wobec średniej szpitali ${levelName} i całej sieci; kliknięcie roku zmienia rok karty`}
    />
    <p className={base.note}>
      Ryczałt: plan umowy z NFZ (API NFZ „Umowy”), pozycja „Ryczałt PSZ”. Baza: {index.baseYear} r., pierwszy pełny rok sieci (w 2017 r. sieć działała od października).
      Średnia: średnia indeksów szpitali z ryczałtem w {index.baseYear} r. (każdy szpital waży tyle samo); poziom sieci według bieżącego wykazu PSZ.
      W dymku: kwota ryczałtu szpitala i zmiana r/r każdej linii. Spadek w 2021 r.: oddziały dziecięce wyjęte z ryczałtu (NFZ płaci za nie za każdy pobyt).
    </p>
  </section>;
}

/** „Za co płaci NFZ?”: cztery drogi pieniędzy i jedna tabela pozycji umowy (plan, rozliczenie grup JGP, limit, plan w latach). */
function PaySection({ data, finance, yearIndex }: SectionProps) {
  const year = data.years[yearIndex];
  const [openGroups, setOpenGroups] = useState<Set<number>>(() => new Set([0, 1, 2, 3]));
  const [openBuckets, setOpenBuckets] = useState<Set<number>>(() => new Set());
  const plan = groupSums(finance.plan, yearIndex);
  const settled = groupSums(finance.settled, yearIndex);
  const total = plan.reduce((sum, value) => sum + value, 0) || 1;
  const hasSettled = settled[0] + settled[1] > 0;
  const firstSettled = settledYears(finance)[0];
  const settledFrom = firstSettled === undefined ? "2019" : data.years[firstSettled];
  // Największe grupy JGP pozycji umowy w roku (zagregowane podczas budowania).
  const groups = useMemo(() => new Map((finance.years[yearIndex]?.groups ?? []).map(([bucket, chips, count]) => [bucket, { chips, count }])), [finance, yearIndex]);
  const scale = plnScale(finance.plan.map((values) => values[yearIndex]));
  const toggle = (set: Set<number>, value: number) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };
  const way = (group: FinanceGroup, how: string, source: string, means: string) => <div className={styles.way}>
    <div className={styles.wayHead}><span className={`${styles.wayNumber} ${GROUP_SWATCH[group]} ${group === 0 ? styles.dark : ""}`} aria-hidden>{group + 1}</span><b>{FINANCE_GROUPS[group]}</b></div>
    <p className={styles.wayValue}>{formatPln(plan[group])}<small>plan umowy · {pct((plan[group] / total) * 100)}</small></p>
    <p><b>Jak:</b> {how}</p>
    <p><b>Dane:</b> {source}</p>
    <p><b>Co to znaczy:</b> {means}</p>
  </div>;
  const notSettled = `rozliczenia grup JGP są od ${settledFrom} r.`;
  const settledCell = (group: FinanceGroup, value: number) => group >= 2 ? <span className={styles.na}>tylko plan</span> : !hasSettled ? <span className={styles.na}>od {settledFrom} r.</span> : value ? <b>{scale.format(value)}</b> : "—";
  return <section className={tabs.sec} aria-labelledby="s-za-co">
    <SectionHead id="s-za-co" question="Za co płaci NFZ?" context={`Pozycje umowy w ${year} r.: plan, rozliczenie i limit`} tag="Rok" />
    <div className={styles.ways}>
      {way(0, "stała kwota za oddziały sieci, z dopłatami do wynagrodzeń.", hasSettled ? `grupy JGP wykazane w tych oddziałach: ${formatPln(settled[0])} (miara pracy, nie przelew).` : `${notSettled}.`, "więcej pobytów w tym roku nie daje więcej pieniędzy w tym roku.")}
      {way(1, "za każdy pobyt w zakresach wyjętych z ryczałtu.", hasSettled && plan[1] ? `rozliczono ${formatPln(settled[1])}, czyli ${pct((settled[1] / plan[1]) * 100)} planu.` : `${notSettled}.`, "więcej pacjentów = więcej pieniędzy; zaćma, endoprotezy, dzieci i onkologia bez limitu.")}
      {way(2, "za podanie leku, dobę SOR, cykl chemioterapii.", "tylko plan: zestawienie NFZ obejmuje wyłącznie grupy JGP.", "kwota zależy od liczby pacjentów w programach i na SOR.")}
      {way(3, "osobne pozycje umowy za poradnie, badania, dializy, psychiatrię, opiekę paliatywną i długoterminową, rehabilitację, nocną opiekę, transport.", "tylko plan.", "nie dotyczy hospitalizacji rozliczanych grupami JGP.")}
    </div>
    <div className={`priority-table ${card.tableWrap}`}>
      <table className={base.table}>
        <thead><tr>
          <th>Pozycja umowy</th>
          <th className={base.num}>Plan ({scale.unit})</th>
          <th className={base.num}>Rozliczone grupy JGP ({scale.unit})</th>
          <th className="col-p2">Limit</th>
          <th className="col-p3">Plan {data.years[0]}–{data.years.at(-1)}</th>
        </tr></thead>
        <tbody>
          {FINANCE_GROUPS.map((name, groupIndex) => {
            const group = groupIndex as FinanceGroup;
            // Pozycje z kwotą, która w jednostce tabeli nie zaokrągla się do zera (np. „0” mln zł).
            const visible = (value: number) => value > 0 && scale.format(value) !== "0";
            const rows = FINANCE_BUCKETS.map((bucket, i) => ({ bucket, i })).filter(({ bucket, i }) => bucket.group === group && (visible(finance.plan[i][yearIndex]) || visible(finance.settled[i][yearIndex])))
              .sort((a, b) => finance.plan[b.i][yearIndex] - finance.plan[a.i][yearIndex]);
            if (!rows.length) return null;
            const open = openGroups.has(group);
            return <Fragment key={name}>
              <tr className={styles.groupRow}>
                <td>
                  <button type="button" className={styles.rowButton} aria-expanded={open} onClick={() => setOpenGroups((set) => toggle(set, group))}>
                    <span className={styles.caret} aria-hidden>{open ? "▾" : "▸"}</span><span className={`${styles.groupSwatch} ${GROUP_SWATCH[group]}`} aria-hidden /><b>{name}</b>
                  </button>
                  <span className={styles.small}>{rows.length} {plural(rows.length, "pozycja", "pozycje", "pozycji")}</span>
                </td>
                <td className={base.num}><b>{scale.format(plan[group])}</b></td>
                <td className={base.num}>{settledCell(group, settled[group])}</td>
                <td className="col-p2" />
                <td className="col-p3" />
              </tr>
              {open ? rows.map(({ bucket, i }) => {
                const bucketOpen = openBuckets.has(i);
                const items = finance.items.filter(([b, y]) => b === i && y === yearIndex);
                const codes = group <= 1 ? groups.get(i) : undefined;
                return <Fragment key={bucket.key}>
                  <tr>
                    <td className={styles.indent}>
                      <button type="button" className={styles.rowButton} aria-expanded={bucketOpen} onClick={() => setOpenBuckets((set) => toggle(set, i))}>
                        <span className={styles.caret} aria-hidden>{bucketOpen ? "▾" : "▸"}</span><b>{bucket.name}</b>
                      </button>
                      <span className={styles.small}>{bucket.description}</span>
                    </td>
                    <td className={base.num}>{finance.plan[i][yearIndex] ? scale.format(finance.plan[i][yearIndex]) : "—"}</td>
                    <td className={base.num}>{settledCell(group, finance.settled[i][yearIndex])}</td>
                    <td className="col-p2"><span className={`${styles.limit} ${styles[`limit-${bucket.limit[0]}`]}`}>{bucket.limit[1]}</span></td>
                    <td className="col-p3"><Sparkline values={finance.plan[i].map((value) => value > 0 ? value : null)} /></td>
                  </tr>
                  {bucketOpen ? <>
                    {items.map(([, , nameIndex, value]) => <tr key={nameIndex} className={styles.sub}>
                      <td className={styles.indent2}>{sentenceCase(finance.names[nameIndex])}</td>
                      <td className={base.num}>{scale.format(value)}</td><td /><td className="col-p2" /><td className="col-p3" />
                    </tr>)}
                    {codes?.chips.length ? <tr className={styles.sub}><td colSpan={5} className={styles.indent2}>
                      <span className={styles.chips}>Największe grupy JGP{bucket.key === "ryczalt" ? " w ryczałcie" : ""}: <GroupChips data={data} chips={codes.chips} count={codes.count} /></span>
                    </td></tr> : null}
                  </> : null}
                </Fragment>;
              }) : null}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
    <p className={base.note}>
      Plan: API NFZ „Umowy” (kwota pozycji z aneksami). Rozliczenie: zestawienie świadczeń NFZ — obejmuje tylko grupy JGP, dlatego leki, SOR, chemioterapia
      i świadczenia poza leczeniem szpitalnym mają sam plan. Limit: stan według komunikatów NFZ i MZ; gwiazdka (*) = nie znaleźliśmy informacji o zniesieniu limitu.
      Kliknięcie grupy rozwija jej pozycje; kliknięcie pozycji pokazuje pozycje planu i grupy JGP. <InfoTip ariaLabel="Jak dzielimy pozycje umowy" label={<HelpLines lines={[
        "Pozycję umowy przypisujemy do grupy po kodzie produktu: ryczałt PSZ (03.0000.030.17), dopłaty (kody 999x), zakresy hospitalizacji (03.4xxx), programy lekowe, chemioterapia, SOR, poradnie (02.*), nocna opieka (01.*), rehabilitacja (05.*), transport (17.*).",
        "Rozliczone grupy JGP w zakresie bez osobnej kwoty w planie to wartość sprawozdana w ryczałcie, nie przelew.",
      ]} />} />
    </p>
  </section>;
}

/** Kody JGP jako linki do karty grupy z tym szpitalem; `both`: grupy obecne w obu częściach oddziału (ryczałt i za wykonanie). */
function GroupChips({ data, chips, count }: { data: HospitalPageData; chips: FinanceChip[]; count: number }) {
  return <>
    {chips.map(([code, thousands, both]) => <Link
      key={code}
      href={`/jgp/${encodeURIComponent(code)}?osrodek=${encodeURIComponent(data.key)}`}
      className={`${styles.chip} ${both ? styles.chipBoth : ""}`}
      title={`${code}: ${formatPln(thousands * 1000)}${both ? " · grupa także w drugiej części oddziału" : ""}`}
    >{code}</Link>)}
    {count > chips.length ? <span className={styles.na}>+{count - chips.length}</span> : null}
  </>;
}

/** Pasek dwóch części i oba udziały słowami. */
function PayShare({ paid, total }: { paid: number; total: number }) {
  const share = total ? (paid / total) * 100 : 0;
  return <span title={payShareText(share)}>
    <span className={styles.split} aria-hidden><i style={{ width: `${100 - share}%` }} /><i style={{ width: `${share}%` }} /></span>
    <span className={styles.shareText}>{payShareText(share)}</span>
  </span>;
}

/** Komunikat dla roku bez rozliczeń grup JGP (zestawienie świadczeń jest od 2019 r.). */
function NoSettlements({ year, from }: { year: string; from: string | null }) {
  return <p className={card.empty} role="status"><b>Brak rozliczeń grup JGP w {year} r.</b> Zestawienie świadczeń NFZ ma kwoty grup JGP {from ? `od ${from} r.` : "od 2019 r."} Wybierz późniejszy rok.</p>;
}

/** „Ile grup JGP idzie przez ryczałt?”: rozliczenia grup JGP w latach, w zakresach ryczałtowych i za wykonanie. */
function LumpSection({ data, finance, yearIndex, onYear }: SectionProps & { onYear: (year: string) => void }) {
  const shown = settledYears(finance);
  if (!shown.length) return null;
  const years = shown.map((y) => data.years[y]);
  const splits = shown.map((y) => lumpSplit(finance, y));
  const selected = shown.indexOf(yearIndex);
  const current = selected >= 0 ? splits[selected] : null;
  const first = splits[0];
  const parts: StackPart[] = PAY_PARTS.map((part) => ({ ...part, values: splits.map((split) => split[part.key]) }));
  const share = (split: { lump: number; paid: number }) => (split.paid / (split.lump + split.paid || 1)) * 100;
  return <section className={tabs.sec} aria-labelledby="s-ryczalt">
    <SectionHead id="s-ryczalt" question="Ile grup JGP idzie przez ryczałt?" context={`Rozliczenia grup JGP, ${years[0]}–${years.at(-1)}`} tag="Lata" />
    {current ? <p className={base.lead}>
      W {data.years[yearIndex]} r. szpital wykazał grupy JGP za <b>{formatPln(current.lump + current.paid)}</b>. W zakresach ryczałtowych: <b>{formatPln(current.lump)}</b> ({pct(100 - share(current))}) —
      to miara pracy, ryczałt płaci swoją stałą kwotę. Za wykonanie: <b>{formatPln(current.paid)}</b> ({pct(share(current))}).
      {selected > 0 ? ` W ${years[0]} r. za wykonanie było ${pct(share(first))}.` : ""}
    </p> : <NoSettlements year={data.years[yearIndex]} from={years[0]} />}
    <YearStackBars
      years={years} parts={parts} selected={selected} onYear={onYear} percentLabels height={230} context="Rozliczenia grup JGP"
      ariaLabel="Rozliczenia grup JGP w latach: w zakresach ryczałtowych i za wykonanie; kliknięcie roku zmienia rok karty"
    />
    <ul className={base.legend} aria-label="Legenda">
      <li><span className={`${base.swatch} ${styles.swatchStrong}`} aria-hidden />w zakresach ryczałtowych (wartość sprawozdana)</li>
      <li><span className={`${base.swatch} ${styles.swatchSoft}`} aria-hidden />za wykonanie (finansowane odrębnie)</li>
    </ul>
    <p className={base.note}>Podział: kod zakresu przy każdej grupie w zestawieniu świadczeń NFZ. Zakres z osobną kwotą w planie umowy = za wykonanie, pozostałe zakresy = ryczałt. Kliknięcie słupka zmienia rok karty.</p>
  </section>;
}

/** „Jak NFZ płaci za oddziały?”: oddział (kod z zakresu umowy), kwota grup JGP, podział ryczałt / za wykonanie; rozwinięcie — zakresy i grupy JGP. */
function WardPaySection({ data, finance, yearIndex }: SectionProps) {
  const year = data.years[yearIndex];
  const rows = useMemo(() => wardRows(finance, yearIndex), [finance, yearIndex]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const first = settledYears(finance)[0];
  const total = rows.reduce((sum, row) => sum + row.lump + row.paid, 0);
  const scale = plnScale(rows.map((row) => row.lump + row.paid));
  const paidShare = (row: { lump: number; paid: number }) => (row.paid / (row.lump + row.paid || 1)) * 100;
  const lumpOnly = rows.filter((row) => paidShare(row) <= FULL_SHARE);
  const paidOnly = rows.filter((row) => paidShare(row) >= 100 - FULL_SHARE);
  const mixed = rows.length - lumpOnly.length - paidOnly.length;
  const example = rows.find((row) => paidShare(row) > FULL_SHARE && paidShare(row) < 100 - FULL_SHARE);
  const codesOf = (paid: boolean) => [...new Set(example?.scopes.filter((scope) => scope.paid === paid).flatMap((scope) => scope.chips.slice(0, 3).map(([code]) => code)))].slice(0, 4).join(", ");
  return <section className={tabs.sec} aria-labelledby="s-oddzialy-nfz">
    <SectionHead id="s-oddzialy-nfz" question="Jak NFZ płaci za oddziały?" context={`Oddziały, zakresy i grupy JGP, ${year}`} tag="Rok" />
    {!rows.length ? <NoSettlements year={year} from={first === undefined ? null : data.years[first]} /> : <>
      <p className={base.lead}>
        W {year} r. grupy JGP z oddziałów to <b>{formatPln(total)}</b>. Co najmniej 95% w ryczałcie: <b>{lumpOnly.length}</b> {plural(lumpOnly.length, "oddział", "oddziały", "oddziałów")},
        co najmniej 95% za wykonanie: <b>{paidOnly.length}</b>, mieszane: <b>{mixed}</b>.
        {example ? <> Przykład: <b>{lower(example.name)}</b> — {payShareText(paidShare(example))}: z {formatPln(example.lump + example.paid)} grup JGP {formatPln(example.paid)} NFZ zapłacił osobno ({codesOf(true)}), a {formatPln(example.lump)} to grupy w ryczałcie ({codesOf(false)}).</> : null}
      </p>
      <div className={`priority-table ${card.tableWrap}`}>
        <table className={base.table}>
          <thead><tr>
            <th>Oddział</th>
            <th className={`${base.num} col-p3`}>Łóżka</th>
            <th className={base.num}>Grupy JGP ({scale.unit})</th>
            <th className={`${base.num} col-p2`}>Ryczałt</th>
            <th className={`${base.num} col-p2`}>Za wykonanie</th>
            <th>Podział</th>
            <th className={`${base.num} col-p3`}>Grupy JGP: R / W / obie</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = open.has(row.code);
              return <Fragment key={row.code}>
                <tr>
                  <td>
                    <button type="button" className={styles.rowButton} aria-expanded={isOpen} onClick={() => setOpen((set) => { const next = new Set(set); if (next.has(row.code)) next.delete(row.code); else next.add(row.code); return next; })}>
                      <span className={styles.caret} aria-hidden>{isOpen ? "▾" : "▸"}</span><b>{row.name}</b>
                    </button>
                    <span className={styles.small}>kod {row.code}{row.beds === null ? " · brak w RPWDL" : ""}</span>
                  </td>
                  <td className={`${base.num} col-p3`}>{row.beds ? row.beds : "—"}</td>
                  <td className={base.num}><b>{scale.format(row.lump + row.paid)}</b></td>
                  <td className={`${base.num} col-p2`}>{row.lump ? scale.format(row.lump) : "—"}</td>
                  <td className={`${base.num} col-p2`}>{row.paid ? scale.format(row.paid) : "—"}</td>
                  <td><PayShare paid={row.paid} total={row.lump + row.paid} /></td>
                  <td className={`${base.num} col-p3`}>{row.onlyLump} / {row.onlyPaid} / {row.both}</td>
                </tr>
                {isOpen ? row.scopes.map((scope) => <tr key={`${scope.code}-${scope.paid}`} className={styles.sub}>
                  <td className={styles.indent}>
                    <span className={`${card.pay} ${scope.paid ? card.payOut : card.payLump}`}>{scope.paid ? "za wykonanie" : "ryczałt"}</span> {scopeLabel(scope.name)}
                    <span className={styles.small}>zakres {scope.code}</span>
                  </td>
                  <td className="col-p3" />
                  <td className={base.num}>{scale.format(scope.value)}</td>
                  <td className={`${base.num} col-p2`}>{scope.paid ? "" : scale.format(scope.value)}</td>
                  <td className={`${base.num} col-p2`}>{scope.paid ? scale.format(scope.value) : ""}</td>
                  <td colSpan={2}><span className={styles.chips}><GroupChips data={data} chips={scope.chips} count={scope.groups} /></span></td>
                </tr>) : null}
              </Fragment>;
            })}
          </tbody>
        </table>
      </div>
      <ul className={base.legend} aria-label="Legenda">
        <li><span className={`${card.pay} ${card.payLump}`}>ryczałt</span>zakres w ryczałcie sieci</li>
        <li><span className={`${card.pay} ${card.payOut}`}>za wykonanie</span>zakres z osobną kwotą w umowie</li>
        <li><span className={`${styles.chip} ${styles.chipBoth}`}>M13</span>ta sama grupa JGP w obu częściach oddziału</li>
      </ul>
    </>}
    <p className={base.note}>
      „R / W / obie”: liczba grup JGP tylko w ryczałcie, tylko za wykonanie i w obu częściach oddziału. Oddział łączy się z zakresem NFZ przez kod resortowy
      (03.<b>4450</b>.260.02 → 4450); nazwa i łóżka z rejestru RPWDL. Oddziały bez rozliczeń grupami JGP (np. intensywna terapia) nie mają wiersza.
    </p>
  </section>;
}

/** Pozycja kwoty za pobyt na skali od ¼× do 4× (środek = średnia szpitala). */
const indexPosition = (value: number) => 50 + (Math.max(-2, Math.min(2, Math.log2(value))) / 2) * 50;
/** Sekcja z kwotą za pobyt ≥ tylu razy średnia = „droższy”, ≤ odwrotności = „tańszy”. */
const INDEX_HIGH = 1.15;
const INDEX_LOW = 0.87;
/** Sekcje z co najmniej tyloma hospitalizacjami w zdaniu o najdroższym i najtańszym pobycie. */
const INDEX_MIN_HOSP = 100;

/** „Gdzie są pieniądze?”: sekcje JGP — kwota, udziały w kwocie i w pobytach, ryczałt / za wykonanie, kwota za pobyt wobec średniej szpitala. */
function SectionsPaySection({ data, finance, yearIndex }: SectionProps) {
  const year = data.years[yearIndex];
  const rows = useMemo(() => {
    const totals = sectionTotals(data.groups, data.years);
    return sectionPayRows(finance, yearIndex, new Map([...totals].map(([letter, values]) => [letter, values[yearIndex]])));
  }, [data, finance, yearIndex]);
  const first = settledYears(finance)[0];
  const scale = plnScale(rows.map((row) => row.value));
  const label = (letter: string) => JGP_SECTION_LABELS[letter] ?? "inne";
  const byIndex = rows.filter((row) => row.hospitalizations >= INDEX_MIN_HOSP).sort((a, b) => b.index - a.index);
  const mostlyPaid = rows.filter((row) => row.paid / (row.value || 1) >= 0.8).map((row) => row.letter);
  return <section className={tabs.sec} aria-labelledby="s-sekcje-nfz">
    <SectionHead id="s-sekcje-nfz" question="Gdzie są pieniądze?" context={`Rozliczenia NFZ za grupy JGP według sekcji, ${year}`} tag="Rok" />
    {!rows.length ? <NoSettlements year={year} from={first === undefined ? null : data.years[first]} /> : <>
      <p className={base.lead}>
        Najwięcej pieniędzy daje <b>{lower(label(rows[0].letter))}</b>: {formatPln(rows[0].value)}, czyli {pct(rows[0].valueShare)} kwoty przy {pct(rows[0].hospShare)} pobytów.
        {byIndex.length > 1 ? <> Najdroższy pobyt: <b>{lower(label(byIndex[0].letter))}</b> ({decimal(byIndex[0].index)}× średniej). Najtańszy: <b>{lower(label(byIndex.at(-1)!.letter))}</b> ({decimal(byIndex.at(-1)!.index)}×).</> : null}
        {mostlyPaid.length ? <> Co najmniej 80% za wykonanie: <b>{mostlyPaid.join(", ")}</b>; w pozostałych sekcjach przeważa ryczałt.</> : null}
      </p>
      <div className={`priority-table ${card.tableWrap}`}>
        <table className={base.table}>
          <thead><tr>
            <th>Sekcja JGP</th>
            <th className={base.num}>Kwota NFZ ({scale.unit})</th>
            <th className={`${base.num} col-p2`}>Udział w kwocie</th>
            <th className={`${base.num} col-p2`}>Udział w pobytach</th>
            <th>Ryczałt / za wykonanie</th>
            <th className="col-p2">Pobyt wobec średniej</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const tone = row.index >= INDEX_HIGH ? CHART_COLORS.signal : row.index <= INDEX_LOW ? CHART_COLORS.data : CHART_COLORS.textSecondary;
              const word = row.index >= INDEX_HIGH ? "droższy" : row.index <= INDEX_LOW ? "tańszy" : "średni";
              const [a, b] = [indexPosition(1), indexPosition(row.index)];
              return <tr key={row.letter}>
                <td><b>{row.letter}</b> {label(row.letter)}<span className={styles.small}>{row.hospitalizations.toLocaleString("pl-PL")} hosp.</span></td>
                <td className={base.num}><span className={styles.inbar} aria-hidden><i style={{ width: `${(row.value / rows[0].value) * 100}%` }} /></span><b>{scale.format(row.value)}</b></td>
                <td className={`${base.num} col-p2`}>{pct(row.valueShare, 1)}</td>
                <td className={`${base.num} col-p2`}>{pct(row.hospShare, 1)}</td>
                <td><PayShare paid={row.paid} total={row.value} /></td>
                <td className="col-p2"><span className={styles.idx} title={`Kwota za pobyt: ${decimal(row.index)}× średniej szpitala`}>
                  <span className={styles.idxBar} aria-hidden><i className={styles.mid} /><i style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%`, background: tone }} /></span>
                  <b style={{ color: tone }}>{decimal(row.index)}×</b> <small>{word}</small>
                </span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>}
    <p className={base.note}>
      Kwota: rozliczenia NFZ za grupy JGP sekcji. „Pobyt wobec średniej”: ile NFZ płaci za jeden pobyt w sekcji w porównaniu ze średnim pobytem w tym szpitalu
      (1,0× = średnio); wynika z wyceny grup, długości pobytu i zabiegów. To przychód, nie zysk: kosztów leczenia nikt nie publikuje.
    </p>
  </section>;
}

/** „Jak czytać kwoty na tej karcie?”: słownik pojęć. */
function Explain() {
  return <section className={tabs.sec} aria-label="Jak czytać kwoty">
    <details className={styles.explain}>
      <summary>Jak czytać kwoty na tej karcie?</summary>
      <dl>
        <dt>Ryczałt sieci szpitali (PSZ)</dt><dd>Stała kwota na okres rozliczeniowy za leczenie w oddziałach, z którymi szpital wszedł do sieci. Więcej pacjentów w tym roku nie daje więcej pieniędzy w tym roku. Wpływa na ryczałt w kolejnych okresach.</dd>
        <dt>Finansowane odrębnie (za wykonanie)</dt><dd>Świadczenia, za które NFZ płaci za każdy pobyt, często bez limitu: zaćma, endoprotezy, kardiologia inwazyjna, onkologia, porody i noworodki III poziomu, leczenie dzieci.</dd>
        <dt>Wartość sprawozdana</dt><dd>Wycena grup JGP, które szpital wykazał NFZ. W oddziałach na ryczałcie to miara pracy, nie przelew.</dd>
        <dt>Plan umowy a rozliczenie</dt><dd>Plan (API NFZ „Umowy”) to kwota umowy z aneksami. Rozliczenie (zestawienie świadczeń NFZ) to wartość wykazanych świadczeń. Liczby się różnią, bo mierzą co innego.</dd>
        <dt>Limit</dt><dd>„Bez limitu”: NFZ płaci także ponad kwotę umowy. Dotyczy zaćmy, TK i MR (od kwietnia 2019 r.), endoprotezoplastyki (od 2019 r.), świadczeń dla dzieci do 18 lat (od 2021 r.) i onkologii z kartą DiLO. Gwiazdka (*): nie znaleźliśmy informacji o zniesieniu limitu.</dd>
        <dt>Ta sama grupa, dwa sposoby</dt><dd>Grupa JGP bywa w ryczałcie albo poza nim. Decyduje zakres: wiek pacjenta (poniżej 18 lat), rozpoznanie nowotworu, poziom oddziału.</dd>
      </dl>
    </details>
  </section>;
}
