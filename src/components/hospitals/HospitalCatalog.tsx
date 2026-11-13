"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkline } from "@/components/jgp/JgpCatalog";
import { HospitalCatalogMap } from "./HospitalCatalogMap";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { HelpLines, InfoTip } from "@/components/InfoTip";
import { HOSPITAL_EXPLORER_PATH } from "@/lib/dashboardNavigation";
import { formatCityName, formatPln } from "@/lib/formatters";
import { biggestHospitalChanges, type HospitalCatalog, type HospitalCatalogRow } from "@/lib/hospitalCatalog";
import {
  CATALOG_PHONE_QUERY, DEFAULT_HOSPITAL_CATALOG_STATE, HOSPITAL_MIN_OPTIONS, defaultHospitalSortDesc, hasActiveHospitalFilters, hospitalCatalogUrlSearch,
  legacyHospitalExplorerRedirect, readHospitalCatalogUrlState, type HospitalCatalogUrlState, type HospitalSortKey, type PszFilter,
} from "@/lib/hospitalCatalogUrlState";
import { HospitalLink } from "@/components/TableLinks";
import { tokenize } from "@/lib/search";
// Wygląd katalogu wspólny z katalogiem grup JGP (filtry, tabela, listy zmian).
import styles from "@/components/jgp/JgpCatalog.module.css";
import own from "./HospitalCatalog.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}%`;
const PAGE = 50;
const CHANGE_MIN_PREVIOUS = 1000;

/** Krótkie nazwy poziomów sieci na plakietce (pełna nazwa w podpowiedzi). */
const PSZ_SHORT: Record<string, string> = {
  "I stopnia": "I st.", "II stopnia": "II st.", "III stopnia": "III st.", "onkologiczny / pulmonologiczny": "onkol./pulmon.", pediatryczny: "pediatryczny", "ogólnopolski": "ogólnopolski",
};

function matches(row: HospitalCatalogRow, tokens: string[]) {
  if (!tokens.length) return true;
  const words = [row.nip, ...tokenize(row.name), ...tokenize(row.city)];
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

const pszMatches = (row: HospitalCatalogRow, filter: PszFilter) =>
  filter === "all" || (filter === "in" ? row.psz !== null : filter === "out" ? row.psz === null : row.psz === filter);

// Strona jest statyczna, więc stan filtrów odczytujemy i zapisujemy w adresie w przeglądarce (jak katalog JGP).
function useCatalogState() {
  const [state, setState] = useState<HospitalCatalogUrlState>(DEFAULT_HOSPITAL_CATALOG_STATE);
  useEffect(() => {
    // Dawne linki do profilu (`/szpitale?hospital=…`) prowadzą do porównania szpitali.
    const legacy = legacyHospitalExplorerRedirect(window.location.search, HOSPITAL_EXPLORER_PATH);
    if (legacy) {
      window.location.replace(`${legacy}${window.location.hash}`);
      return;
    }
    const read = () => setState(readHospitalCatalogUrlState(window.location.search));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const write = useCallback((next: HospitalCatalogUrlState) => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${hospitalCatalogUrlSearch(next)}${window.location.hash}`);
    setState(next);
  }, []);
  return [state, write] as const;
}

/** Plakietka sieci szpitali: poziom albo „poza siecią”. */
function PszBadge({ level, levels }: { level: number | null; levels: string[] }) {
  if (level === null) return <span className={`${own.psz} ${own.pszOut}`} title="Poza siecią szpitali (PSZ)">poza siecią</span>;
  const name = levels[level] ?? "";
  return <span className={own.psz} title={`Sieć szpitali (PSZ): ${name}`}>PSZ {PSZ_SHORT[name] ?? name}</span>;
}

/** Katalog szpitali: wyszukiwanie, filtry (województwo, sieć, próg), sortowanie i listy największych zmian r/r. */
export function HospitalCatalogView({ catalog }: { catalog: HospitalCatalog }) {
  const [state, write] = useCatalogState();
  const { view, query, region, city, psz, minLatest, sort } = state;
  // Bez wybranego widoku: mapa na komputerze, lista na telefonie. Który widok widać, rozstrzyga CSS (`autoMap` / `autoList`),
  // więc statyczna strona nie miga; szerokość okna z `matchMedia` służy tylko zakładkom (po hydracji).
  const phone = useMediaQuery(CATALOG_PHONE_QUERY);
  const shown = view ?? (phone === null ? null : phone ? "list" : "map");
  const showMap = view !== "list";
  const showList = view !== "map";
  const [limit, setLimit] = useState(PAGE);
  const update = (patch: Partial<HospitalCatalogUrlState>) => { write({ ...state, ...patch }); setLimit(PAGE); };
  const regionOptions = useMemo(() => Object.entries(catalog.regions).sort((a, b) => a[1].localeCompare(b[1], "pl")), [catalog.regions]);

  const filtered = useMemo(() => {
    const tokens = tokenize(query);
    // Wyszukiwanie po nazwie pokazuje też małych świadczeniodawców (próg dotyczy przeglądania listy).
    return catalog.rows.filter((row) => matches(row, tokens)
      && (tokens.length ? true : row.latest >= minLatest)
      && (!region || row.owNfz === region)
      && pszMatches(row, psz));
  }, [catalog.rows, query, region, psz, minLatest]);
  // Miasto (kropka na mapie) zawęża listę; mapa pokazuje wszystkie miasta po pozostałych filtrach.
  const listed = useMemo(() => city ? filtered.filter((row) => row.city === city) : filtered, [filtered, city]);
  const rows = useMemo(() => {
    const value = (row: HospitalCatalogRow) => sort.key === "change" ? row.changePct ?? -Infinity
      : sort.key === "mortality" ? row.mortalityPct ?? -Infinity
      : sort.key === "beds" ? row.beds ?? -Infinity
      : sort.key === "net" ? row.net?.value ?? -Infinity
      : row.latest;
    return [...listed].sort((a, b) => sort.key === "name"
      ? a.name.localeCompare(b.name, "pl") * (sort.desc ? -1 : 1)
      : (value(b) - value(a)) * (sort.desc ? 1 : -1) || a.name.localeCompare(b.name, "pl"));
  }, [listed, sort]);
  const changes = useMemo(() => biggestHospitalChanges(listed, CHANGE_MIN_PREVIOUS), [listed]);
  const netYear = useMemo(() => {
    const years = catalog.rows.flatMap((row) => row.net ? [row.net.year] : []);
    return years.length ? Math.max(...years) : null;
  }, [catalog.rows]);

  const header = (key: HospitalSortKey, label: ReactNode, numeric = true, title?: string, priority?: 2 | 3) => <th className={[numeric ? styles.num : "", priority ? `col-p${priority}` : ""].filter(Boolean).join(" ") || undefined} title={title} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
    <button type="button" className={styles.sortButton} onClick={() => update({ sort: { key, desc: sort.key === key ? !sort.desc : defaultHospitalSortDesc(key) } })}>
      {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </button>
  </th>;
  const regionName = (ow: string) => catalog.regions[ow] ?? ow;

  return <>
    <div className={styles.tabs} role="tablist" aria-label="Katalog">
      <button type="button" className={`${styles.tab} ${own.tabButton} ${shown === "map" ? styles.tabActive : shown === null ? own.autoTabMap : ""}`} role="tab" aria-selected={shown === "map"} onClick={() => write({ ...state, view: "map" })}>Mapa</button>
      <button type="button" className={`${styles.tab} ${own.tabButton} ${shown === "list" ? styles.tabActive : shown === null ? own.autoTabList : ""}`} role="tab" aria-selected={shown === "list"} onClick={() => write({ ...state, view: "list" })}>Lista <small>{integer(catalog.rows.length)}</small></button>
    </div>

    <div className={styles.filters}>
      <label className={styles.search}>
        <span className={styles.label}>Szukaj</span>
        <input type="search" value={query} placeholder="Nazwa, miasto albo NIP, np. Koszalin, kliniczny" onChange={(event) => update({ query: event.target.value })} />
      </label>
      <label>
        <span className={styles.label}>Województwo</span>
        <select value={region} onChange={(event) => update({ region: event.target.value })}>
          <option value="">cała Polska</option>
          {regionOptions.map(([ow, name]) => <option key={ow} value={ow}>{name}</option>)}
        </select>
      </label>
      <label>
        <span className={styles.label}>Sieć szpitali (PSZ)</span>
        <select value={String(psz)} onChange={(event) => { const value = event.target.value; update({ psz: value === "all" || value === "in" || value === "out" ? value : Number(value) }); }}>
          <option value="all">wszystkie</option>
          <option value="in">w sieci (każdy poziom)</option>
          {catalog.pszLevels.map((level, i) => <option key={level} value={i}>{level}</option>)}
          <option value="out">poza siecią</option>
        </select>
      </label>
      <label>
        <span className={styles.label}>Min. hospitalizacji ({catalog.latestYear})</span>
        <select value={minLatest} onChange={(event) => update({ minLatest: Number(event.target.value) })}>
          {HOSPITAL_MIN_OPTIONS.map((value) => <option key={value} value={value}>{value ? integer(value) : "wszyscy"}</option>)}
        </select>
      </label>
      <button type="button" className={styles.clear} disabled={!hasActiveHospitalFilters(state)} onClick={() => update({ ...DEFAULT_HOSPITAL_CATALOG_STATE, view, sort })}>Wyczyść filtry</button>
    </div>
    {city ? <p className={own.cityFilter}>
      Miasto: <b>{formatCityName(city)}</b> <button type="button" onClick={() => update({ city: "" })} aria-label={`Usuń filtr miasta ${formatCityName(city)}`}>×</button>
    </p> : null}

    {showMap ? <div className={view === null ? own.autoMap : undefined}><HospitalCatalogMap
      rows={filtered}
      allRows={catalog.rows}
      latestYear={catalog.latestYear}
      regionName={(ow) => catalog.regions[ow] ?? ow}
      region={region}
      city={city}
      onRegion={(ow) => update({ region: region === ow ? "" : ow, city: "" })}
      onCity={(name) => update({ city: name })}
      onShowList={() => update({ view: "list" })}
    /></div> : null}
    {showList ? <div className={view === null ? own.autoList : undefined}>

    <section className={styles.card} aria-label="Szpitale">
      {/* 7 kolumn (DESIGN.md 7.1): miasto i województwo w komórce nazwy, NIP w podpowiedzi; w wąskim kontenerze zostają szpital i liczba. */}
      <div className="priority-table">
        <table className={styles.table}>
          <thead>
            <tr className={styles.titleRow}>
              <th colSpan={7}>
                <span className={styles.tableTitle}>Szpitale</span>
                <span className={styles.tableCount}>{integer(rows.length)} z {integer(catalog.rows.length)}</span>
                <InfoTip ariaLabel="Jak czytać tabelę szpitali" label={<HelpLines lines={[
                  "Wiersz = świadczeniodawca z umową z NFZ (oddział wojewódzki NFZ + NIP).",
                  `Mini-wykres: hospitalizacje ${catalog.years[0]}–${catalog.latestYear}, skala każdego wiersza od jego minimum do maksimum (kształt, nie wielkość).`,
                  "Śmiertelność: zgony w szpitalu / hospitalizacje, bez korekty o wiek i stan pacjentów. Szpitale z ciężkimi przypadkami mają ją wyższą.",
                  "Łóżka: rejestr RPWDL, stan bieżący. Wynik netto: najnowsze sprawozdanie finansowe podmiotu; „—” = brak sprawozdania.",
                  "Hospitalizacje metodą konserwatywną (wartości <5 liczone jako 1).",
                ]} />} />
              </th>
            </tr>
            <tr>
              {header("name", "Szpital", false)}
              <th className="col-p3">Hospitalizacje {catalog.years[0]}–{catalog.latestYear}</th>
              {header("latest", catalog.latestYear)}
              {header("change", "r/r", true, catalog.previousYear ? `Zmiana wobec ${catalog.previousYear} r.` : undefined, 2)}
              {header("mortality", "Śmiertelność", true, undefined, 2)}
              {header("beds", "Łóżka", true, "Łóżka w rejestrze RPWDL (stan bieżący)", 3)}
              {header("net", <>Wynik netto{netYear ? <><br />{netYear}</> : null}</>, true, "Wynik netto z najnowszego sprawozdania finansowego podmiotu", 3)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => <tr key={row.key}>
              <td className={styles.name}>
                <HospitalLink owNfz={row.owNfz} nip={row.nip} title={`NIP ${row.nip}`}>{row.name}</HospitalLink>{" "}
                <PszBadge level={row.psz} levels={catalog.pszLevels} />
                <span className={styles.kind}>{formatCityName(row.city)} · {regionName(row.owNfz)}</span>
              </td>
              <td className="col-p3"><Sparkline values={row.series} /></td>
              <td className={styles.num} title={row.latest ? undefined : `Bez hospitalizacji w ${catalog.latestYear} r.`}>{row.latest ? integer(row.latest) : "—"}</td>
              <td className={`${styles.num} col-p2 ${row.changePct !== null && row.changePct < 0 ? styles.down : ""}`} title={catalog.previousYear ? `${catalog.previousYear}: ${integer(row.previous)}` : undefined}>{row.changePct === null ? "—" : signedPct(row.changePct)}</td>
              <td className={`${styles.num} col-p2`}>{row.mortalityPct === null ? "—" : `${decimal(row.mortalityPct)}%`}</td>
              <td className={`${styles.num} col-p3`}>{row.beds ? integer(row.beds) : "—"}</td>
              <td className={`${styles.num} col-p3 ${row.net && row.net.value < 0 ? styles.down : ""}`} title={row.net ? `Sprawozdanie za ${row.net.year} r.` : undefined}>{row.net ? `${row.net.value > 0 ? "+" : row.net.value < 0 ? "−" : ""}${formatPln(Math.abs(row.net.value))}${netYear && row.net.year !== netYear ? ` (${row.net.year})` : ""}` : "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <span>Wyświetlono {integer(Math.min(limit, rows.length))} z {integer(rows.length)} {hasActiveHospitalFilters(state) ? "pasujących " : ""}szpitali</span>
        {rows.length > limit ? <button type="button" onClick={() => setLimit((current) => current + PAGE)}>Pokaż kolejne {Math.min(PAGE, rows.length - limit)}</button> : null}
      </div>
      {!rows.length ? <p className={styles.empty}>Brak szpitali dla tych filtrów.</p> : null}
    </section>

    {catalog.previousYear && changes.up.length ? <div className={styles.changes}>
      <ChangeList title={`Największe wzrosty ${catalog.previousYear} → ${catalog.latestYear}`} rows={changes.up} />
      <ChangeList title={`Największe spadki ${catalog.previousYear} → ${catalog.latestYear}`} rows={changes.down} />
      <p className={styles.changesNote}>Szpitale z co najmniej {integer(CHANGE_MIN_PREVIOUS)} hospitalizacji w {catalog.previousYear} r., z bieżącymi filtrami. Duża zmiana często wynika z przeniesienia świadczeń między podmiotami albo zmiany umowy, a nie z liczby pacjentów.</p>
    </div> : null}
    </div> : null}
  </>;
}

function ChangeList({ title, rows }: { title: string; rows: HospitalCatalogRow[] }) {
  return <section className={styles.changeCard} aria-label={title}>
    <h2>{title}</h2>
    <ol>
      {rows.map((row) => <li key={row.key} className={own.changeItem}>
        <HospitalLink owNfz={row.owNfz} nip={row.nip} className={own.changeLink} title={row.name}>{row.name}</HospitalLink>
        <span className={styles.changeName}>{formatCityName(row.city)}</span>
        <b className={row.changePct! < 0 ? styles.down : styles.up}>{signedPct(row.changePct!)}</b>
      </li>)}
    </ol>
  </section>;
}
