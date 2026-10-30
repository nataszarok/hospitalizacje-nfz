"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import {
  ABOVE_COLOR,
  AgreementCompositionChart,
  BELOW_COLOR,
  CodesChart,
  IncomeLineChart,
  WARD_COLORS,
  WardPerHospChart,
  WardPerHospTrend,
  WardValueLineChart,
  type CodeMetric,
} from "@/components/sanok/SanokHospitalCharts";
import { SanokYearChart } from "@/components/sanok/SanokYearChart";
import { formatCount, formatShare } from "@/lib/sanokCodes";
import {
  agreementComposition,
  buildHospitalCodeRows,
  buildIncomeSeries,
  buildWardRows,
  buildWardYearSeries,
  buildYearSeries,
  formatMillions,
  formatPln,
  formatThousands,
  formatYearRange,
  fullYears,
  hospitalValuePerHosp,
  latestSummaryYear,
  loadSanokHospitalDataset,
  lowestValuePerHosp,
  summaryYears,
  type HospitalCodeRow,
  type SanokHospitalDataset,
  type WardRow,
} from "@/lib/sanokHospital";
import { nextSortState, sortTableRows, type SortState } from "@/lib/tableSort";
import styles from "./SanokCodesPage.module.css";

/** Kody rzadsze niż ten próg pomijamy na liście najniżej wycenionych, bo ich średnia jest niestabilna. */
const MIN_HOSPITALIZATIONS = 30;

type WardKey = "name" | "patients" | "value" | "hospCount" | "valuePerHosp" | "longStayShare";
type CodeKey = "code" | "name" | "patients" | "hospCount" | "value" | "valuePerHosp" | "longStayShare";

// Brak danych (–) ląduje na końcu przy sortowaniu malejącym.
const orLast = (value: number | null) => value ?? -1;

function wardsLabel(row: HospitalCodeRow): string {
  return row.wards.map((item) => `${item.name} ${Math.round(item.share * 100)}%`).join("; ");
}

function useSort<Key extends string>() {
  const [sort, setSort] = useState<SortState<Key>>(null);
  const header = (label: string, key: Key) => (
    <SortableTableHeader
      key={key}
      label={label}
      active={sort?.key === key}
      direction={sort?.key === key ? sort.direction : undefined}
      onSort={() => setSort((current) => nextSortState(current, key))}
    />
  );
  return { sort, header };
}

function FinanceNote({ dataset }: { dataset: SanokHospitalDataset }) {
  const finance = dataset.finance;
  if (!finance) return null;
  const margin = finance.revenue > 0 ? finance.netResult / finance.revenue : null;
  return (
    <section className={`${styles.card} ${styles.callout}`} aria-labelledby="hospital-finance-title">
      <h2 id="hospital-finance-title">Wynik całego szpitala w {finance.year}</h2>
      <p className={styles.calloutText}>
        Przychody: <strong>{formatMillions(finance.revenue)}</strong>. Wynik netto:{" "}
        <strong className={finance.netResult < 0 ? styles.negative : undefined}>{formatMillions(finance.netResult)}</strong>
        {margin !== null && <> (marża {formatShare(margin)})</>}. Źródło: {finance.source}.
      </p>
      <p className={styles.cardNote}>
        Koszty oddziałów nie są publiczne, więc nie da się policzyć zysku oddziału. Porównujemy wartość rozliczoną
        z NFZ na jedną hospitalizację. Niska wartość wskazuje oddziały i procedury nisko wycenione przez NFZ,
        zwłaszcza gdy pobyty są długie.
      </p>
    </section>
  );
}

export function SanokHospitalView({ dataset }: { dataset: SanokHospitalDataset }) {
  const [ward, setWard] = useState<number | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [codeMetric, setCodeMetric] = useState<CodeMetric>("valuePerHosp");
  const [query, setQuery] = useState("");
  const wardSort = useSort<WardKey>();
  const codeSort = useSort<CodeKey>();

  const years = useMemo(() => summaryYears(dataset), [dataset]);
  const allYears = useMemo(() => fullYears(dataset), [dataset]);
  const reportYear = latestSummaryYear(dataset);
  const reportRows = useMemo(() => (reportYear === null ? [] : buildWardRows(dataset, [reportYear])), [dataset, reportYear]);
  const average = hospitalValuePerHosp(reportRows);
  const wardSeries = useMemo(() => buildWardYearSeries(dataset), [dataset]);
  const wardNames = useMemo(() => dataset.wards.map((item) => item.name), [dataset]);
  const trendMax = useMemo(() => Math.max(1, ...wardSeries.flat().flatMap((point) => [
    point.valuePerHosp ?? 0,
    point.hospitalValuePerHosp ?? 0,
  ])), [wardSeries]);
  const tableWards = useMemo(() => buildWardRows(dataset, years), [dataset, years]);
  const codes = useMemo(() => buildHospitalCodeRows(dataset, years, ward), [dataset, years, ward]);
  const chartCodes = useMemo(
    () => (codeMetric === "value" ? codes : lowestValuePerHosp(codes, MIN_HOSPITALIZATIONS)),
    [codes, codeMetric],
  );
  const series = useMemo(() => buildYearSeries(dataset, selectedCode, ward), [dataset, selectedCode, ward]);
  const income = useMemo(() => buildIncomeSeries(dataset), [dataset]);
  const incomeYear = income.length ? income[income.length - 1] : null;
  const composition = useMemo(
    () => (incomeYear ? agreementComposition(dataset, incomeYear.year) : []),
    [dataset, incomeYear],
  );

  const below = reportRows
    .filter((row) => average !== null && row.valuePerHosp !== null && row.valuePerHosp < average)
    .sort((left, right) => left.valuePerHosp! - right.valuePerHosp!);
  const above = reportRows
    .filter((row) => average !== null && row.valuePerHosp !== null && row.valuePerHosp >= average)
    .sort((left, right) => right.valuePerHosp! - left.valuePerHosp!);
  const period = formatYearRange(years);
  const wardName = ward === null ? null : dataset.wards[ward].name;
  const selectedRow = selectedCode === null ? null : codes.find((row) => row.code === selectedCode);

  const sortedWards = wardSort.sort
    ? sortTableRows(tableWards, wardSort.sort.direction, (row: WardRow) => {
      const key = wardSort.sort!.key;
      return key === "name" ? row.name : orLast(row[key]);
    })
    : tableWards;
  const needle = query.trim().toLocaleLowerCase("pl-PL");
  const filteredCodes = needle
    ? codes.filter((row) => `${row.code} ${row.name}`.toLocaleLowerCase("pl-PL").includes(needle))
    : codes;
  const sortedCodes = codeSort.sort
    ? sortTableRows(filteredCodes, codeSort.sort.direction, (row) => {
      const key = codeSort.sort!.key;
      return key === "code" || key === "name" ? row[key] : orLast(row[key]);
    })
    : filteredCodes;

  const pickWard = (index: number | null) => {
    setWard(index);
    setSelectedCode(null);
  };
  const pickCode = useCallback((code: string) => setSelectedCode((current) => (current === code ? null : code)), []);

  return (
    <>
      <FinanceNote dataset={dataset} />

      {dataset.agreements && incomeYear && (
        <section className={styles.card} aria-labelledby="hospital-income-title">
          <div>
            <h2 id="hospital-income-title">Skąd przychód szpitala</h2>
            <p className={styles.cardNote}>
              Przychody i koszty pochodzą ze sprawozdań finansowych (KRS, odczyt z BizRaport). Różnica między liniami to
              strata roczna. Umowy z NFZ to kwoty umów po aneksach, nie ostateczne wypłaty. Wartość JGP to świadczenia
              wykazane w rozliczeniach hospitalizacji.
            </p>
          </div>
          <IncomeLineChart points={income} />
          <div>
            <h3 className={styles.subTitle}>Umowy z NFZ w {incomeYear.year} wg rodzaju</h3>
            <p className={styles.cardNote}>
              Niebieskie: hospitalizacje rozliczane kodami JGP. Szare: pozostałe świadczenia
              (SOR, poradnie, psychiatria i inne), których nie ma w wartości JGP.
            </p>
            <AgreementCompositionChart items={composition} />
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="hospital-lines-title">
        <div>
          <h2 id="hospital-lines-title">Wartość świadczeń oddziałów, {formatYearRange(allYears)}</h2>
          <p className={styles.cardNote}>Wartość rozliczona z NFZ w każdym roku. Na końcu linii: wartość w ostatnim roku.</p>
        </div>
        <WardValueLineChart series={wardSeries} names={wardNames} />
      </section>

      {reportYear !== null && (
        <section className={styles.card} aria-labelledby="hospital-hosp-title">
          <div>
            <h2 id="hospital-hosp-title">Wartość na hospitalizację w {reportYear}</h2>
            <p className={styles.cardNote}>
              Wartość rozliczona oddziału podzielona przez liczbę hospitalizacji (przy „&lt;5” = 1).
              <span className={styles.legendItem}><i style={{ background: ABOVE_COLOR }} /> powyżej średniej szpitala</span>
              <span className={styles.legendItem}><i style={{ background: BELOW_COLOR }} /> poniżej średniej</span>
            </p>
          </div>
          <div className={styles.split}>
            <WardPerHospChart rows={reportRows} average={average} />
            <div className={styles.verdicts}>
              <div>
                <h3 className={styles.belowTitle}>Nisko wyceniona praca</h3>
                <ul>
                  {below.map((row) => (
                    <li key={row.index}>
                      {row.name}: {formatThousands(row.valuePerHosp)}
                      {row.longStayShare !== null && <span className={styles.cardNote}> · pobyty 6+ dni: {formatShare(row.longStayShare)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.aboveTitle}>Wysoko wyceniona praca</h3>
                <ul>
                  {above.map((row) => (
                    <li key={row.index}>
                      {row.name}: {formatThousands(row.valuePerHosp)}
                      {row.longStayShare !== null && <span className={styles.cardNote}> · pobyty 6+ dni: {formatShare(row.longStayShare)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="hospital-trends-title">
        <div>
          <h2 id="hospital-trends-title">Wartość na hospitalizację w czasie, {period}</h2>
          <p className={styles.cardNote}>
            Słupki: oddział. Linia przerywana: średnia szpitala w danym roku. Wszystkie wykresy mają tę samą skalę.
            Kliknij oddział, aby zobaczyć jego kody JGP.
          </p>
        </div>
        <div className={styles.wardGrid}>
          {dataset.wards.map((item, index) => {
            const latest = reportRows.find((row) => row.index === index);
            const isAbove = latest?.valuePerHosp != null && average !== null && latest.valuePerHosp >= average;
            return (
              <button
                key={item.name}
                type="button"
                className={`${styles.wardCard} ${ward === index ? styles.wardCardOn : ""}`}
                onClick={() => pickWard(ward === index ? null : index)}
                aria-pressed={ward === index}
              >
                <span className={styles.wardHead}>
                  <strong>{item.name}</strong>
                  {latest?.valuePerHosp != null && (
                    <span className={isAbove ? styles.badgeAbove : styles.badgeBelow}>
                      {isAbove ? "powyżej średniej" : "poniżej średniej"}
                    </span>
                  )}
                </span>
                <span className={styles.cardNote}>
                  {reportYear}: {formatThousands(latest?.valuePerHosp ?? null)} na hospitalizację
                </span>
                <WardPerHospTrend points={wardSeries[index]} color={WARD_COLORS[index % WARD_COLORS.length]} yMax={trendMax} />
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="hospital-codes-title">
        <div>
          <h2 id="hospital-codes-title">Kody JGP, {period}{wardName ? ` · ${wardName}` : ""}</h2>
          <p className={styles.cardNote}>
            {codeMetric === "valuePerHosp"
              ? `Najniższa wartość na hospitalizację, kody z co najmniej ${MIN_HOSPITALIZATIONS} hospitalizacjami.`
              : "Kody o największej wartości rozliczonej."}{" "}
            Kliknij słupek, aby zobaczyć, jak kod zmieniał się w czasie.
          </p>
        </div>
        <div className={styles.filters}>
          <label htmlFor="hospital-ward">
            Oddział
            <select
              id="hospital-ward"
              className={styles.control}
              value={ward ?? ""}
              onChange={(event) => pickWard(event.target.value === "" ? null : Number(event.target.value))}
            >
              <option value="">Cały szpital</option>
              {dataset.wards.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Sortowanie kodów">
            <button
              type="button"
              className={codeMetric === "valuePerHosp" ? "active" : ""}
              aria-pressed={codeMetric === "valuePerHosp"}
              onClick={() => setCodeMetric("valuePerHosp")}
            >
              Najniżej wycenione
            </button>
            <button
              type="button"
              className={codeMetric === "value" ? "active" : ""}
              aria-pressed={codeMetric === "value"}
              onClick={() => setCodeMetric("value")}
            >
              Największa wartość
            </button>
          </div>
        </div>
        <CodesChart rows={chartCodes} metric={codeMetric} selected={selectedCode} onPick={pickCode} />
        <div>
          <h3 className={styles.subTitle}>
            {selectedRow ? `${selectedRow.code} – ${selectedRow.name}` : `Wszystkie kody${wardName ? ` · ${wardName}` : ""}`}
          </h3>
          <div className={styles.charts}>
            <SanokYearChart title="Wartość rozliczona [zł]" points={series} metric="value" />
            <SanokYearChart title="Pacjenci" points={series} metric="patients" />
          </div>
        </div>
      </section>

      <details className={styles.card}>
        <summary className={styles.detailsSummary}>Tabele szczegółowe ({period})</summary>

        <h3 className={styles.subTitle}>Oddziały</h3>
        <p className={styles.cardNote}>Kliknij wiersz, aby filtrować kody.</p>
        <div className={styles.tableBox}>
          <table className={styles.table}>
            <thead>
              <tr className={`${styles.columnRow} ${styles.singleHeader}`}>
                {wardSort.header("Oddział", "name")}
                {wardSort.header("Pacjenci", "patients")}
                {wardSort.header("Hospitalizacje (<5 = 1)", "hospCount")}
                {wardSort.header("Wartość", "value")}
                <th className={styles.num}>Udział</th>
                {wardSort.header("Wartość na hospitalizację", "valuePerHosp")}
                {wardSort.header("Pobyty 6+ dni", "longStayShare")}
              </tr>
            </thead>
            <tbody>
              {sortedWards.map((row) => (
                <tr
                  key={row.index}
                  className={row.index === ward ? styles.selected : ""}
                  aria-selected={row.index === ward}
                  onClick={() => pickWard(row.index === ward ? null : row.index)}
                >
                  <td>{row.name}</td>
                  <td className={styles.num}>{formatCount(row.patients)}</td>
                  <td className={styles.num}>{formatCount(row.hospCount)}</td>
                  <td className={`${styles.num} ${styles.nowrap}`}>{formatPln(row.value)}</td>
                  <td className={styles.num}>{formatShare(row.valueShare)}</td>
                  <td className={`${styles.num} ${styles.nowrap}`}>{formatPln(row.valuePerHosp)}</td>
                  <td className={styles.num}>{formatShare(row.longStayShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.subTitle}>Kody JGP{wardName ? ` · ${wardName}` : ""}</h3>
        <div className={styles.filters}>
          <label htmlFor="hospital-search">
            Szukaj kodu lub nazwy
            <input
              id="hospital-search"
              className={styles.control}
              type="search"
              value={query}
              placeholder="np. H52 lub kręgosłup"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span className={styles.cardNote}>{formatCount(sortedCodes.length)} kodów</span>
        </div>
        <div className={styles.tableBox}>
          <table className={styles.table}>
            <thead>
              <tr className={`${styles.columnRow} ${styles.singleHeader}`}>
                {codeSort.header("Kod", "code")}
                {codeSort.header("Nazwa", "name")}
                <th>Oddziały</th>
                {codeSort.header("Pacjenci", "patients")}
                {codeSort.header("Hospitalizacje (<5 = 1)", "hospCount")}
                {codeSort.header("Wartość", "value")}
                {codeSort.header("Wartość na hospitalizację", "valuePerHosp")}
                {codeSort.header("Pobyty 6+ dni", "longStayShare")}
              </tr>
            </thead>
            <tbody>
              {sortedCodes.map((row) => (
                <tr
                  key={row.code}
                  className={row.code === selectedCode ? styles.selected : ""}
                  aria-selected={row.code === selectedCode}
                  onClick={() => pickCode(row.code)}
                >
                  <td className={styles.code}>{row.code}</td>
                  <td className={styles.name} title={row.name}>{row.name}</td>
                  <td className={styles.departments} title={wardsLabel(row)}>{wardsLabel(row)}</td>
                  <td className={styles.num}>{formatCount(row.patients)}</td>
                  <td className={styles.num}>{formatCount(row.hospCount)}</td>
                  <td className={`${styles.num} ${styles.nowrap}`}>{formatPln(row.value)}</td>
                  <td className={`${styles.num} ${styles.nowrap}`}>{formatPln(row.valuePerHosp)}</td>
                  <td className={styles.num}>{formatShare(row.longStayShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function SanokHospitalPage() {
  const [dataset, setDataset] = useState<SanokHospitalDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSanokHospitalDataset()
      .then((data) => { if (!cancelled) setDataset(data); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Nie udało się wczytać danych.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.page}>
      <nav className={styles.links} aria-label="Nawigacja">
        <Link className={styles.back} href="/">← Hospitalizacje w Polsce</Link>
        <Link className={styles.back} href="/sanok-kody-e">Kody E: SP ZOZ i PCISN →</Link>
      </nav>
      <header className={styles.header}>
        <h1>SP ZOZ w Sanoku: oddziały i wartość świadczeń</h1>
        <p>
          Samodzielny Publiczny Zespół Opieki Zdrowotnej w Sanoku (NIP 6871640438, kod NFZ 09R/010019).
          Jak zmieniała się wartość świadczeń rozliczonych z NFZ i gdzie procedury są nisko wycenione.
        </p>
        <p className={styles.note}>
          Źródła: NFZ – zestawienie rozliczeń świadczeń i dane o hospitalizacjach; sprawozdanie finansowe (KRS) – wynik
          szpitala; API NFZ „Umowy” – kwoty umów. Pokazujemy tylko pełne lata. NFZ podaje „&lt;5” dla małych grup;
          liczymy je jako 1, więc liczba hospitalizacji jest dolną granicą, a wartość na hospitalizację – górną.
        </p>
      </header>

      {error && <p className={styles.state} role="alert">{error}</p>}
      {!error && !dataset && <p className={styles.state}>Ładowanie danych…</p>}
      {dataset && <SanokHospitalView dataset={dataset} />}
    </main>
  );
}
