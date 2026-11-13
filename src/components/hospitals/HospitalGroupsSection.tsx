"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionHead } from "@/components/jgp/JgpTabbedCard";
import { Sparkline } from "@/components/jgp/JgpCatalog";
import { HelpLines, InfoTip } from "@/components/InfoTip";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { plnScale } from "@/lib/formatters";
import { plural } from "@/lib/jgpDescription";
import type { HospitalGroupRow, HospitalPageData } from "@/lib/hospitalPage";
import { funnelStatus, type FunnelStatus } from "@/lib/jgpCard";
import { FUNNEL_STATUS_COLORS } from "@/lib/mortalityFunnel";
import { nextSortState, sortTableRows, type SortState } from "@/lib/tableSort";
import base from "@/components/jgp/JgpPage.module.css";
import tabs from "@/components/jgp/JgpTabs.module.css";
import styles from "./HospitalCard.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number, digits = 1) => value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value), 0)}%`;
const pct = (value: number) => `${decimal(value, value > 0 && value < 1 ? 2 : 1)}%`;

/** Wiersze widoczne przed „Pokaż wszystkie” (DESIGN.md 7.1, pkt 6: 10–20; karta szpitala ma setki grup, więc 10). */
export const GROUPS_SHOWN = 10;
/** Status śmiertelności (lejek) tylko przy co najmniej tylu zgonach oczekiwanych, gdyby śmiertelność była jak w Polsce. */
export const MIN_EXPECTED_DEATHS = 1;

const groupsWord = (n: number) => `${integer(n)} ${plural(n, "grupę", "grupy", "grup")} JGP`;

type SortKey = "name" | "hospitalizations" | "value" | "change" | "rank" | "mortality";

/** Wiersz tabeli w roku karty. */
interface GroupLine {
  row: HospitalGroupRow;
  code: string;
  name: string;
  hospitalizations: number;
  value: number;
  /** Zmiana kwoty NFZ r/r (%); `null` bez kwoty w jednym z lat. */
  change: number | null;
  /** Kwota w poprzednim roku (0 = brak; „nowa”, gdy jest kwota w roku karty). */
  previousValue: number;
  rank: number;
  providers: number;
  mortality: number;
  nationalMortality: number | null;
  /** Udział szpitala w kwocie NFZ za grupę w całej Polsce (%). */
  nationalShare: number | null;
  status: FunnelStatus | null;
  deaths: number;
  expected: number;
}

/** Linie tabeli w roku karty: grupy z hospitalizacjami albo kwotą NFZ. */
export function groupLines(groups: HospitalGroupRow[], yearIndex: number): GroupLine[] {
  return groups.flatMap((row) => {
    const [code, name, hosp, rank, providers, pln, deaths, nationalHosp, nationalDeaths, nationalPln] = row;
    const hospitalizations = hosp[yearIndex] ?? 0;
    const value = pln[yearIndex] ?? 0;
    if (!hospitalizations && !value) return [];
    const previousValue = yearIndex > 0 ? pln[yearIndex - 1] ?? 0 : 0;
    const nationalMortality = nationalHosp[yearIndex] ? (nationalDeaths[yearIndex] / nationalHosp[yearIndex]) * 100 : null;
    const mortality = hospitalizations ? (deaths[yearIndex] / hospitalizations) * 100 : 0;
    const expected = nationalMortality === null ? 0 : (hospitalizations * nationalMortality) / 100;
    return [{
      row, code, name, hospitalizations, value, previousValue,
      change: value && previousValue ? ((value - previousValue) / previousValue) * 100 : null,
      rank: rank[yearIndex], providers: providers[yearIndex], mortality, nationalMortality,
      nationalShare: value && nationalPln[yearIndex] ? (value / nationalPln[yearIndex]) * 100 : null,
      status: nationalMortality !== null && hospitalizations && expected >= MIN_EXPECTED_DEATHS ? funnelStatus(mortality, nationalMortality, hospitalizations) : null,
      deaths: deaths[yearIndex], expected,
    }];
  });
}

/**
 * „Co leczy i za ile?”: grupy JGP szpitala w roku karty — hospitalizacje, kwota NFZ, miejsce w Polsce, śmiertelność wobec Polski
 * i trend wszystkich lat. Sortowanie kolumn; domyślnie od największej liczby hospitalizacji.
 * Kolumny (DESIGN.md 7.1): grupa, hospitalizacje i kwota zawsze; miejsce i śmiertelność od 640 px; zmiana kwoty i trend od 900 px.
 */
export function GroupsSection({ data, yearIndex }: { data: HospitalPageData; yearIndex: number }) {
  const year = data.years[yearIndex];
  const [sort, setSort] = useState<SortState<SortKey>>(null);
  const [all, setAll] = useState(false);
  const lines = useMemo(() => groupLines(data.groups, yearIndex), [data.groups, yearIndex]);
  const sorted = useMemo(() => {
    if (!sort) return [...lines].sort((a, b) => b.hospitalizations - a.hospitalizations || b.value - a.value || a.code.localeCompare(b.code));
    // Brak wartości („—”) zawsze na końcu.
    const missing = sort.direction === "asc" ? Infinity : -Infinity;
    return sortTableRows(lines, sort.direction, (line) => {
      switch (sort.key) {
        case "name": return line.code;
        case "hospitalizations": return line.hospitalizations;
        case "value": return line.value || missing;
        case "change": return line.change ?? missing;
        case "rank": return line.rank || (sort.direction === "asc" ? Infinity : -Infinity);
        case "mortality": return line.hospitalizations ? line.mortality : missing;
      }
    });
  }, [lines, sort]);
  const hasPln = lines.some((line) => line.value > 0);
  // Wspólna jednostka kolumny kwot w nagłówku (DESIGN.md 3.1).
  const scale = plnScale(lines.flatMap((line) => line.value ? [line.value] : []));
  const shown = all ? sorted : sorted.slice(0, GROUPS_SHOWN);
  const header = (key: SortKey, label: string, className?: string) => <SortableTableHeader
    label={label} className={className} active={sort?.key === key} direction={sort?.direction} onSort={() => setSort((current) => nextSortState(current, key))}
  />;
  // Trend: hospitalizacje we wszystkich latach; rok bez hospitalizacji to przerwa (jak na wykresie „Ile?”).
  const trend = (row: HospitalGroupRow) => row[2].map((value) => value > 0 ? value : null);
  const totalValue = lines.reduce((sum, line) => sum + line.value, 0);
  const top = [...lines].sort((a, b) => b.value - a.value)[0];

  return <section className={tabs.sec} aria-labelledby="s-za-ile">
    <SectionHead id="s-za-ile" question="Co leczy i za ile?" context={`Grupy JGP szpitala w ${year} r.`} tag="Rok + mini-trend" />
    {hasPln && top ? <p className={base.lead}>
      W {year} r. NFZ rozliczył ze szpitalem <b>{scale.format(totalValue)} {scale.unit}</b> za {groupsWord(lines.filter((line) => line.value > 0).length)}.
      Najwięcej: <b>{top.code}</b> ({decimal((top.value / totalValue) * 100, 0)}%).
    </p> : <p className={base.lead}>W {year} r. szpital miał hospitalizacje w {integer(lines.length)} {lines.length === 1 ? "grupie" : "grupach"} JGP. Kwoty NFZ za grupy są od 2019 r.</p>}
    <div className={`priority-table ${styles.tableWrap}`}>
      <table className={base.table}>
        <thead><tr>
          {header("name", "Grupa JGP")}
          {header("hospitalizations", "Hosp.", base.num)}
          {hasPln ? header("value", `NFZ (${scale.unit})`, base.num) : null}
          {header("rank", "Miejsce w Polsce", `${base.num} col-p2`)}
          {header("mortality", "Śmiertelność", `${base.num} col-p2`)}
          {hasPln ? header("change", "r/r kwoty", `${base.num} col-p3`) : null}
          <th className="col-p3">{data.years[0]}–{data.years.at(-1)}</th>
        </tr></thead>
        <tbody>
          {shown.map((line) => <tr key={line.code}>
            <td>
              <Link href={`/jgp/${encodeURIComponent(line.code)}?osrodek=${encodeURIComponent(data.key)}`} className={base.code}>{line.code}</Link> {line.name}
              <span className={styles.groupName}>
                {[
                  line.nationalMortality === null ? null : `Polska: ${pct(line.nationalMortality)} śmiertelności`,
                  line.nationalShare === null ? null : `${pct(line.nationalShare)} kwoty grupy w Polsce`,
                ].filter(Boolean).join(" · ")}
              </span>
            </td>
            <td className={base.num}>{integer(line.hospitalizations)}</td>
            {hasPln ? <td className={base.num}>{line.value ? <b>{scale.format(line.value)}</b> : "—"}</td> : null}
            <td className={`${base.num} col-p2`}>{line.rank ? <>{line.rank <= 3 ? <span className={styles.rankTop}>{line.rank}.</span> : `${line.rank}.`} <span className={styles.rankOf}>z {integer(line.providers)}</span></> : "—"}</td>
            <td className={`${base.num} col-p2`}>{line.hospitalizations ? <MortalityCell line={line} /> : "—"}</td>
            {hasPln ? <td className={`${base.num} col-p3`} title={line.previousValue ? `${data.years[yearIndex - 1]}: ${scale.format(line.previousValue)} ${scale.unit}` : undefined}>
              {line.change === null ? (line.value && yearIndex > 0 && data.years[yearIndex - 1] >= "2019" ? "nowa" : "—") : signedPct(line.change)}
            </td> : null}
            <td className="col-p3"><Sparkline values={trend(line.row)} /></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {sorted.length > GROUPS_SHOWN ? <button type="button" className={styles.more} onClick={() => setAll((value) => !value)}>{all ? "Pokaż mniej" : `Pokaż wszystkie (${integer(sorted.length)})`}</button> : null}
    <p className={base.note}>
      Hospitalizacje metodą konserwatywną (&lt;5 = 1). NFZ: kwota rozliczona za grupę w {year} r. (zestawienie świadczeń, od 2019 r.) — przychód, nie zysk; pod nazwą udział szpitala w kwocie grupy w Polsce.
      Miejsce: pozycja wśród wszystkich ośrodków grupy według hospitalizacji. Kropka śmiertelności: odchylenie od Polski (granice 95% i 99,8%), bez korekty o wiek i stan pacjentów.
      Kod prowadzi do karty grupy z tym szpitalem. <InfoTip ariaLabel="Jak czytać tabelę grup" label={<HelpLines lines={[
        "Kolor kropki: ciepły — śmiertelność powyżej Polski poza granicą przypadku, niebieski — poniżej, szary — w granicach.",
        `Kropka bez wypełnienia: za mało zgonów do oceny (mniej niż ${MIN_EXPECTED_DEATHS} zgon oczekiwany przy śmiertelności jak w Polsce).`,
        "Mini-wykres: hospitalizacje szpitala w grupie we wszystkich latach, skala wiersza (kształt, nie wielkość).",
      ]} />} />
    </p>
  </section>;
}

function MortalityCell({ line }: { line: GroupLine }) {
  const title = [
    `Szpital: ${pct(line.mortality)} (${integer(line.deaths)} zgonów z ${integer(line.hospitalizations)} hosp.)`,
    line.nationalMortality === null ? null : `Polska: ${pct(line.nationalMortality)}; zgony oczekiwane: ${decimal(line.expected)}`,
    line.status ? `Odchylenie: ${line.status}` : "Za mało zgonów do oceny",
  ].filter(Boolean).join("\n");
  return <span className={styles.mortality} title={title}>
    <i className={line.status ? styles.devDot : `${styles.devDot} ${styles.devDotEmpty}`} style={line.status ? { background: FUNNEL_STATUS_COLORS[line.status] } : undefined} aria-label={line.status ? `odchylenie: ${line.status}` : "za mało zgonów do oceny"} role="img" />
    {pct(line.mortality)}
  </span>;
}
