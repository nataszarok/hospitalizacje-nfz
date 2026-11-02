"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GroupLineChart, type ChartLine } from "@/components/jgp/GroupLineChart";
import { REGION_COLORS, RegionMap, SELECTED_PROVIDER_PARAM, regionTitle } from "@/components/jgp/JgpCard";
import { ProviderScatter, type ScatterCurve, type ScatterPoint } from "@/components/jgp/ProviderScatter";
import { ProviderLink } from "@/components/TableLinks";
import { formatCityName } from "@/lib/formatters";
import {
  cartogramCells, funnelCurves, funnelStatus, MAX_REGIONS, MIN_FUNNEL_DEATHS, poolStats, providerPool, providerYearTotals, scaleColor, selectedIndex,
  structureShares, sumSeries, unpackPageData, yearChangePct, type CompareScope, type PackedJgpPageData, type RegionsMap,
} from "@/lib/jgpCard";
import type { JgpPageData, JgpProviderRow } from "@/lib/jgpPage";
import { hospitalHref } from "@/lib/portalLinks";
import base from "./JgpPage.module.css";
import styles from "./JgpTabs.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number, digits = 1) => value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number, digits = 1) => `${decimal(value, digits)}%`;
const signedPct = (value: number) => `${value > 0 ? "+" : ""}${decimal(value)}%`;
const signedPp = (value: number, digits = 1) => `${value > 0 ? "+" : ""}${decimal(value, digits)} pp`;
const millions = (value: number) => `${decimal(value / 1_000_000)} mln zł`;

/** Parametry adresu: zakładka (`widok=osrodki`), wybrany ośrodek, porównanie z podobnymi, województwa. */
const TAB_PARAM = "widok";
const SCOPE_PARAM = "porownanie";
const REGION_PARAM = "ow";
const TOP_LINES = 15;
const SERVER_ROWS = 30;
const subscribeNothing = () => () => {};
// Kolory lejka: poza granicą 95% i 99,8% (w górę i w dół).
const FUNNEL_COLORS = { up95: "#E3A27F", up998: "#B4441B", down95: "#8FB0DD", down998: "#2856A3" };

export type CardTab = "przeglad" | "osrodki";

interface CardState { tab: CardTab; selectedKey: string | null; scope: CompareScope; regions: string[] }

// Strona jest statyczna: stan czytamy i zapisujemy w adresie w przeglądarce.
function useTabbedState(data: JgpPageData) {
  const [state, setState] = useState<CardState>({ tab: "przeglad", selectedKey: null, scope: "all", regions: [] });
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const known = new Set(data.regions.map((row) => row.owNfz));
      const selectedKey = params.get(SELECTED_PROVIDER_PARAM)?.trim() || null;
      setState({
        // Wybrany ośrodek otwiera zakładkę „Ośrodki” (link z karty szpitala, wyszukiwarki).
        tab: params.get(TAB_PARAM) === "osrodki" || selectedKey ? "osrodki" : "przeglad",
        selectedKey,
        scope: params.get(SCOPE_PARAM) === "podobne" ? "peers" : "all",
        regions: [...new Set(params.getAll(REGION_PARAM).filter((ow) => known.has(ow)))].slice(0, MAX_REGIONS),
      });
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [data.regions]);

  // Aktualny stan w refie: adres zapisujemy poza funkcją aktualizującą stan (zapis adresu odświeża router Next).
  const current = useRef(state);
  useEffect(() => { current.current = state; }, [state]);
  const write = useCallback((patch: Partial<CardState>) => {
    const next = { ...current.current, ...patch };
    if (!next.selectedKey) next.scope = "all";
    current.current = next;
    const url = new URL(window.location.href);
    const set = (name: string, value: string | null) => value ? url.searchParams.set(name, value) : url.searchParams.delete(name);
    set(TAB_PARAM, next.tab === "osrodki" && !next.selectedKey ? "osrodki" : null);
    set(SELECTED_PROVIDER_PARAM, next.selectedKey);
    set(SCOPE_PARAM, next.selectedKey && next.scope === "peers" ? "podobne" : null);
    url.searchParams.delete(REGION_PARAM);
    for (const ow of next.regions) url.searchParams.append(REGION_PARAM, ow);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setState(next);
  }, []);
  return { state, write };
}

/** Karta grupy JGP w zakładkach „Przegląd” i „Ośrodki” (układ z docs/karta-jgp-pytania.html). */
export function JgpTabbedCard({ packed, map = null }: { packed: PackedJgpPageData; map?: RegionsMap | null }) {
  const data = useMemo(() => unpackPageData(packed), [packed]);
  const { state, write } = useTabbedState(data);
  const selected = selectedIndex(data, state.selectedKey);
  const selectedRow = selected >= 0 ? data.providers[selected] : null;
  const scope: CompareScope = selectedRow && selectedRow.peers.length ? state.scope : "all";
  const pool = useMemo(() => providerPool(data, { selectedKey: state.selectedKey, scope, regions: state.regions }), [data, state.selectedKey, scope, state.regions]);
  const comparison = useMemo(() => providerPool(data, { selectedKey: state.selectedKey, scope, regions: [] }), [data, state.selectedKey, scope]);
  const toggleRegion = useCallback((ow: string) => {
    const regions = state.regions.includes(ow) ? state.regions.filter((item) => item !== ow) : state.regions.length < MAX_REGIONS ? [...state.regions, ow] : state.regions;
    write({ regions });
  }, [state.regions, write]);

  return <>
    <CardHeader data={data} regions={state.regions} onClearRegion={(ow) => write({ regions: state.regions.filter((item) => item !== ow) })} />
    <div className={styles.tabbar}>
      <div className={styles.tabs} role="tablist" aria-label="Zakładki karty">
        <button type="button" role="tab" id="tab-przeglad" aria-controls="panel-przeglad" aria-selected={state.tab === "przeglad"} onClick={() => write({ tab: "przeglad" })}>
          Przegląd<small>grupa w systemie</small>
        </button>
        <button type="button" role="tab" id="tab-osrodki" aria-controls="panel-osrodki" aria-selected={state.tab === "osrodki"} onClick={() => write({ tab: "osrodki" })}>
          Ośrodki<small>{integer(pool.length)}</small>
        </button>
      </div>
      <span className={styles.tabMeta}>Dane {data.year}; wykresy w czasie: {data.months[0]?.slice(0, 4) ?? data.year}–{data.year}</span>
    </div>
    {state.tab === "przeglad"
      ? <div role="tabpanel" id="panel-przeglad" aria-labelledby="tab-przeglad" className={styles.panel}>
        <OverviewTab data={data} pool={pool} map={map} regions={state.regions} onToggleRegion={toggleRegion} />
      </div>
      : <div role="tabpanel" id="panel-osrodki" aria-labelledby="tab-osrodki" className={styles.panel}>
        <ProvidersTab
          data={data}
          pool={pool}
          comparison={comparison}
          selectedRow={selectedRow}
          scope={scope}
          filtered={scope === "peers" || state.regions.length > 0}
          onSelect={(key) => write({ selectedKey: key === state.selectedKey ? null : key })}
          onScope={(next) => write({ scope: next })}
          onClear={() => write({ selectedKey: null })}
        />
      </div>}
  </>;
}

function CardHeader({ data, regions, onClearRegion }: { data: JgpPageData; regions: string[]; onClearRegion: (ow: string) => void }) {
  const years = data.admissions;
  const latest = years.at(-1);
  const previous = years.at(-2);
  const rate = (point?: { total: number; deaths?: number }) => point && point.total && point.deaths !== undefined ? (point.deaths / point.total) * 100 : null;
  const latestRate = rate(latest);
  const previousRate = rate(previous);
  const value = data.valuePln.at(-1);
  const valuePrevious = data.valuePln.at(-2);
  const yearIndex = data.admissionYears.indexOf(data.year);
  const previousProviders = yearIndex > 0 ? data.providers.filter((row) => (providerYearTotals(row)[yearIndex - 1] ?? 0) > 0).length : null;
  const change = yearChangePct(data.hospitalizations, data.previousHospitalizations);
  const regionName = (ow: string) => data.regions.find((row) => row.owNfz === ow)?.name ?? ow;
  const range = data.catalogYears.length > 1 ? `${data.catalogYears[0]}–${data.catalogYears.at(-1)}` : data.catalogYears[0] ?? data.year;
  return <header className={styles.head}>
    <div className={styles.headText}>
      <nav className={base.breadcrumbs} aria-label="Ścieżka"><Link href="/jgp">Grupy JGP</Link> <span aria-hidden>›</span> <span>{data.jgpCode}</span></nav>
      <div className={base.eyebrow}>Grupa JGP · {data.procedural ? "zabiegowa" : "zachowawcza"}</div>
      <h1 className={styles.title}><span className={base.code}>{data.jgpCode}</span> {data.name}</h1>
      <p className={styles.meta}>
        {data.valuation?.points ? <span>Wycena <b>{integer(data.valuation.points)} pkt</b> (katalog {data.valuation.year})</span> : null}
        <span>Produkt {data.productCodes.join(", ")}</span>
        <span>Dane: <b>{range}</b></span>
      </p>
      <p className={styles.area}>
        <span className={styles.areaLabel}>Obszar</span>
        {regions.length
          ? regions.map((ow) => <button key={ow} type="button" className={styles.chip} onClick={() => onClearRegion(ow)}>woj. {regionName(ow).toLocaleLowerCase("pl-PL")} ✕</button>)
          : <span>cała Polska · kliknij województwo na mapie</span>}
      </p>
      <Link className={styles.explorer} href={`/analizy?jgp=${encodeURIComponent(data.jgpCode)}`}>Pokaż w eksploratorze →</Link>
    </div>
    <dl className={styles.kpis} aria-label="Liczby grupy">
      <div><dt>Hospitalizacje {data.year}</dt><dd>{integer(data.hospitalizations)}</dd><span>{change === null ? "pierwszy rok" : `${signedPct(change)} r/r`}</span></div>
      <div><dt>Kwota świadczeń NFZ {value?.year ?? ""}</dt><dd>{value ? millions(value.value) : "—"}</dd><span>{value && valuePrevious ? `${signedPct(((value.value - valuePrevious.value) / valuePrevious.value) * 100)} r/r` : "brak poprzedniego roku"}</span></div>
      <div><dt>Śmiertelność</dt><dd>{latestRate === null ? "—" : pct(latestRate, latestRate < 1 ? 2 : 1)}</dd><span>{latestRate !== null && previousRate !== null ? `${signedPp(latestRate - previousRate, latestRate < 1 ? 2 : 1)} r/r` : "zgony w szpitalu"}</span></div>
      <div><dt>Ośrodki</dt><dd>{integer(data.providerCount)}</dd><span>{previousProviders === null ? "w roku danych" : `${data.providerCount - previousProviders >= 0 ? "+" : ""}${data.providerCount - previousProviders} r/r`}</span></div>
    </dl>
  </header>;
}

function SectionHead({ id, question, context, tag }: { id: string; question: string; context: string; tag: string }) {
  return <div className={styles.secHead}>
    <h2 id={id} className={styles.secTitle}><span className={styles.q}>{question}</span> <span className={styles.ctx}>{context}</span></h2>
    <span className={styles.tag}>{tag}</span>
  </div>;
}

// ——— Przegląd ———

type Metric = "hospitalizations" | "deaths" | "urgent";

function OverviewTab({ data, pool, map, regions, onToggleRegion }: { data: JgpPageData; pool: JgpProviderRow[]; map: RegionsMap | null; regions: string[]; onToggleRegion: (ow: string) => void }) {
  const [metric, setMetric] = useState<Metric>("hospitalizations");
  const lines = useMemo((): ChartLine[] => {
    if (regions.length) return regions.map((ow, i) => {
      const rows = pool.filter((row) => row.owNfz === ow);
      const name = data.regions.find((row) => row.owNfz === ow)?.name ?? ow;
      return { key: ow, name: `${name} (${rows.length})`, values: sumSeries(rows, data.months.length), color: REGION_COLORS[i % REGION_COLORS.length] };
    });
    const values = metric === "deaths" ? data.national.deaths : metric === "urgent" ? data.national.urgent : data.national.hospitalizations;
    return [{ key: "pl", name: "Cała Polska", values, tone: "primary" }];
  }, [data, pool, regions, metric]);
  const label = !regions.length && metric === "deaths" ? "zgonów" : !regions.length && metric === "urgent" ? "przyjęć nagłych" : "hosp.";
  return <>
    <section className={styles.sec} aria-labelledby="s-ile">
      <SectionHead id="s-ile" question="Ile?" context={`${regions.length ? "Hospitalizacje w wybranych województwach" : "Hospitalizacje"} miesięcznie, wszystkie lata`} tag="Lata" />
      {!regions.length ? <div className={base.segmented} role="group" aria-label="Miara">
        <button type="button" aria-pressed={metric === "hospitalizations"} onClick={() => setMetric("hospitalizations")}>Hospitalizacje</button>
        <button type="button" aria-pressed={metric === "deaths"} onClick={() => setMetric("deaths")}>Zgony</button>
        <button type="button" aria-pressed={metric === "urgent"} onClick={() => setMetric("urgent")}>Nagłe</button>
      </div> : null}
      <GroupLineChart months={data.months} lines={lines} valueLabel={label} legend={regions.length > 0} height={300} ariaLabel={`Wykres liniowy: ${label} miesięcznie we wszystkich latach`} />
      <p className={base.note}>Kropka = miesiąc, linia = średnia z 3 miesięcy. Miesiące według daty wypisu. Wartości &lt;5 liczone jako 1.</p>
    </section>
    <RegionsSection data={data} map={map} regions={regions} onToggle={onToggleRegion} />
    <CostSection data={data} />
    <ProfileSection data={data} />
  </>;
}

function RegionsSection({ data, map, regions, onToggle }: { data: JgpPageData; map: RegionsMap | null; regions: string[]; onToggle: (ow: string) => void }) {
  const { cells, scale } = cartogramCells(data.regions);
  const names = new Map(data.regions.map((row) => [row.owNfz, row.name]));
  const titles = new Map(cells.map((cell) => [cell.owNfz, regionTitle(cell)]));
  // Mapa ciepła: wskaźnik województwa jako wielokrotność średniej Polski w danym roku (ta sama skala co mapa).
  const heat = data.regionYears.map((year) => {
    const people = data.regions.reduce((sum, row) => sum + row.population, 0);
    const national = people ? (year.rows.reduce((sum, row) => sum + row[2], 0) / people) * 100_000 : 0;
    return { year: year.year, national, values: new Map(year.rows.map(([ow, per100k]) => [ow, per100k])) };
  });
  const position = (value: number, national: number) => value > 0 && national > 0 ? Math.max(-1, Math.min(1, Math.log2(value / national))) : -1;
  return <section className={styles.sec} aria-labelledby="s-gdzie">
    <SectionHead id="s-gdzie" question="Gdzie?" context={`Szpitale w województwie na 100 tys. mieszkańców: mapa ${data.year}, mapa ciepła lat`} tag="Mapa: rok · tabela: lata" />
    <p className={styles.callout}><b>To podaż, nie potrzeby.</b> Województwo to oddział NFZ, z którym szpital ma umowę, a nie miejsce zamieszkania pacjenta. Wysoki wskaźnik znaczy: szpitale w tym województwie wykonują dużo tej grupy w stosunku do liczby mieszkańców.</p>
    <div className={styles.geo}>
      <div>
        {map ? <RegionMap map={map} cells={cells} regions={regions} onToggle={onToggle} /> : null}
        <div className={base.scale}>
          <span>½ × średniej</span>
          <i className={base.scaleGradient} style={{ background: `linear-gradient(90deg, ${scaleColor(-1)}, ${scaleColor(0)}, ${scaleColor(1)})` }} aria-hidden />
          <span>2 × średniej</span>
        </div>
      </div>
      <div className={styles.heatWrap} role="region" aria-label="Mapa ciepła: województwa w latach" tabIndex={0}>
        <table className={styles.heat}>
          <thead><tr><th>Województwo</th>{heat.map((year) => <th key={year.year} className={base.num}>{year.year}</th>)}</tr></thead>
          <tbody>
            {data.regions.map((row) => <tr key={row.owNfz} className={regions.includes(row.owNfz) ? base.rowSelected : undefined}>
              <td><button type="button" className={styles.linkCell} aria-pressed={regions.includes(row.owNfz)} onClick={() => onToggle(row.owNfz)} title={titles.get(row.owNfz)}>{names.get(row.owNfz)}</button></td>
              {heat.map((year) => {
                const value = year.values.get(row.owNfz) ?? 0;
                const pos = position(value, year.national);
                return <td key={year.year} className={styles.heatCell} style={{ background: scaleColor(pos), color: pos > 0.15 ? "#fff" : "#172033" }}>{decimal(value)}</td>;
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
    <p className={base.note}>Średnia Polski w {data.year} r.: {decimal(scale.national)} na 100 tys. Kolor: ile razy więcej albo mniej niż średnia Polski w danym roku. Kliknij województwo na mapie albo w tabeli (do {MAX_REGIONS}), aby zawęzić kartę; obszar obowiązuje też w zakładce „Ośrodki”.</p>
  </section>;
}

function CostSection({ data }: { data: JgpPageData }) {
  const totals = new Map(data.admissions.map((row) => [row.year, row.total]));
  const bars = data.valuePln.map((item) => ({ ...item, perStay: totals.get(item.year) ? item.value / (totals.get(item.year) as number) : null }));
  const max = Math.max(...bars.map((item) => item.value), 1);
  const latest = bars.at(-1);
  const previous = bars.at(-2);
  const perChange = latest?.perStay && previous?.perStay ? ((latest.perStay - previous.perStay) / previous.perStay) * 100 : null;
  return <section className={styles.sec} aria-labelledby="s-koszt">
    <SectionHead id="s-koszt" question="Za ile?" context="Wycena i kwota świadczeń NFZ, wszystkie lata" tag="Lata" />
    <div className={styles.cost}>
      {bars.length ? <div className={styles.costBars} role="img" aria-label={`Kwota świadczeń NFZ za ${data.jgpCode}: ${bars.map((item) => `${item.year} ${millions(item.value)}`).join(", ")}`}>
        {bars.map((item) => <div key={item.year} className={styles.costBar}>
          <span className={styles.costValue}>{decimal(item.value / 1_000_000)} mln</span>
          <span className={styles.costTrack}><span className={`${styles.costFill} ${item.year === data.year ? styles.costFillOn : ""}`} style={{ height: `${(item.value / max) * 100}%` }} /></span>
          <span className={styles.costYear}>{item.year}</span>
          <span className={styles.costPer}>{item.perStay ? `${integer(item.perStay)} zł` : ""}</span>
        </div>)}
      </div> : <p className={base.note}>Brak danych o rozliczeniach w złotych.</p>}
      <dl className={styles.costFacts}>
        <div><dt>Wycena (katalog {data.valuation?.year ?? ""})</dt><dd>{data.valuation?.points ? `${integer(data.valuation.points)} pkt` : "—"}</dd><span>za hospitalizację</span></div>
        <div><dt>Kwota świadczeń {latest?.year ?? ""}</dt><dd>{latest ? millions(latest.value) : "—"}</dd><span>cała Polska</span></div>
        <div><dt>Średnio na hospitalizację {latest?.year ?? ""}</dt><dd>{latest?.perStay ? `${integer(latest.perStay)} zł` : "—"}</dd><span>{perChange === null ? "brak poprzedniego roku" : `${signedPct(perChange)} r/r`}</span></div>
      </dl>
    </div>
    <p className={base.note}>Słupki: kwota świadczeń rozliczonych przez NFZ (zestawienie produktów JGP). Pod słupkiem: średnio na hospitalizację (tylko lata z danymi o hospitalizacjach). Średnia rośnie szybciej niż wycena, gdy rośnie udział droższych świadczeń dodatkowych albo zmienia się wartość punktu.</p>
  </section>;
}

function ProfileSection({ data }: { data: JgpPageData }) {
  const share = (part: number, total: number) => total ? (part / total) * 100 : 0;
  return <section className={styles.sec} aria-labelledby="s-profil">
    <SectionHead id="s-profil" question="Jak przyjmowani są pacjenci?" context="Tryb przyjęcia i śmiertelność w kraju, wszystkie lata" tag="Lata" />
    <ul className={base.legend} aria-label="Legenda">
      <li><span className={`${base.swatch} ${base.segmentUrgent}`} aria-hidden />nagłe</li>
      <li><span className={`${base.swatch} ${base.segmentPlanned}`} aria-hidden />planowe</li>
      <li><span className={`${base.swatch} ${base.segmentOther}`} aria-hidden />pozostałe</li>
    </ul>
    <table className={base.table}>
      <thead><tr><th>Rok</th><th>Struktura przyjęć</th><th className={base.num}>Nagłe</th><th className={base.num}>Planowe</th><th className={base.num}>Śmiertelność</th></tr></thead>
      <tbody>
        {data.admissions.map((row) => <tr key={row.year}>
          <td>{row.year}</td>
          <td><div className={base.stack} role="img" aria-label={`nagłe ${pct(share(row.urgent, row.total))}, planowe ${pct(share(row.planned, row.total))}, pozostałe ${pct(share(row.other, row.total))}`}>
            {row.urgent ? <span className={`${base.segment} ${base.segmentUrgent}`} style={{ width: `${share(row.urgent, row.total)}%` }} /> : null}
            {row.planned ? <span className={`${base.segment} ${base.segmentPlanned}`} style={{ width: `${share(row.planned, row.total)}%` }} /> : null}
            {row.other ? <span className={`${base.segment} ${base.segmentOther}`} style={{ width: `${share(row.other, row.total)}%` }} /> : null}
          </div></td>
          <td className={base.num}>{pct(share(row.urgent, row.total))}</td>
          <td className={base.num}>{pct(share(row.planned, row.total))}</td>
          <td className={base.num}>{row.deaths === undefined ? "—" : pct(share(row.deaths, row.total), 2)}</td>
        </tr>)}
      </tbody>
    </table>
    <p className={base.note}>Nagłe: tryb przyjęcia 2 i 3; planowe: tryb 6. Śmiertelność surowa: zgony w szpitalu podczas hospitalizacji, bez uwzględnienia wieku, stanu pacjentów i zgonów po wypisie.</p>
  </section>;
}

// ——— Ośrodki ———

function ProvidersTab({ data, pool, comparison, selectedRow, scope, filtered, onSelect, onScope, onClear }: {
  data: JgpPageData; pool: JgpProviderRow[]; comparison: JgpProviderRow[]; selectedRow: JgpProviderRow | null; scope: CompareScope; filtered: boolean;
  onSelect: (key: string) => void; onScope: (scope: CompareScope) => void; onClear: () => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const top = pool.slice(0, TOP_LINES);
  const lines = useMemo((): ChartLine[] => {
    const shown = selectedRow && !top.includes(selectedRow) ? [...top, selectedRow] : top;
    return shown.map((row) => ({
      key: row.key,
      name: `${data.providers.indexOf(row) + 1}. ${row.name}`,
      detail: `${formatCityName(row.city)} · OW ${row.voivodeship}`,
      values: row.series,
      tone: row === selectedRow ? "selected" : undefined,
    }));
  }, [top, selectedRow, data.providers]);
  const hoverRow = hoverKey ? data.providers.find((row) => row.key === hoverKey) ?? null : null;
  return <>
    <section className={styles.sec} aria-labelledby="s-czas">
      <SectionHead id="s-czas" question="Ile?" context={`Hospitalizacje miesięcznie, ${Math.min(TOP_LINES, pool.length)} największych ośrodków w ${data.year} r.`} tag="Lata" />
      <GroupLineChart
        months={data.months}
        lines={lines}
        valueLabel="hosp."
        height={300}
        onSelect={onSelect}
        onHover={setHoverKey}
        ariaLabel={`Wykres liniowy: hospitalizacje miesięcznie w ${lines.length} ośrodkach`}
      />
      <ProviderBar
        data={data}
        pool={pool}
        row={hoverRow ?? selectedRow}
        preview={Boolean(hoverRow && hoverRow !== selectedRow)}
        selected={Boolean(selectedRow && (!hoverRow || hoverRow === selectedRow))}
        details={details}
        onDetails={() => setDetails((value) => !value)}
        onClear={() => { setDetails(false); onClear(); }}
      />
      {selectedRow && details ? <ProviderDetails data={data} row={selectedRow} comparison={comparison} scope={scope} onScope={onScope} /> : null}
    </section>
    <RankingSection data={data} pool={pool} selectedRow={selectedRow} filtered={filtered} onSelect={onSelect} onHover={setHoverKey} />
    <HowSection data={data} pool={pool} selectedRow={selectedRow} filtered={filtered} onSelect={onSelect} />
  </>;
}

/** Zwarty pasek ośrodka (jedna linia): najechany albo wybrany; pełne porównanie po „Szczegóły”. */
function ProviderBar({ data, pool, row, preview, selected, details, onDetails, onClear }: {
  data: JgpPageData; pool: JgpProviderRow[]; row: JgpProviderRow | null; preview: boolean; selected: boolean; details: boolean; onDetails: () => void; onClear: () => void;
}) {
  if (!row) return <p className={styles.bar} aria-live="polite"><span className={styles.hint}>Najedź na linię albo wiersz rankingu, żeby zobaczyć ośrodek. Kliknij, żeby go wybrać.</span></p>;
  const group = poolStats(pool);
  const rank = pool.indexOf(row) + 1;
  const change = yearChangePct(row.hospitalizations, row.previousHospitalizations);
  return <p className={`${styles.bar} ${preview ? styles.barPreview : ""}`} aria-live="polite">
    <i className={styles.dot} style={{ background: selected ? "#C65D2E" : "#172033" }} aria-hidden />
    <b>{row.name}</b>
    <span className={styles.hint}>{formatCityName(row.city)} · {row.voivodeship}</span>
    <span className={styles.barChip}><b>{integer(row.hospitalizations)}</b> hosp. {data.year}</span>
    {rank ? <span className={styles.barChip}>miejsce {rank}/{pool.length} · {pct(group.hospitalizations ? (row.hospitalizations / group.hospitalizations) * 100 : 0)}</span> : null}
    <span className={styles.barChip}>r/r {change === null ? "—" : signedPct(change)}</span>
    <span className={styles.barChip}>nagłe {pct(row.urgentPct, 0)} <small>(gr. {pct(group.urgentPct, 0)})</small></span>
    <span className={styles.barChip}>zgony {pct(row.mortalityPct)} <small>(gr. {pct(group.mortalityPct)})</small></span>
    {selected
      ? <><button type="button" className={base.linkButton} onClick={onDetails}>{details ? "Zwiń" : "Szczegóły"}</button><button type="button" className={base.linkButton} aria-label="Usuń wybór" onClick={onClear}>×</button></>
      : <span className={styles.hint}>kliknij, żeby wybrać</span>}
  </p>;
}

function ProviderDetails({ data, row, comparison, scope, onScope }: { data: JgpPageData; row: JgpProviderRow; comparison: JgpProviderRow[]; scope: CompareScope; onScope: (scope: CompareScope) => void }) {
  const group = poolStats(comparison);
  const position = comparison.indexOf(row) + 1;
  const nationalValue = data.valuePln.find((item) => item.year === data.year)?.value;
  const label = scope === "peers" ? "podobne" : "grupa";
  return <div className={styles.details} aria-label="Szczegóły wybranego ośrodka" role="region">
    <div className={base.segmented} role="group" aria-label="Porównaj z">
      <button type="button" aria-pressed={scope === "all"} onClick={() => onScope("all")}>Wszystkie ośrodki ({integer(data.providerCount)})</button>
      <button type="button" aria-pressed={scope === "peers"} disabled={!row.peers.length} onClick={() => onScope("peers")}>Podobne szpitale ({row.peers.length})</button>
    </div>
    <dl className={base.selectedMetrics}>
      <div><dt>Miejsce</dt><dd>{position} / {integer(comparison.length)}</dd><span>{scope === "peers" ? "wśród podobnych szpitali" : "w grupie"}</span></div>
      <div><dt>Hospitalizacje</dt><dd>{integer(row.hospitalizations)}</dd><span>{pct(group.hospitalizations ? (row.hospitalizations / group.hospitalizations) * 100 : 0)} {scope === "peers" ? "podobnych" : "grupy"}</span></div>
      <div><dt>Przyjęcia nagłe</dt><dd>{pct(row.urgentPct)}</dd><span>{label}: {pct(group.urgentPct)}</span></div>
      <div><dt>Śmiertelność</dt><dd>{pct(row.mortalityPct)}</dd><span>{label}: {pct(group.mortalityPct)}</span></div>
      {row.valuePln !== null ? <div><dt>Rozliczenia NFZ za {data.jgpCode}</dt><dd>{millions(row.valuePln)}</dd><span>{nationalValue ? `${pct((row.valuePln / nationalValue) * 100)} kraju` : ""}</span></div> : null}
    </dl>
    <p className={base.note}>{row.peers.length ? `Podobne szpitale: ${row.peers.length} z modelu par (klasa A), które leczą w tej grupie.` : "Model par nie wskazał podobnych szpitali w tej grupie."} <Link href={hospitalHref(row.owNfz, row.nip)}>Profil szpitala →</Link></p>
  </div>;
}

/** Mini-trend: hospitalizacje miesięcznie w skali wiersza (kształt, nie wielkość). */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values.map((value, i) => `${((i / Math.max(values.length - 1, 1)) * 80).toFixed(1)},${(20 - (value / max) * 18).toFixed(1)}`).join(" ");
  return <svg className={styles.spark} viewBox="0 0 80 22" aria-hidden><polyline points={points} fill="none" stroke="#2856A3" strokeWidth="1.4" /></svg>;
}

function RankingSection({ data, pool, selectedRow, filtered, onSelect, onHover }: {
  data: JgpPageData; pool: JgpProviderRow[]; selectedRow: JgpProviderRow | null; filtered: boolean; onSelect: (key: string) => void; onHover: (key: string | null) => void;
}) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const visible = mounted ? pool : pool.slice(0, SERVER_ROWS);
  const total = pool.reduce((sum, row) => sum + row.hospitalizations, 0);
  const shares = structureShares(pool);
  const colors = ["#2856A3", "#6F8FC9", "#A9BCE0"];
  const previousYear = data.admissionYears.at(-2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    const box = scrollRef.current;
    const row = selectedRef.current;
    if (!box || !row) return;
    const header = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    box.scrollTop = Math.max(0, row.offsetTop - header - box.clientHeight / 2 + row.clientHeight / 2);
  }, [selectedRow, pool]);
  return <section className={styles.sec} aria-labelledby="s-kto">
    <SectionHead id="s-kto" question="Kto leczy?" context={`Ośrodki w ${data.year} r.`} tag="Rok + mini-trend" />
    <div className={styles.struct}>
      <div className={styles.structBar} role="img" aria-label={shares.map((item) => `${item.label}: ${pct(item.share)}`).join(", ")}>
        {shares.map((item, i) => <span key={item.label} style={{ flex: Math.max(item.share, 0.5), background: colors[i] }} title={`${item.label}: ${pct(item.share)}`}>{item.share > 12 ? `${item.label} · ${pct(item.share, 0)}` : ""}</span>)}
      </div>
      <p className={styles.structText}><span><b>{integer(pool.length)}</b> ośrodków{filtered ? " po filtrach karty" : ""}</span>{shares.map((item) => <span key={item.label}>{item.label}: <b>{pct(item.share)}</b></span>)}</p>
    </div>
    <div ref={scrollRef} className={base.scrollTable} tabIndex={0} role="region" aria-label={`Lista ośrodków: ${pool.length}`} onMouseLeave={() => onHover(null)}>
      <table className={base.table}>
        <thead><tr>
          <th>#</th><th>Ośrodek</th>
          {previousYear ? <th className={base.num}>{previousYear}</th> : null}
          <th className={base.num}>{data.year}</th><th className={base.num}>r/r</th><th className={base.num}>Udział</th><th>Trend</th>
          <th className={base.num}>Nagłe</th><th className={base.num}>Śmiertelność</th>
        </tr></thead>
        <tbody>
          {visible.map((row) => {
            const isSelected = row === selectedRow;
            const change = yearChangePct(row.hospitalizations, row.previousHospitalizations);
            return <tr
              key={row.key}
              ref={isSelected ? selectedRef : undefined}
              className={`${styles.rankRow} ${isSelected ? base.rowSelected : ""}`}
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => onSelect(row.key)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.key); } }}
              onMouseEnter={() => onHover(row.key)}
            >
              <td>{data.providers.indexOf(row) + 1}</td>
              <td className={styles.nameCell}><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /><small>{formatCityName(row.city)} · {row.voivodeship}</small></td>
              {previousYear ? <td className={base.num}>{row.previousHospitalizations === null ? "—" : integer(row.previousHospitalizations)}</td> : null}
              <td className={base.num}>{integer(row.hospitalizations)}</td>
              <td className={base.num}>{row.previousHospitalizations === 0 ? "nowy" : change === null ? "—" : signedPct(change)}</td>
              <td className={base.num}>{pct(total ? (row.hospitalizations / total) * 100 : 0)}</td>
              <td><Spark values={row.series} /></td>
              <td className={base.num}>{pct(row.urgentPct, 0)}</td>
              <td className={base.num}>{pct(row.mortalityPct)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <p className={base.note}>Wszystkie ośrodki z hospitalizacjami w {data.year} r.; przewijanie w tabeli. Numer = miejsce w kraju. Kliknięcie wiersza wybiera ośrodek (nazwa prowadzi do profilu szpitala). Mini-trend: miesiące wszystkich lat, skala wiersza.</p>
  </section>;
}

function HowSection({ data, pool, selectedRow, filtered, onSelect }: { data: JgpPageData; pool: JgpProviderRow[]; selectedRow: JgpProviderRow | null; filtered: boolean; onSelect: (key: string) => void }) {
  const stats = poolStats(pool);
  const point = (row: JgpProviderRow, y: number, line: string, color?: string): ScatterPoint => ({
    key: row.key, name: row.name, lines: [`${formatCityName(row.city)} · OW ${row.voivodeship}`, line], x: row.hospitalizations, y, selected: row === selectedRow, color,
  });
  const urgency = useMemo(() => pool.map((row) => point(row, row.urgentPct, `${integer(row.hospitalizations)} hosp. · nagłe ${pct(row.urgentPct)}`)), [pool, selectedRow]); // eslint-disable-line react-hooks/exhaustive-deps
  const showFunnel = stats.deaths >= MIN_FUNNEL_DEATHS;
  const funnel = useMemo(() => {
    if (!showFunnel) return { points: [], curves: [] as ScatterCurve[] };
    const points = pool.map((row) => {
      const status = funnelStatus(row.mortalityPct, stats.mortalityPct, row.hospitalizations);
      const color = status === "powyżej 99,8%" ? FUNNEL_COLORS.up998 : status === "powyżej 95%" ? FUNNEL_COLORS.up95 : status === "poniżej 99,8%" ? FUNNEL_COLORS.down998 : status === "poniżej 95%" ? FUNNEL_COLORS.down95 : undefined;
      return point(row, row.mortalityPct, `${integer(row.deaths)} zgonów · ${pct(row.mortalityPct)} · ${status}`, color);
    });
    const xMax = Math.max(...pool.map((row) => row.hospitalizations), 10);
    const c = funnelCurves(stats.mortalityPct, Math.max(5, Math.round(xMax * 0.01)), Math.round(xMax * 1.05));
    const curves: ScatterCurve[] = [
      { x: c.x, y: c.inner[0], color: "#98A2B3", dash: "dot" }, { x: c.x, y: c.inner[1], color: "#98A2B3", dash: "dot" },
      { x: c.x, y: c.outer[0], color: "#667085", dash: "dash" }, { x: c.x, y: c.outer[1], color: "#667085", dash: "dash" },
    ];
    return { points, curves };
  }, [pool, selectedRow, showFunnel, stats.mortalityPct]); // eslint-disable-line react-hooks/exhaustive-deps
  const referenceUrgent = useMemo(() => ({ y: stats.urgentPct, label: `${filtered ? "wybrane" : "grupa"}: ${pct(stats.urgentPct)}` }), [stats.urgentPct, filtered]);
  const referenceMortality = useMemo(() => ({ y: stats.mortalityPct, label: `${filtered ? "wybrane" : "grupa"}: ${pct(stats.mortalityPct)}` }), [stats.mortalityPct, filtered]);
  return <section className={styles.sec} aria-labelledby="s-jak">
    <SectionHead id="s-jak" question="Jak leczą?" context={`Ośrodki w ${data.year} r.`} tag="Rok" />
    <div className={styles.two}>
      <div>
        <h3 className={base.chartTitle}>Udział przyjęć nagłych</h3>
        <ProviderScatter points={urgency} xTitle="Hospitalizacje" yTitle="Nagłe" ySuffix="%" reference={referenceUrgent} onSelect={onSelect} height={300} ariaLabel={`Wykres punktowy: ${pool.length} ośrodków, liczba hospitalizacji i udział przyjęć nagłych`} />
      </div>
      <div>
        <h3 className={base.chartTitle}>Śmiertelność: wykres lejkowy</h3>
        {showFunnel
          ? <ProviderScatter points={funnel.points} curves={funnel.curves} xTitle="Hospitalizacje" yTitle="Śmiertelność" ySuffix="%" reference={referenceMortality} onSelect={onSelect} height={300} ariaLabel={`Wykres lejkowy: ${pool.length} ośrodków, śmiertelność względem liczby hospitalizacji`} />
          : <p className={base.note}>Grupa ma mniej niż {MIN_FUNNEL_DEATHS} zgonów w {data.year} r. ({integer(stats.deaths)}), więc lejka nie pokazujemy: przy tak rzadkich zgonach różnice między ośrodkami są głównie przypadkowe.</p>}
        {showFunnel ? <ul className={base.legend} aria-label="Legenda lejka">
          <li><span className={base.swatch} style={{ background: "rgba(40, 86, 163, 0.55)" }} aria-hidden />w granicach</li>
          <li><span className={base.swatch} style={{ background: FUNNEL_COLORS.up95 }} aria-hidden />powyżej 95%</li>
          <li><span className={base.swatch} style={{ background: FUNNEL_COLORS.up998 }} aria-hidden />powyżej 99,8%</li>
          <li><span className={base.swatch} style={{ background: FUNNEL_COLORS.down998 }} aria-hidden />poniżej granic</li>
        </ul> : null}
      </div>
    </div>
    <p className={base.note}>Lejek: linia środkowa to śmiertelność grupy, linie przerywane to granice 95% i 99,8% dla danej liczby hospitalizacji. Mały ośrodek ma szersze granice. Punkt poza granicą to sygnał do sprawdzenia, nie ocena jakości: śmiertelność jest surowa, a wartości &lt;5 są szacowane. Kliknięcie punktu wybiera ośrodek.</p>
  </section>;
}
