"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { availabilityLabel, biggestChanges, inCatalogYear, type JgpCatalog as Catalog, type JgpCatalogRow } from "@/lib/jgpCatalog";
import {
  DEFAULT_CATALOG_STATE, MIN_LATEST_OPTIONS, defaultSortDesc, hasActiveFilters, jgpCatalogUrlSearch, readJgpCatalogUrlState,
  type CatalogKind, type CatalogSortKey, type JgpCatalogUrlState,
} from "@/lib/jgpCatalogUrlState";
import { formatPln } from "@/lib/formatters";
import { tokenize } from "@/lib/search";
import styles from "./JgpCatalog.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedPct = (value: number) => `${value > 0 ? "+" : ""}${decimal(value)}%`;
const signedIntegerPct = (value: number) => `${value > 0 ? "+" : ""}${integer(value)}%`;
const PAGE = 50;

const CHANGE_MIN_PREVIOUS = 1000;

/**
 * Mini-wykres miesięcy: skala wiersza od minimum do maksimum (kształt, nie wielkość).
 * Oś obejmuje cały okres; linia tylko w miesiącach, gdy kod istniał (`null` = przerwa).
 */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const width = 120;
  const height = 26;
  const present = values.filter((value): value is number => value !== null);
  const low = present.length ? Math.min(...present) : 0;
  const high = present.length ? Math.max(...present) : 0;
  const range = high - low || 1;
  const segments: string[][] = [];
  values.forEach((value, i) => {
    if (value === null) return;
    if (i === 0 || values[i - 1] === null) segments.push([]);
    segments.at(-1)!.push(`${((i * width) / Math.max(values.length - 1, 1)).toFixed(1)} ${(height - 3 - ((value - low) / range) * (height - 6)).toFixed(1)}`);
  });
  // Pojedynczy miesiąc rysujemy jako krótką kreskę, żeby był widoczny.
  const d = segments.map((points) => (points.length > 1 ? `M${points.join(" L")}` : `M${points[0]} h0.01`)).join(" ");
  return <svg className={styles.spark} viewBox={`0 0 ${width} ${height}`} aria-hidden>
    {d ? <path d={d} /> : null}
  </svg>;
}

function matches(row: JgpCatalogRow, tokens: string[]) {
  if (!tokens.length) return true;
  const words = [row.code.toLowerCase(), ...tokenize(row.name)];
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

// Strona jest statyczna, więc stan filtrów odczytujemy i zapisujemy w adresie w przeglądarce.
function useCatalogState() {
  const [state, setState] = useState<JgpCatalogUrlState>(DEFAULT_CATALOG_STATE);
  useEffect(() => {
    const read = () => setState(readJgpCatalogUrlState(window.location.search));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  // Adres zmieniamy tylko po akcji użytkownika — efekt przy wejściu nie może nadpisać parametrów z linku.
  const write = useCallback((next: JgpCatalogUrlState) => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${jgpCatalogUrlSearch(next)}${window.location.hash}`);
    setState(next);
  }, []);
  return [state, write] as const;
}

/** Katalog grup JGP: wyszukiwanie, filtry, sortowanie i listy największych zmian r/r. */
export function JgpCatalogView({ catalog }: { catalog: Catalog }) {
  const [state, write] = useCatalogState();
  const { query, kind, minLatest, showDiscontinued, sort } = state;
  const [limit, setLimit] = useState(PAGE);
  const update = (patch: Partial<JgpCatalogUrlState>) => { write({ ...state, ...patch }); setLimit(PAGE); };
  const changes = useMemo(() => biggestChanges(catalog.rows, CHANGE_MIN_PREVIOUS), [catalog.rows]);
  const value = catalog.settlements;

  const rows = useMemo(() => {
    const tokens = tokenize(query);
    const filtered = catalog.rows.filter((row) => matches(row, tokens)
      && (kind === "all" || (kind === "procedural") === row.procedural)
      && row.latest >= minLatest
      && (showDiscontinued || !row.discontinued));
    const value = (row: JgpCatalogRow) => sort.key === "change" ? row.changePct ?? -Infinity
      : sort.key === "mortality" ? row.mortalityPct
      : sort.key === "value" ? row.valuePln ?? -Infinity
      : sort.key === "valueChange" ? row.valueChangePct ?? -Infinity
      : sort.key === "code" ? 0
      : row.latest;
    // Grupy wycofane nie mają danych w najnowszym roku, więc przy sortowaniu po liczbach idą na górę
    // (od największej liczby hospitalizacji w roku wycofania) — inaczej znikałyby na końcu listy.
    const byDiscontinued = (a: JgpCatalogRow, b: JgpCatalogRow) => sort.key === "code" ? 0
      : Number(b.discontinued) - Number(a.discontinued) || (a.discontinued ? b.lastYearTotal - a.lastYearTotal : 0);
    return [...filtered].sort((a, b) => sort.key === "code"
      ? a.code.localeCompare(b.code) * (sort.desc ? -1 : 1)
      : byDiscontinued(a, b) || (value(b) - value(a)) * (sort.desc ? 1 : -1) || a.code.localeCompare(b.code));
  }, [catalog.rows, query, kind, minLatest, showDiscontinued, sort]);

  const header = (key: CatalogSortKey, label: ReactNode, numeric = true, title?: string) => <th className={numeric ? styles.num : undefined} title={title} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
    <button type="button" className={styles.sortButton} onClick={() => update({ sort: { key, desc: sort.key === key ? !sort.desc : defaultSortDesc(key) } })}>
      {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </button>
  </th>;
  // „—”: grupy nie było w katalogu w danym roku; 0: grupa była, ale bez hospitalizacji.
  const count = (row: JgpCatalogRow, year: string | null, value: number) => inCatalogYear(row, year) ? integer(value) : "—";

  return <>
    <div className={styles.tabs} role="tablist" aria-label="Katalog">
      <span className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">Grupy <small>{integer(catalog.totals.all)}</small></span>
      <span className={`${styles.tab} ${styles.tabSoon}`} role="tab" aria-selected="false" aria-disabled="true">Rodziny <small>wkrótce</small></span>
    </div>

    <div className={styles.filters}>
      <label className={styles.search}>
        <span className={styles.label}>Szukaj</span>
        <input type="search" value={query} placeholder="Kod albo nazwa grupy, np. E10, zaćma, poród" onChange={(event) => update({ query: event.target.value })} />
      </label>
      <label>
        <span className={styles.label}>Rodzaj</span>
        <select value={kind} onChange={(event) => update({ kind: event.target.value as CatalogKind })}>
          <option value="all">wszystkie</option>
          <option value="procedural">zabiegowe</option>
          <option value="conservative">zachowawcze</option>
        </select>
      </label>
      <label>
        <span className={styles.label}>Min. hospitalizacji ({catalog.latestYear})</span>
        <select value={minLatest} onChange={(event) => update({ minLatest: Number(event.target.value) })}>
          {MIN_LATEST_OPTIONS.map((value) => <option key={value} value={value}>{integer(value)}</option>)}
        </select>
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={showDiscontinued} onChange={(event) => update({ showDiscontinued: event.target.checked })} />
        <span>Pokaż grupy wycofane ({catalog.totals.discontinued})</span>
      </label>
      <button type="button" className={styles.clear} disabled={!hasActiveFilters(state)} onClick={() => update({ ...DEFAULT_CATALOG_STATE, sort })}>Wyczyść filtry</button>
    </div>

    <section className={styles.card} aria-label="Grupy JGP">
      <div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.titleRow}>
              <th colSpan={(catalog.previousYear ? 7 : 6) + (value ? 2 : 0)}>
                <span className={styles.tableTitle}>Grupy JGP</span>
                <span className={styles.tableCount}>{integer(rows.length)} z {integer(catalog.totals.all)}</span>
              </th>
            </tr>
            <tr>
              {header("code", "Kod", false)}
              <th>Nazwa</th>
              <th>Miesięcznie {catalog.years[0]}–{catalog.latestYear}</th>
              {catalog.previousYear ? <th className={styles.num}>{catalog.previousYear}</th> : null}
              {header("latest", catalog.latestYear)}
              {header("change", "r/r")}
              {header("mortality", "Śmiertelność")}
              {value ? header("value", <>Rozliczenia<br />NFZ {value.year}</>, true, `Wartość świadczeń rozliczonych przez NFZ w ${value.year} r.`) : null}
              {value ? header("valueChange", <>Zmiana<br />od {value.firstYear}</>, true, `Zmiana wartości rozliczeń NFZ ${value.firstYear}–${value.year}`) : null}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => { const availability = availabilityLabel(row.ranges, catalog.years); return <tr key={row.code}>
              <td className={styles.code}><Link href={`/jgp/${encodeURIComponent(row.code)}`}>{row.code}</Link></td>
              <td className={styles.name}>
                <Link href={`/jgp/${encodeURIComponent(row.code)}`}>{row.name}</Link>
                {availability ? <span className={`${styles.badge} ${row.discontinued ? styles.badgeArchived : ""}`} title={row.discontinued ? "Grupa wycofana z katalogu" : "Lata, w których grupa jest w katalogu"}>{availability}</span> : null}
                <span className={styles.kind}>{row.procedural ? "zabiegowa" : "zachowawcza"}</span>
              </td>
              <td><Sparkline values={row.series} /></td>
              {catalog.previousYear ? <td className={styles.num}>{count(row, catalog.previousYear, row.previous)}</td> : null}
              <td className={styles.num}>{count(row, catalog.latestYear, row.latest)}</td>
              <td className={`${styles.num} ${row.changePct !== null && row.changePct < 0 ? styles.down : ""}`}>{row.changePct === null ? "—" : signedPct(row.changePct)}</td>
              <td className={styles.num}>{row.latest ? `${decimal(row.mortalityPct)}%` : "—"}</td>
              {value ? <td className={styles.num}>{row.valuePln === null ? "—" : formatPln(row.valuePln)}</td> : null}
              {value ? <td className={`${styles.num} ${row.valueChangePct !== null && row.valueChangePct < 0 ? styles.down : ""}`}>{row.valueChangePct === null ? "—" : signedIntegerPct(row.valueChangePct)}</td> : null}
            </tr>; })}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <span>Wyświetlono {integer(Math.min(limit, rows.length))} z {integer(rows.length)} {hasActiveFilters(state) ? "pasujących " : ""}grup</span>
        {rows.length > limit ? <button type="button" onClick={() => setLimit((current) => current + PAGE)}>Pokaż kolejne {Math.min(PAGE, rows.length - limit)}</button> : null}
      </div>
      {!rows.length ? <p className={styles.empty}>Brak grup dla tych filtrów.</p> : null}
    </section>

    {catalog.previousYear ? <div className={styles.changes}>
      <ChangeList title={`Największe wzrosty ${catalog.previousYear} → ${catalog.latestYear}`} rows={changes.up} />
      <ChangeList title={`Największe spadki ${catalog.previousYear} → ${catalog.latestYear}`} rows={changes.down} />
      <p className={styles.changesNote}>Grupy aktywne w obu latach, z co najmniej {integer(CHANGE_MIN_PREVIOUS)} hospitalizacji w {catalog.previousYear} r. Duża zmiana często wynika ze zmiany katalogu JGP, a nie z liczby pacjentów.</p>
    </div> : null}
    <p className={styles.note}>
      Mini-wykres: skala każdego wiersza od jego minimum do maksimum (kształt, nie wielkość); przerwa — grupy nie było w katalogu.
      „—” w kolumnach lat: grupy nie było w katalogu w tym roku; 0: grupa była w katalogu, ale bez hospitalizacji.
      Hospitalizacje metodą konserwatywną (wartości &lt;5 liczone jako 1).
      {value ? <> Rozliczenia NFZ: wartość świadczeń rozliczonych w grupie (zestawienie NFZ od {value.firstYear} r.); „—”: brak kwot w tym roku.</> : null}
    </p>
  </>;
}

function ChangeList({ title, rows }: { title: string; rows: JgpCatalogRow[] }) {
  return <section className={styles.changeCard} aria-label={title}>
    <h2>{title}</h2>
    <ol>
      {rows.map((row) => <li key={row.code}>
        <Link className={styles.code} href={`/jgp/${encodeURIComponent(row.code)}`}>{row.code}</Link>
        <span className={styles.changeName}>{row.name}</span>
        <b className={row.changePct !== null && row.changePct < 0 ? styles.down : styles.up}>{row.changePct === null ? "—" : signedPct(row.changePct)}</b>
      </li>)}
    </ol>
  </section>;
}
