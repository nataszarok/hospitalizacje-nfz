"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { FACILITY_COLORS, SanokTrendChart } from "@/components/sanok/SanokTrendChart";
import {
  ALL_CODES,
  buildCodeRows,
  buildQuarterSeries,
  buildTotalRow,
  formatCount,
  formatShare,
  listQuarters,
  loadSanokDataset,
  type SanokCodeRow,
  type SanokDataset,
} from "@/lib/sanokCodes";
import { nextSortState, sortTableRows, type SortState } from "@/lib/tableSort";
import styles from "./SanokCodesPage.module.css";

type SortKey = "code" | "name" | "count0" | "count1" | "share0" | "share1";

function sortValue(row: SanokCodeRow, key: SortKey): string | number {
  switch (key) {
    case "code": return row.code;
    case "name": return row.name;
    case "count0": return row.counts[0];
    case "count1": return row.counts[1];
    // Brak danych (–) ląduje na końcu przy sortowaniu malejącym.
    case "share0": return row.longStayShares[0] ?? -1;
    case "share1": return row.longStayShares[1] ?? -1;
  }
}

function higherShareClass(row: SanokCodeRow, index: number): string {
  const [left, right] = row.longStayShares;
  if (left == null || right == null || left === right) return "";
  const own = index === 0 ? left : right;
  return own === Math.max(left, right) ? styles.higher : "";
}

export function SanokCodesView({ dataset }: { dataset: SanokDataset }) {
  const [sort, setSort] = useState<SortState<SortKey>>(null);
  const [selected, setSelected] = useState(ALL_CODES);

  const total = useMemo(() => buildTotalRow(dataset), [dataset]);
  const rows = useMemo(() => buildCodeRows(dataset), [dataset]);
  const sortedRows = useMemo(
    () => (sort ? sortTableRows(rows, sort.direction, (row) => sortValue(row, sort.key)) : rows),
    [rows, sort],
  );
  const series = useMemo(() => buildQuarterSeries(dataset, selected), [dataset, selected]);
  const facilityNames = useMemo(() => dataset.facilities.map((facility) => facility.name), [dataset]);
  const quarters = listQuarters(dataset);
  const selectedRow = selected === ALL_CODES ? total : rows.find((row) => row.code === selected);

  const header = (label: string, key: SortKey) => (
    <SortableTableHeader
      label={label}
      active={sort?.key === key}
      direction={sort?.key === key ? sort.direction : undefined}
      onSort={() => setSort((current) => nextSortState(current, key))}
    />
  );

  const renderRow = (row: SanokCodeRow, isTotal = false) => (
    <tr
      key={row.code}
      className={[isTotal ? styles.total : "", row.code === selected ? styles.selected : ""].join(" ").trim()}
      onClick={() => setSelected(row.code)}
      aria-selected={row.code === selected}
    >
      <td className={styles.code}>{isTotal ? "" : row.code}</td>
      <td className={styles.name} title={row.name}>{row.name}</td>
      <td className={styles.num}>{formatCount(row.counts[0])}</td>
      <td className={styles.num}>{formatCount(row.counts[1])}</td>
      <td className={`${styles.num} ${higherShareClass(row, 0)}`}>{formatShare(row.longStayShares[0])}</td>
      <td className={`${styles.num} ${higherShareClass(row, 1)}`}>{formatShare(row.longStayShares[1])}</td>
    </tr>
  );

  return (
    <>
      <section className={styles.card} aria-labelledby="sanok-table-title">
        <div>
          <h2 id="sanok-table-title">Kody E: liczba hospitalizacji i pobyty 6+ dni</h2>
          <p className={styles.cardNote}>
            Kliknij nagłówek, aby posortować. Kliknij wiersz, aby zobaczyć wykres tego kodu.
            Wyższy udział pobytów 6+ dni jest wyróżniony.
          </p>
        </div>
        <div className={styles.tableBox}>
          <table className={`${styles.table} ${styles.fixedColumns}`}>
            <thead>
              <tr className={styles.groupRow}>
                <th colSpan={2} />
                <th colSpan={2} className={styles.group}>Hospitalizacje</th>
                <th colSpan={2} className={styles.group}>Pobyty 6+ dni</th>
              </tr>
              <tr className={styles.columnRow}>
                {header("Kod", "code")}
                {header("Nazwa", "name")}
                {header(facilityNames[0], "count0")}
                {header(facilityNames[1], "count1")}
                {header(facilityNames[0], "share0")}
                {header(facilityNames[1], "share1")}
              </tr>
            </thead>
            <tbody>
              {renderRow(total, true)}
              {sortedRows.map((row) => renderRow(row))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="sanok-chart-title">
        <div>
          <h2 id="sanok-chart-title">
            {selectedRow && selected !== ALL_CODES ? `${selectedRow.code} – ${selectedRow.name}` : "Wszystkie kody E"}
          </h2>
          <p className={styles.cardNote}>
            Dane kwartalne od {quarters.length ? quarters[0].slice(0, 4) : "–"} do {quarters.length ? quarters[quarters.length - 1].slice(0, 4) : "–"} r.
          </p>
        </div>
        <div className={styles.charts}>
          <SanokTrendChart title="Hospitalizacje na kwartał" series={series} facilityNames={facilityNames} metric="count" />
          <SanokTrendChart title="Udział pobytów 6+ dni" series={series} facilityNames={facilityNames} metric="longStayShare" />
        </div>
      </section>
    </>
  );
}

export function SanokCodesPage() {
  const [dataset, setDataset] = useState<SanokDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSanokDataset()
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
        <Link className={styles.back} href="/sanok-szpital">SP ZOZ w Sanoku: wszystkie kody JGP →</Link>
      </nav>
      <header className={styles.header}>
        <h1>Kody E w Sanoku</h1>
        <p>Porównanie dwóch placówek pod jednym adresem (ul. 800-lecia 26):</p>
        {dataset && (
          <ul className={styles.facilities}>
            {dataset.facilities.map((facility, index) => (
              <li key={facility.key}>
                <span className={styles.swatch} style={{ background: FACILITY_COLORS[index] }} aria-hidden="true" />
                <strong>{facility.name}</strong> – {facility.description} (NIP {facility.nip})
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>
          Źródło: NFZ, dane o hospitalizacjach. NFZ podaje „&lt;5” dla małych grup. Liczymy je jako 1,
          więc liczby to dolna granica.
        </p>
      </header>

      {error && <p className={styles.state} role="alert">{error}</p>}
      {!error && !dataset && <p className={styles.state}>Ładowanie danych…</p>}
      {dataset && <SanokCodesView dataset={dataset} />}
    </main>
  );
}
