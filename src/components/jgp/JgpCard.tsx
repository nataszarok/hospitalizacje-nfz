"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GroupLineChart, type ChartLine } from "@/components/jgp/GroupLineChart";
import { ProviderScatter, type ScatterPoint } from "@/components/jgp/ProviderScatter";
import { ProviderLink } from "@/components/TableLinks";
import { TrendView } from "@/components/trends/TrendView";
import { formatCityName } from "@/lib/formatters";
import { cartogramCells, poolStats, providerPool, selectedIndex, sumSeries, yearChangePct, type CompareScope } from "@/lib/jgpCard";
import type { JgpAdmissionYear, JgpPageData, JgpProviderRow } from "@/lib/jgpPage";
import { hospitalHref } from "@/lib/portalLinks";
import styles from "./JgpPage.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (value: number) => `${decimal(value)}%`;
const signedPct = (value: number) => `${value > 0 ? "+" : ""}${decimal(value)}%`;
const millions = (value: number) => `${(value / 1_000_000).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mln zł`;

/** Parametry adresu karty: wyróżniony świadczeniodawca (OW|NIP), zakres porównania, województwo. */
export const SELECTED_PROVIDER_PARAM = "osrodek";
const SCOPE_PARAM = "porownanie";
const REGION_PARAM = "ow";
const TOP_LINES = 25;

type TimeMode = "national" | "top";
type NationalMetric = "hospitalizations" | "deaths" | "urgent";

// Strona jest statyczna, więc parametry odczytujemy i zapisujemy w przeglądarce.
function useCardState(data: JgpPageData) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scope, setScope] = useState<CompareScope>("all");
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedKey(params.get(SELECTED_PROVIDER_PARAM)?.trim() || null);
      setScope(params.get(SCOPE_PARAM) === "podobne" ? "peers" : "all");
      const ow = params.get(REGION_PARAM);
      setRegion(ow && data.regions.some((row) => row.owNfz === ow) ? ow : null);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [data.regions]);

  const write = useCallback((next: { selectedKey: string | null; scope: CompareScope; region: string | null }) => {
    const url = new URL(window.location.href);
    const set = (name: string, value: string | null) => value ? url.searchParams.set(name, value) : url.searchParams.delete(name);
    set(SELECTED_PROVIDER_PARAM, next.selectedKey);
    set(SCOPE_PARAM, next.selectedKey && next.scope === "peers" ? "podobne" : null);
    set(REGION_PARAM, next.region);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setSelectedKey(next.selectedKey);
    setScope(next.selectedKey ? next.scope : "all");
    setRegion(next.region);
  }, []);

  return { selectedKey, scope, region, write };
}

/** Interaktywna część karty grupy JGP: wszystkie sekcje reagują na wybrany szpital, podobne szpitale i województwo. */
export function JgpCardSections({ data }: { data: JgpPageData }) {
  const { selectedKey, scope, region, write } = useCardState(data);
  const selected = selectedIndex(data, selectedKey);
  const selectedRow = selected >= 0 ? data.providers[selected] : null;
  const effectiveScope: CompareScope = selectedRow && selectedRow.peers.length ? scope : "all";
  const pool = useMemo(() => providerPool(data, { selectedKey, scope: effectiveScope, region }), [data, selectedKey, effectiveScope, region]);
  const comparison = useMemo(() => providerPool(data, { selectedKey, scope: effectiveScope, region: null }), [data, selectedKey, effectiveScope]);
  const regionName = region ? data.regions.find((row) => row.owNfz === region)?.name ?? region : null;
  const filtered = effectiveScope === "peers" || region !== null;
  const select = useCallback((key: string) => write({ selectedKey: key, scope: effectiveScope, region }), [write, effectiveScope, region]);

  return <>
    {selectedKey ? <SelectedProviderBanner
      data={data}
      selectedKey={selectedKey}
      row={selectedRow}
      rank={selected}
      comparison={comparison}
      scope={effectiveScope}
      onScope={(next) => write({ selectedKey, scope: next, region })}
      onClear={() => write({ selectedKey: null, scope: "all", region })}
    /> : null}

    <nav className={styles.sectionNav} aria-label="Sekcje karty">
      <a href="#jgp-trend">W czasie</a><a href="#jgp-regions">Gdzie</a><a href="#jgp-providers">Kto leczy</a><a href="#jgp-admissions">Tryb przyjęcia</a><a href="#jgp-valuation">Wycena</a>
      {filtered ? <span className={styles.filters}>
        {effectiveScope === "peers" && selectedRow ? <button type="button" onClick={() => write({ selectedKey, scope: "all", region })}>Podobne do: {selectedRow.name} ✕</button> : null}
        {regionName ? <button type="button" onClick={() => write({ selectedKey, scope: effectiveScope, region: null })}>woj. {regionName.toLocaleLowerCase("pl-PL")} ✕</button> : null}
      </span> : null}
    </nav>

    <TimeSection data={data} pool={pool} filtered={filtered} selectedRow={selectedRow} />
    <RegionsSection data={data} region={region} onRegion={(next) => write({ selectedKey, scope: effectiveScope, region: next })} />
    <ProvidersSection data={data} pool={pool} selectedRow={selectedRow} filtered={filtered} onSelect={select} />
    <AdmissionsSection data={data} pool={pool} selectedRow={selectedRow} onSelect={select} />
    <ValuationSection data={data} />
  </>;
}

function SelectedProviderBanner({ data, selectedKey, row, rank, comparison, scope, onScope, onClear }: {
  data: JgpPageData;
  selectedKey: string;
  row: JgpProviderRow | null;
  rank: number;
  comparison: JgpProviderRow[];
  scope: CompareScope;
  onScope: (scope: CompareScope) => void;
  onClear: () => void;
}) {
  const [owNfz, nip] = selectedKey.split("|");
  if (!row) {
    return <section className={styles.selected} aria-label="Wybrany świadczeniodawca">
      <p>Wybrany świadczeniodawca nie ma hospitalizacji w grupie {data.jgpCode} w {data.year} r.</p>
      <div className={styles.selectedActions}>
        {owNfz && nip ? <Link href={hospitalHref(owNfz, nip)}>Profil szpitala →</Link> : null}
        <button type="button" onClick={onClear}>Usuń wyróżnienie</button>
      </div>
    </section>;
  }
  const group = poolStats(comparison);
  const peersCount = row.peers.length;
  const nationalValue = data.valuePln.find((item) => item.year === data.year)?.value;
  const position = comparison.findIndex((item) => item.key === row.key) + 1;
  return <section className={styles.selected} aria-label="Wybrany świadczeniodawca">
    <div className={styles.selectedTop}>
      <div className={styles.selectedHead}>
        <span className={styles.eyebrow}>Wybrany świadczeniodawca na tle {scope === "peers" ? "podobnych szpitali" : "grupy"} · {data.year}</span>
        <strong>{row.name}</strong>
        <span className={styles.muted}>{formatCityName(row.city)} · OW {row.voivodeship}</span>
      </div>
      <div className={styles.segmented} role="group" aria-label="Porównaj z">
        <button type="button" aria-pressed={scope === "all"} onClick={() => onScope("all")}>Wszystkie ośrodki ({integer(data.providerCount)})</button>
        <button type="button" aria-pressed={scope === "peers"} disabled={!peersCount} onClick={() => onScope("peers")}>Podobne szpitale ({peersCount})</button>
      </div>
    </div>
    <dl className={styles.selectedMetrics}>
      <div><dt>Miejsce</dt><dd>{position} / {integer(comparison.length)}</dd><span>{scope === "peers" ? "wśród podobnych szpitali" : `w grupie (${rank + 1} w kraju)`}</span></div>
      <div><dt>Hospitalizacje</dt><dd>{integer(row.hospitalizations)}</dd><span>{pct(group.hospitalizations ? (row.hospitalizations / group.hospitalizations) * 100 : 0)} {scope === "peers" ? "podobnych" : "grupy"}</span></div>
      <div><dt>Śmiertelność</dt><dd>{pct(row.mortalityPct)}</dd><span>{scope === "peers" ? "podobne" : "grupa"}: {pct(group.mortalityPct)}</span></div>
      <div><dt>Przyjęcia nagłe</dt><dd>{pct(row.urgentPct)}</dd><span>{scope === "peers" ? "podobne" : "grupa"}: {pct(group.urgentPct)}</span></div>
      {row.valuePln !== null ? <div><dt>Rozliczenia NFZ za {data.jgpCode}</dt><dd>{millions(row.valuePln)}</dd><span>{nationalValue ? `${pct((row.valuePln / nationalValue) * 100)} kraju` : ""}</span></div> : null}
    </dl>
    <p className={styles.note}>
      {peersCount ? `Podobne szpitale: ${peersCount} szpitali z modelu par (klasa A), które leczą w tej grupie. ` : "Model par nie wskazał podobnych szpitali, które leczą w tej grupie. "}
      Śmiertelność nie jest oceną jakości leczenia: zależy od stanu pacjentów i profilu ośrodka.
    </p>
    <div className={styles.selectedActions}>
      <Link href={hospitalHref(row.owNfz, row.nip)}>Profil szpitala →</Link>
      <a href="#jgp-providers">Pozycja w rankingu ↓</a>
      <button type="button" onClick={onClear}>Usuń wyróżnienie</button>
    </div>
  </section>;
}

function TimeSection({ data, pool, filtered, selectedRow }: { data: JgpPageData; pool: JgpProviderRow[]; filtered: boolean; selectedRow: JgpProviderRow | null }) {
  const [mode, setMode] = useState<TimeMode>("national");
  const [metric, setMetric] = useState<NationalMetric>("hospitalizations");
  const top = pool.slice(0, TOP_LINES);
  const lines = useMemo((): ChartLine[] => {
    if (mode === "national") {
      if (filtered) return [{ key: "pool", name: `Wybrane ośrodki (${pool.length})`, values: sumSeries(pool, data.months.length), tone: "primary" }];
      const values = metric === "deaths" ? data.national.deaths : metric === "urgent" ? data.national.urgent : data.national.hospitalizations;
      return [{ key: "pl", name: "Cała Polska", values, tone: "primary" }];
    }
    const shown = selectedRow && !top.includes(selectedRow) ? [...top, selectedRow] : top;
    return shown.map((row) => ({
      key: row.key,
      name: `${data.providers.indexOf(row) + 1}. ${row.name}`,
      detail: `${formatCityName(row.city)} · OW ${row.voivodeship}`,
      values: row.series,
      tone: row === selectedRow ? "selected" : undefined,
    }));
  }, [mode, metric, filtered, pool, top, selectedRow, data]);

  if (!data.months.length) {
    return <section className={styles.section} aria-labelledby="jgp-trend">
      <h2 id="jgp-trend" className={styles.sectionTitle}>Jak to się zmieniało w czasie</h2>
      <TrendView productCodes={data.productCodes} method="min" />
    </section>;
  }
  const valueLabel = mode === "national" && !filtered && metric === "deaths" ? "zgonów" : mode === "national" && !filtered && metric === "urgent" ? "przyjęć nagłych" : "hosp.";
  const previousYear = data.months[0]?.slice(0, 4);
  return <section className={styles.section} aria-labelledby="jgp-trend">
    <div className={styles.sectionHead}>
      <h2 id="jgp-trend" className={styles.sectionTitle}>W czasie · hospitalizacje miesięcznie</h2>
      <div className={styles.controls}>
        <div className={styles.segmented} role="group" aria-label="Widok wykresu">
          <button type="button" aria-pressed={mode === "national"} onClick={() => setMode("national")}>{filtered ? "Suma wybranych" : "Cała Polska"}</button>
          <button type="button" aria-pressed={mode === "top"} onClick={() => setMode("top")}>Top {Math.min(TOP_LINES, pool.length)} ośrodków</button>
        </div>
        {mode === "national" && !filtered ? <div className={styles.segmented} role="group" aria-label="Miara">
          <button type="button" aria-pressed={metric === "hospitalizations"} onClick={() => setMetric("hospitalizations")}>Hospitalizacje</button>
          <button type="button" aria-pressed={metric === "deaths"} onClick={() => setMetric("deaths")}>Zgony</button>
          <button type="button" aria-pressed={metric === "urgent"} onClick={() => setMetric("urgent")}>Nagłe</button>
        </div> : null}
      </div>
    </div>
    <div className={styles.tableCard}>
      <GroupLineChart
        months={data.months}
        lines={lines}
        valueLabel={valueLabel}
        ariaLabel={mode === "top" ? `Wykres liniowy: hospitalizacje miesięcznie w ${lines.length} ośrodkach` : `Wykres liniowy: ${valueLabel} miesięcznie`}
      />
      <p className={styles.note}>
        {mode === "top"
          ? <>Linia = ośrodek. Najedź na linię, aby zobaczyć nazwę.{selectedRow ? " Wybrany szpital ma kolor pomarańczowy." : ""} Skala wspólna dla wszystkich ośrodków.</>
          : <>Rok {previousYear} i {data.year}; miesiące według daty wypisu. {filtered ? "Suma ośrodków po filtrach karty." : ""}</>}
        {" "}Wartości &lt;5 liczone jako 1.
      </p>
      {mode === "top" ? <details className={styles.dataDetails}>
        <summary>Tabela danych · top {top.length}</summary>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Ośrodek</th><th className={styles.num}>{previousYear}</th><th className={styles.num}>{data.year}</th><th className={styles.num}>r/r</th><th className={styles.num}>Udział</th></tr></thead>
          <tbody>
            {top.map((row) => {
              const change = yearChangePct(row.hospitalizations, row.previousHospitalizations);
              return <tr key={row.key} className={row === selectedRow ? styles.rowSelected : undefined}>
                <td>{data.providers.indexOf(row) + 1}</td>
                <td><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /></td>
                <td className={styles.num}>{row.previousHospitalizations === null ? "—" : integer(row.previousHospitalizations)}</td>
                <td className={styles.num}>{integer(row.hospitalizations)}</td>
                <td className={styles.num}>{change === null ? "—" : signedPct(change)}</td>
                <td className={styles.num}>{pct(data.hospitalizations ? (row.hospitalizations / data.hospitalizations) * 100 : 0)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </details> : null}
    </div>
  </section>;
}

function RegionsSection({ data, region, onRegion }: { data: JgpPageData; region: string | null; onRegion: (region: string | null) => void }) {
  const cells = cartogramCells(data.regions);
  const people = data.regions.reduce((sum, row) => sum + row.population, 0);
  const national = people ? (data.regions.reduce((sum, row) => sum + row.hospitalizations, 0) / people) * 100_000 : 0;
  const max = Math.max(...data.regions.map((row) => row.per100k), 0);
  return <section className={styles.section} aria-labelledby="jgp-regions">
    <h2 id="jgp-regions" className={styles.sectionTitle}>Gdzie · {data.year}</h2>
    <div className={`${styles.tableCard} ${styles.mapCard}`}>
      <div className={styles.mapLayout}>
        <div>
          <div className={styles.cartogram} role="group" aria-label="Kartogram województw: hospitalizacje na 100 tys. mieszkańców">
            {cells.map((cell) => <button
              key={cell.owNfz}
              type="button"
              className={`${styles.tile} ${styles[`level${cell.level}`]}`}
              style={{ gridColumn: cell.column, gridRow: cell.row }}
              aria-pressed={region === cell.owNfz}
              title={`${cell.name}: ${decimal(cell.per100k)} na 100 tys., ${integer(cell.hospitalizations)} hospitalizacji`}
              onClick={() => onRegion(region === cell.owNfz ? null : cell.owNfz)}
            >
              <span className={styles.tileName}>{cell.shortName}</span>
              <b>{decimal(cell.per100k)}</b>
            </button>)}
          </div>
          <div className={styles.scale} aria-hidden>na 100 tys. mieszkańców: <i className={styles.level1} /><i className={styles.level2} /><i className={styles.level3} /><i className={styles.level4} /><i className={styles.level5} /> mniej → więcej</div>
        </div>
        <div className={styles.mapSide}>
          <p><b>Średnia dla Polski: {decimal(national)}</b> na 100 tys. mieszkańców.</p>
          <p>Kliknij województwo, aby zawęzić kartę: wykres „W czasie”, ranking i wykresy punktowe pokażą tylko ośrodki z tego województwa.</p>
          <p className={styles.muted}>Województwo = oddział NFZ, w którym świadczeniodawca rozlicza hospitalizacje, nie miejsce zamieszkania pacjenta. Kafelki pokazują przybliżone położenie województw.</p>
        </div>
      </div>
      <details className={styles.dataDetails}>
        <summary>Tabela danych · województwa</summary>
        <table className={styles.table}>
          <thead><tr><th>Województwo</th><th>Na 100 tys. mieszkańców</th><th className={styles.num}>Hospitalizacje</th><th className={styles.num}>Śmiertelność</th><th className={styles.num}>Nagłe</th></tr></thead>
          <tbody>
            {data.regions.map((row) => <tr key={row.owNfz} className={row.owNfz === region ? styles.rowSelected : undefined}>
              <td>{row.name}</td>
              <td><div className={styles.barCell}><span className={styles.bar} style={{ width: `${max ? (row.per100k / max) * 100 : 0}%` }} aria-hidden /><span className={styles.barValue}>{decimal(row.per100k)}</span></div></td>
              <td className={styles.num}>{integer(row.hospitalizations)}</td>
              <td className={styles.num}>{pct(row.mortalityPct)}</td>
              <td className={styles.num}>{pct(row.urgentPct)}</td>
            </tr>)}
          </tbody>
        </table>
      </details>
      <p className={styles.note}><Link href={`/analizy?t=g&jgp=${encodeURIComponent(data.jgpCode)}`}>Województwa i miasta w eksploratorze →</Link></p>
    </div>
  </section>;
}

function scatterPoint(row: JgpProviderRow, selectedRow: JgpProviderRow | null, y: number, lines: string[]): ScatterPoint {
  return { key: row.key, name: row.name, lines: [`${formatCityName(row.city)} · OW ${row.voivodeship}`, ...lines], x: row.hospitalizations, y, selected: row === selectedRow };
}

function ProvidersSection({ data, pool, selectedRow, filtered, onSelect }: {
  data: JgpPageData; pool: JgpProviderRow[]; selectedRow: JgpProviderRow | null; filtered: boolean; onSelect: (key: string) => void;
}) {
  // Liczba wierszy jak w danych strony (ranking z `buildJgpPageData`), także po filtrach.
  const limit = Math.max(data.topProviders.length, 1);
  const rows = pool.slice(0, limit).map((row) => ({ row, rank: data.providers.indexOf(row) + 1, appended: false }));
  // Wybrany szpital spoza czołówki dopisujemy na końcu.
  if (selectedRow && !rows.some(({ row }) => row === selectedRow)) rows.push({ row: selectedRow, rank: data.providers.indexOf(selectedRow) + 1, appended: true });
  const stats = poolStats(pool);
  const points = useMemo(() => pool.map((row) => scatterPoint(row, selectedRow, row.mortalityPct, [
    `${integer(row.hospitalizations)} hosp. · ${integer(row.deaths)} zgonów · ${pct(row.mortalityPct)}`,
  ])), [pool, selectedRow]);
  return <section className={styles.section} aria-labelledby="jgp-providers">
    <h2 id="jgp-providers" className={styles.sectionTitle}>Kto leczy najwięcej · {data.year}</h2>
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th><th>Świadczeniodawca</th><th>Miasto</th><th>Województwo</th>
            <th className={styles.num}>Hospitalizacje</th><th className={styles.num}>Śmiertelność</th><th className={styles.num}>Nagłe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, rank, appended }) => {
            const isSelected = row === selectedRow;
            return <tr key={row.key} className={isSelected ? styles.rowSelected : undefined} aria-current={isSelected ? "true" : undefined}>
              <td>{appended ? `… ${rank}` : rank}</td>
              <td><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /></td>
              <td>{formatCityName(row.city)}</td>
              <td>{row.voivodeship}</td>
              <td className={styles.num}>{integer(row.hospitalizations)}</td>
              <td className={styles.num}>{pct(row.mortalityPct)}</td>
              <td className={styles.num}>{pct(row.urgentPct)}</td>
            </tr>;
          })}
        </tbody>
      </table>
      <p className={styles.note}>
        {Math.min(limit, pool.length)} z {integer(pool.length)} {filtered ? "ośrodków po filtrach karty" : "świadczeniodawców"}; numer = miejsce w kraju. Wartości &lt;5 liczone metodą konserwatywną (każde &lt;5 = 1).
      </p>
    </div>
    <div className={styles.tableCard} style={{ marginTop: 12 }}>
      <h3 className={styles.chartTitle}>Wolumen a śmiertelność</h3>
      <ProviderScatter
        points={points}
        xTitle="Hospitalizacje (skala logarytmiczna)"
        yTitle="Śmiertelność"
        ySuffix="%"
        reference={{ y: stats.mortalityPct, label: `${filtered ? "wybrane" : "grupa"}: ${pct(stats.mortalityPct)}` }}
        onSelect={onSelect}
        ariaLabel={`Wykres punktowy: ${pool.length} ośrodków, liczba hospitalizacji i śmiertelność`}
      />
      <p className={styles.note}>
        Punkt = ośrodek. Najedź na punkt: nazwa i liczby. Kliknij punkt, aby wyróżnić ośrodek na całej karcie.
        {" "}Śmiertelność nie jest oceną jakości leczenia. <Link href={`/analizy?t=k&jgp=${encodeURIComponent(data.jgpCode)}`}>Filtry i interpretacja w eksploratorze →</Link>
      </p>
    </div>
  </section>;
}

const ADMISSION_PARTS: { key: keyof Omit<JgpAdmissionYear, "year" | "total">; label: string; className: string }[] = [
  { key: "planned", label: "Planowe", className: styles.segmentPlanned },
  { key: "urgent", label: "Nagłe", className: styles.segmentUrgent },
  { key: "other", label: "Pozostałe", className: styles.segmentOther },
];

function AdmissionsSection({ data, pool, selectedRow, onSelect }: { data: JgpPageData; pool: JgpProviderRow[]; selectedRow: JgpProviderRow | null; onSelect: (key: string) => void }) {
  const latest = data.admissions.at(-1);
  const share = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;
  const stats = poolStats(pool);
  const points = useMemo(() => pool.map((row) => scatterPoint(row, selectedRow, row.urgentPct, [
    `${integer(row.hospitalizations)} hosp. · nagłe ${pct(row.urgentPct)}`,
  ])), [pool, selectedRow]);
  return <section className={styles.section} aria-labelledby="jgp-admissions">
    <h2 id="jgp-admissions" className={styles.sectionTitle}>Planowo czy w trybie nagłym</h2>
    <div className={styles.tableCard}>
      {latest ? <p className={styles.lead}>
        W {latest.year} r. {pct(share(latest.urgent, latest.total))} hospitalizacji to przyjęcia nagłe,
        {" "}{pct(share(latest.planned, latest.total))} — planowe.
      </p> : null}
      <ul className={styles.legend} aria-label="Legenda">
        {ADMISSION_PARTS.map((part) => <li key={part.key}><span className={`${styles.swatch} ${part.className}`} aria-hidden />{part.label}</li>)}
      </ul>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Rok</th><th>Struktura przyjęć</th>
            <th className={styles.num}>Planowe</th><th className={styles.num}>Nagłe</th><th className={styles.num}>Pozostałe</th>
          </tr>
        </thead>
        <tbody>
          {data.admissions.map((row) => <tr key={row.year}>
            <td>{row.year}</td>
            <td>
              <div className={styles.stack} role="img" aria-label={ADMISSION_PARTS.map((part) => `${part.label} ${pct(share(row[part.key], row.total))}`).join(", ")}>
                {ADMISSION_PARTS.map((part) => row[part.key] > 0
                  ? <span key={part.key} className={`${styles.segment} ${part.className}`} style={{ width: `${share(row[part.key], row.total)}%` }} title={`${part.label}: ${pct(share(row[part.key], row.total))}`} />
                  : null)}
              </div>
            </td>
            <td className={styles.num}>{integer(row.planned)} <span className={styles.muted}>({pct(share(row.planned, row.total))})</span></td>
            <td className={styles.num}>{integer(row.urgent)} <span className={styles.muted}>({pct(share(row.urgent, row.total))})</span></td>
            <td className={styles.num}>{integer(row.other)} <span className={styles.muted}>({pct(share(row.other, row.total))})</span></td>
          </tr>)}
        </tbody>
      </table>
      <p className={styles.note}>
        Nagłe: tryb przyjęcia 2 i 3. Planowe: tryb 6. Pozostałe: inne kody trybu przyjęcia.
        {" "}<Link href={`/analizy?t=a&jgp=${encodeURIComponent(data.jgpCode)}`}>Tryb przyjęcia u świadczeniodawców →</Link>
      </p>
    </div>
    <div className={styles.tableCard} style={{ marginTop: 12 }}>
      <h3 className={styles.chartTitle}>Tryb przyjęcia w ośrodkach · {data.year}</h3>
      <ProviderScatter
        points={points}
        xTitle="Hospitalizacje (skala logarytmiczna)"
        yTitle="Udział przyjęć nagłych"
        ySuffix="%"
        reference={{ y: stats.urgentPct, label: `${pool.length < data.providers.length ? "wybrane" : "grupa"}: ${pct(stats.urgentPct)}` }}
        onSelect={onSelect}
        ariaLabel={`Wykres punktowy: ${pool.length} ośrodków, liczba hospitalizacji i udział przyjęć nagłych`}
      />
      <p className={styles.note}>Punkt = ośrodek. Najedź na punkt: nazwa, liczba hospitalizacji i udział przyjęć nagłych. Kliknij punkt, aby wyróżnić ośrodek.</p>
    </div>
  </section>;
}

function ValuationSection({ data }: { data: JgpPageData }) {
  const max = Math.max(...data.valuePln.map((item) => item.value), 0);
  return <section className={styles.section} aria-labelledby="jgp-valuation">
    <h2 id="jgp-valuation" className={styles.sectionTitle}>Wycena i wartość rozliczeń</h2>
    <div className={`${styles.tableCard} ${styles.valuation}`}>
      <dl className={styles.valuationFacts}>
        <div><dt>Wycena {data.valuation?.year ?? ""}</dt><dd>{data.valuation?.points ? `${integer(data.valuation.points)} pkt` : "brak w katalogu"}</dd><span>za hospitalizację</span></div>
        <div><dt>Dni finansowane w ryczałcie</dt><dd>{data.valuation?.daysFinanced ?? "—"}</dd><span>{data.valuation?.extraDayPoints ? `ponad nie: ${integer(data.valuation.extraDayPoints)} pkt za osobodzień` : "brak osobnej stawki za osobodzień"}</span></div>
      </dl>
      {data.valuePln.length ? <div>
        <h3 className={styles.chartTitle}>Rozliczenia NFZ za grupę w kraju, mln zł</h3>
        <div className={styles.valueBars} role="img" aria-label={`Rozliczenia NFZ za ${data.jgpCode}: ${data.valuePln.map((item) => `${item.year} ${millions(item.value)}`).join(", ")}`}>
          {data.valuePln.map((item) => <div key={item.year} className={styles.valueBar}>
            <span className={styles.valueBarValue}>{(item.value / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</span>
            <span className={styles.valueBarFill} style={{ height: `${max ? (item.value / max) * 100 : 0}%` }} />
            <span className={styles.valueBarYear}>{item.year}</span>
          </div>)}
        </div>
        <p className={styles.note}>Źródło: zestawienie rozliczeń NFZ (produkty JGP). Zmiana kwot obejmuje też zmiany wycen i cen punktu, nie tylko liczbę świadczeń.</p>
      </div> : <p className={styles.note}>Brak danych o rozliczeniach w złotych.</p>}
    </div>
  </section>;
}
