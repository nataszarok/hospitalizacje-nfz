"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { biggestChanges, type JgpCatalog as Catalog, type JgpCatalogRow } from "@/lib/jgpCatalog";
import { tokenize } from "@/lib/search";
import styles from "./JgpCatalog.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedPct = (value: number) => `${value > 0 ? "+" : ""}${decimal(value)}%`;
const millions = (value: number) => `${(value / 1_000_000).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mln`;
const PAGE = 50;

type SortKey = "latest" | "change" | "mortality" | "code";
type Kind = "all" | "procedural" | "conservative";

/** Mini-wykres miesięcy: skala wiersza od minimum do maksimum (kształt, nie wielkość). */
function Sparkline({ values }: { values: number[] }) {
  const width = 120;
  const height = 26;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  const points = values.map((value, i) => `${((i * width) / Math.max(values.length - 1, 1)).toFixed(1)} ${(height - 3 - ((value - low) / range) * (height - 6)).toFixed(1)}`);
  return <svg className={styles.spark} viewBox={`0 0 ${width} ${height}`} aria-hidden>
    {values.length > 12 ? <line className={styles.sparkYear} x1={width / 2} x2={width / 2} y1={0} y2={height} /> : null}
    <path d={`M${points.join(" L")}`} />
  </svg>;
}

function matches(row: JgpCatalogRow, tokens: string[]) {
  if (!tokens.length) return true;
  const words = [row.code.toLowerCase(), ...tokenize(row.name)];
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

/** Katalog grup JGP: wyszukiwanie, filtry, sortowanie i listy największych zmian r/r. */
export function JgpCatalogView({ catalog }: { catalog: Catalog }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [minLatest, setMinLatest] = useState(0);
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "latest", desc: true });
  const [limit, setLimit] = useState(PAGE);
  const changes = useMemo(() => biggestChanges(catalog.rows), [catalog.rows]);

  const rows = useMemo(() => {
    const tokens = tokenize(query);
    const filtered = catalog.rows.filter((row) => matches(row, tokens)
      && (kind === "all" || (kind === "procedural") === row.procedural)
      && row.latest >= minLatest
      && (showDiscontinued || !row.discontinued));
    const value = (row: JgpCatalogRow) => sort.key === "change" ? row.changePct ?? -Infinity
      : sort.key === "mortality" ? row.mortalityPct
      : sort.key === "code" ? 0
      : row.latest;
    return [...filtered].sort((a, b) => sort.key === "code"
      ? a.code.localeCompare(b.code) * (sort.desc ? -1 : 1)
      : (value(b) - value(a)) * (sort.desc ? 1 : -1) || a.code.localeCompare(b.code));
  }, [catalog.rows, query, kind, minLatest, showDiscontinued, sort]);

  const header = (key: SortKey, label: string, numeric = true) => <th className={numeric ? styles.num : undefined} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
    <button type="button" className={styles.sortButton} onClick={() => { setSort((current) => ({ key, desc: current.key === key ? !current.desc : key !== "code" })); setLimit(PAGE); }}>
      {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </button>
  </th>;

  return <>
    <div className={styles.tabs} role="tablist" aria-label="Katalog">
      <span className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">Grupy <small>{integer(catalog.totals.groups)}</small></span>
      <span className={`${styles.tab} ${styles.tabSoon}`} role="tab" aria-selected="false" aria-disabled="true">Rodziny <small>wkrótce</small></span>
    </div>

    <dl className={styles.kpis}>
      <div><dt>Grupy w {catalog.latestYear} r.</dt><dd>{integer(catalog.totals.groups)}</dd></div>
      <div><dt>Hospitalizacje {catalog.latestYear}</dt><dd>{millions(catalog.totals.latest)}</dd>{catalog.previousYear ? <span>{catalog.previousYear}: {millions(catalog.totals.previous)}</span> : null}</div>
      <div><dt>Nowe / wycofane grupy</dt><dd>{catalog.totals.added} / {catalog.totals.discontinued}</dd><span>nowe w {catalog.latestYear} r. / bez danych w {catalog.latestYear} r.</span></div>
    </dl>

    <div className={styles.filters}>
      <label className={styles.search}>
        <span className={styles.label}>Szukaj</span>
        <input type="search" value={query} placeholder="Kod albo nazwa grupy, np. E10, zaćma, poród" onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }} />
      </label>
      <label>
        <span className={styles.label}>Rodzaj</span>
        <select value={kind} onChange={(event) => { setKind(event.target.value as Kind); setLimit(PAGE); }}>
          <option value="all">wszystkie</option>
          <option value="procedural">zabiegowe</option>
          <option value="conservative">zachowawcze</option>
        </select>
      </label>
      <label>
        <span className={styles.label}>Hospitalizacje {catalog.latestYear} od</span>
        <select value={minLatest} onChange={(event) => { setMinLatest(Number(event.target.value)); setLimit(PAGE); }}>
          <option value={0}>0</option>
          <option value={100}>100</option>
          <option value={1000}>1 000</option>
          <option value={10000}>10 000</option>
        </select>
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={showDiscontinued} onChange={(event) => { setShowDiscontinued(event.target.checked); setLimit(PAGE); }} />
        <span>pokaż grupy wycofane ({catalog.totals.discontinued})</span>
      </label>
    </div>

    <section className={styles.card} aria-label="Grupy JGP">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {header("code", "Kod", false)}
              <th>Nazwa</th>
              <th>Miesięcznie {catalog.years[0]}–{catalog.latestYear}</th>
              {catalog.previousYear ? <th className={styles.num}>{catalog.previousYear}</th> : null}
              {header("latest", catalog.latestYear)}
              {header("change", "r/r")}
              {header("mortality", "Śmiertelność")}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => <tr key={row.code}>
              <td className={styles.code}><Link href={`/jgp/${encodeURIComponent(row.code)}`}>{row.code}</Link></td>
              <td className={styles.name}>
                <Link href={`/jgp/${encodeURIComponent(row.code)}`}>{row.name}</Link>
                {row.discontinued ? <span className={styles.badge}>wycofana</span> : row.added ? <span className={styles.badge}>nowa</span> : null}
                <span className={styles.kind}>{row.procedural ? "zabiegowa" : "zachowawcza"}</span>
              </td>
              <td><Sparkline values={row.series} /></td>
              {catalog.previousYear ? <td className={styles.num}>{integer(row.previous)}</td> : null}
              <td className={styles.num}>{integer(row.latest)}</td>
              <td className={`${styles.num} ${row.changePct !== null && row.changePct < 0 ? styles.down : ""}`}>{row.changePct === null ? "—" : signedPct(row.changePct)}</td>
              <td className={styles.num}>{row.latest ? `${decimal(row.mortalityPct)}%` : "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <span>{integer(Math.min(limit, rows.length))} z {integer(rows.length)} grup</span>
        {rows.length > limit ? <button type="button" onClick={() => setLimit((current) => current + PAGE)}>Pokaż kolejne {Math.min(PAGE, rows.length - limit)}</button> : null}
      </div>
      {!rows.length ? <p className={styles.empty}>Brak grup dla tych filtrów.</p> : null}
    </section>

    <div className={styles.changes}>
      <ChangeList title="Największe wzrosty r/r" rows={changes.up} />
      <ChangeList title="Największe spadki r/r" rows={changes.down} />
    </div>
    <p className={styles.note}>
      Mini-wykres: skala każdego wiersza od jego minimum do maksimum (kształt, nie wielkość). Hospitalizacje metodą konserwatywną (wartości &lt;5 liczone jako 1).
      Listy zmian obejmują grupy z co najmniej 1 000 hospitalizacji w {catalog.previousYear ?? "poprzednim"} r.; duża zmiana często wynika ze zmiany katalogu JGP, nie z liczby pacjentów.
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
