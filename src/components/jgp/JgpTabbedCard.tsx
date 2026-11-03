"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GroupLineChart, type ChartLine } from "@/components/jgp/GroupLineChart";
import { RegionMap, SELECTED_PROVIDER_PARAM, regionTitle } from "@/components/jgp/JgpCard";
import { ProviderScatter, STAR_COLOR, type ScatterCurve, type ScatterPoint } from "@/components/jgp/ProviderScatter";
import { ProviderLink } from "@/components/TableLinks";
import { formatCityName } from "@/lib/formatters";
import {
  cartogramCells, dataForYear, defaultCardYear, funnelCurves, funnelStatus, limitToCatalogYears, MAX_REGIONS, MIN_FUNNEL_DEATHS, poolStats, providerPool, providerYearTotals, scaleColor, selectedIndex,
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
const YEAR_PARAM = "rok";
const TOP_LINES = 15;
const SERVER_ROWS = 30;
const subscribeNothing = () => () => {};
// Kolory lejka: poza granicą 95% i 99,8% (w górę i w dół).
// Kolory wybranych województw (mapa, wykresy punktowe, tabela): kontrastowe wobec niebieskiej skali mapy,
// bez czerwieni i pomarańczu (zarezerwowanych dla wybranego ośrodka). Sprawdzone walidatorem palety
// (jasność, nasycenie, odstęp ΔE ≥ 15 przy normalnym widzeniu; dla daltonizmu dodatkowo podpisy w legendzie).
const REGION_PICK_COLORS = ["#7B3FA0", "#1A9850", "#D6338A", "#B88A00", "#0097A7", "#9A5B13"];
// Ośrodki spoza wybranych województw na wykresach „Jak leczą?”.
const OTHER_POINT = "rgba(152, 162, 179, 0.5)";
/** Kolor każdego wybranego województwa (kolejność wyboru), ten sam na mapie, wykresach i w tabeli. */
const regionColors = (regions: string[]) => new Map(regions.map((ow, i) => [ow, REGION_PICK_COLORS[i % REGION_PICK_COLORS.length]]));
const FUNNEL_COLORS = { up95: "#E3A27F", up998: "#B4441B", down95: "#8FB0DD", down998: "#2856A3" };

export type CardTab = "przeglad" | "osrodki";

/** `year`: rok danych karty; `null` = rok domyślny (najnowszy rok grupy, bez parametru w adresie). */
interface CardState { tab: CardTab; selectedKey: string | null; scope: CompareScope; regions: string[]; year: string | null }

// Strona jest statyczna: stan czytamy i zapisujemy w adresie w przeglądarce.
function useTabbedState(data: JgpPageData, defaultYear: string) {
  const [state, setState] = useState<CardState>({ tab: "przeglad", selectedKey: null, scope: "all", regions: [], year: null });
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
        year: data.admissionYears.includes(params.get(YEAR_PARAM) ?? "") && params.get(YEAR_PARAM) !== defaultYear ? params.get(YEAR_PARAM) : null,
      });
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [data.regions, data.admissionYears, defaultYear]);

  // Aktualny stan w refie: adres zapisujemy poza funkcją aktualizującą stan (zapis adresu odświeża router Next).
  const current = useRef(state);
  useEffect(() => { current.current = state; }, [state]);
  const write = useCallback((patch: Partial<CardState>) => {
    const previous = current.current;
    const next = { ...previous, ...patch };
    // Ośrodek przestaje być wybrany, gdy jego województwo przestaje być aktywne (odznaczone albo „Wyczyść wybór”)
    // albo gdy wybrane są tylko inne województwa — inaczej zostawałby na wykresach.
    const ow = next.selectedKey?.split("|")[0];
    if (patch.regions && ow && !next.regions.includes(ow) && (previous.regions.includes(ow) || next.regions.length > 0)) next.selectedKey = null;
    if (!next.selectedKey) next.scope = "all";
    current.current = next;
    const url = new URL(window.location.href);
    const set = (name: string, value: string | null) => value ? url.searchParams.set(name, value) : url.searchParams.delete(name);
    set(TAB_PARAM, next.tab === "osrodki" && !next.selectedKey ? "osrodki" : null);
    set(SELECTED_PROVIDER_PARAM, next.selectedKey);
    set(SCOPE_PARAM, next.selectedKey && next.scope === "peers" ? "podobne" : null);
    url.searchParams.delete(REGION_PARAM);
    for (const ow of next.regions) url.searchParams.append(REGION_PARAM, ow);
    set(YEAR_PARAM, next.year);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setState(next);
  }, []);
  return { state, write };
}

/** Karta grupy JGP w zakładkach „Przegląd” i „Ośrodki” (układ z docs/karta-jgp-pytania.html). */
export function JgpTabbedCard({ packed, map = null }: { packed: PackedJgpPageData; map?: RegionsMap | null }) {
  const all = useMemo(() => limitToCatalogYears(unpackPageData(packed)), [packed]);
  const defaultYear = defaultCardYear(all);
  const { state, write } = useTabbedState(all, defaultYear);
  // Dane wybranego roku: ranking, liczby i województwa; wykresy „w czasie” pokazują wszystkie lata.
  const yearIndex = all.admissionYears.indexOf(state.year ?? defaultYear);
  const data = useMemo(() => dataForYear(all, yearIndex), [all, yearIndex]);
  const selected = selectedIndex(data, state.selectedKey);
  const selectedRow = selected >= 0 ? data.providers[selected] : null;
  const scope: CompareScope = selectedRow && selectedRow.peers.length ? state.scope : "all";
  const pool = useMemo(() => providerPool(data, { selectedKey: state.selectedKey, scope, regions: state.regions }), [data, state.selectedKey, scope, state.regions]);
  const comparison = useMemo(() => providerPool(data, { selectedKey: state.selectedKey, scope, regions: [] }), [data, state.selectedKey, scope]);
  // Linie województw w „Ile?” pokazują wszystkie lata, więc liczymy je z ośrodków wszystkich lat (nie zależą od wybranego roku).
  const linePool = useMemo(() => providerPool(all, { selectedKey: state.selectedKey, scope, regions: state.regions }), [all, state.selectedKey, scope, state.regions]);
  // Czy nagłówek karty zniknął pod nagłówkiem portalu (75 px): wtedy pasek pokazuje kod i nazwę grupy.
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 76), { rootMargin: "-76px 0px 0px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // „Ośrodki w wybranych województwach”: zakładka Ośrodki i przewinięcie do tabeli „Kto leczy?”.
  const scrollPending = useRef(false);
  const showProviders = useCallback(() => {
    scrollPending.current = true;
    write({ tab: "osrodki" });
  }, [write]);
  // Przewijamy po zmianie zakładki do sekcji „Kto leczy?” (tabela ośrodków), tuż pod paskiem zakładek.
  // useLayoutEffect: przewinięcie przed narysowaniem klatki, bez mignięcia zakładki w starym miejscu.
  useLayoutEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    const target = document.getElementById("s-kto")?.closest("section");
    if (!target) return;
    const header = window.matchMedia?.("(max-width: 700px)").matches ? 67 : 75;
    const bar = document.querySelector('[role="tablist"]')?.parentElement?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - header - bar - 12) });
  }, [state.tab]);
  const toggleRegion = useCallback((ow: string) => {
    const regions = state.regions.includes(ow) ? state.regions.filter((item) => item !== ow) : state.regions.length < MAX_REGIONS ? [...state.regions, ow] : state.regions;
    write({ regions });
  }, [state.regions, write]);

  return <>
    <CardHeader data={data} regions={state.regions} onClearRegion={(ow) => write({ regions: state.regions.filter((item) => item !== ow) })} />
    <div ref={sentinel} aria-hidden />
    <div className={`${styles.tabbar} ${stuck ? styles.tabbarStuck : ""}`}>
      {/* Po przewinięciu nagłówka karty kod i nazwa grupy zostają na pasku (jeden pasek pod nagłówkiem portalu). */}
      <span className={styles.barTitle} aria-hidden={!stuck}><b>{all.jgpCode}</b> {all.name}</span>
      <div className={styles.tabs} role="tablist" aria-label="Zakładki karty">
        <button type="button" role="tab" id="tab-przeglad" aria-controls="panel-przeglad" aria-selected={state.tab === "przeglad"} onClick={() => write({ tab: "przeglad" })}>
          Przegląd
        </button>
        <button type="button" role="tab" id="tab-osrodki" aria-controls="panel-osrodki" aria-selected={state.tab === "osrodki"} onClick={() => write({ tab: "osrodki" })}>
          Ośrodki<small>{integer(pool.length)}</small>
        </button>
      </div>
      <div className={styles.years} role="group" aria-label="Rok karty">
        <span>Rok</span>
        {(all.admissionYears.length ? all.admissionYears : [all.year]).map((year) => <button
          key={year}
          type="button"
          aria-pressed={year === data.year}
          onClick={() => write({ year: year === defaultYear ? null : year })}
        >{year}</button>)}
      </div>
    </div>
    {state.tab === "przeglad"
      ? <div role="tabpanel" id="panel-przeglad" aria-labelledby="tab-przeglad" className={styles.panel}>
        <OverviewTab
          data={data}
          pool={pool}
          linePool={linePool}
          map={map}
          regions={state.regions}
          onToggleRegion={toggleRegion}
          onYear={(year) => write({ year: year === all.year ? null : year })}
          onRegionYear={(ow, year) => write({ year: year === all.year ? null : year, regions: state.regions.includes(ow) || state.regions.length >= MAX_REGIONS ? state.regions : [...state.regions, ow] })}
          onClearRegions={() => write({ regions: [] })}
          onShowProviders={showProviders}
        />
      </div>
      : <div role="tabpanel" id="panel-osrodki" aria-labelledby="tab-osrodki" className={styles.panel}>
        <ProvidersTab
          data={data}
          pool={pool}
          comparison={comparison}
          regions={state.regions}
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
  const at = years.findIndex((row) => row.year === data.year);
  const latest = at >= 0 ? years[at] : undefined;
  const previous = at > 0 ? years[at - 1] : undefined;
  const rate = (point?: { total: number; deaths?: number }) => point && point.total && point.deaths !== undefined ? (point.deaths / point.total) * 100 : null;
  const latestRate = rate(latest);
  const previousRate = rate(previous);
  const valueAt = data.valuePln.findIndex((item) => item.year === data.year);
  const value = valueAt >= 0 ? data.valuePln[valueAt] : undefined;
  const valuePrevious = valueAt > 0 ? data.valuePln[valueAt - 1] : undefined;
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
      {data.description ? <p className={styles.desc}>{data.description} <small>(opis redakcyjny; słownik NFZ podaje tylko nazwę grupy)</small></p> : null}
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
    </div>
    <dl className={styles.kpis} aria-label="Liczby grupy">
      <div><dt>Hospitalizacje {data.year}</dt><dd>{integer(data.hospitalizations)}</dd><span>{change === null ? "pierwszy rok" : `${signedPct(change)} r/r`}</span></div>
      <div><dt>Kwota świadczeń NFZ {data.year}</dt><dd>{value ? millions(value.value) : "—"}</dd><span>{value && valuePrevious ? `${signedPct(((value.value - valuePrevious.value) / valuePrevious.value) * 100)} r/r` : "brak poprzedniego roku"}</span></div>
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

type Metric = "hospitalizations" | "mortality" | "urgent";

// Miary wykresu „Ile?”: przycisk, tytuł sekcji, jednostka w podpowiedzi i objaśnienie pod osią.
const METRICS: Record<Metric, { button: string; title: string; unit: string; note: string }> = {
  hospitalizations: { button: "Hospitalizacje", title: "Hospitalizacje miesięcznie", unit: "hosp.", note: "Kropka = miesiąc, linia = średnia z 3 miesięcy. Miesiące według daty wypisu, wartości <5 liczone jako 1." },
  mortality: { button: "Śmiertelność", title: "Śmiertelność miesięcznie", unit: "zgonów", note: "Zgony w szpitalu / hospitalizacje. Linia = udział z 3 miesięcy, miesiące według daty wypisu." },
  urgent: { button: "% nagłych", title: "Udział przyjęć nagłych miesięcznie", unit: "nagłych", note: "Przyjęcia nagłe (tryb 2 i 3) / hospitalizacje. Linia = udział z 3 miesięcy, miesiące według daty wypisu." },
};

function OverviewTab({ data, pool, linePool, map, regions, onToggleRegion, onYear, onRegionYear, onClearRegions, onShowProviders }: {
  data: JgpPageData; pool: JgpProviderRow[]; linePool: JgpProviderRow[]; map: RegionsMap | null; regions: string[]; onToggleRegion: (ow: string) => void; onYear: (year: string) => void;
  onRegionYear: (ow: string, year: string) => void; onClearRegions: () => void; onShowProviders: () => void;
}) {
  const [metric, setMetric] = useState<Metric>("hospitalizations");
  const lines = useMemo((): ChartLine[] => {
    if (regions.length) return regions.map((ow, i) => {
      const rows = linePool.filter((row) => row.owNfz === ow);
      const name = data.regions.find((row) => row.owNfz === ow)?.name ?? ow;
      return { key: ow, name, values: sumSeries(rows, data.months.length), color: REGION_PICK_COLORS[i % REGION_PICK_COLORS.length] };
    });
    const { hospitalizations, deaths, urgent } = data.national;
    if (metric === "hospitalizations") return [{ key: "pl", name: "Cała Polska", values: hospitalizations, tone: "primary" }];
    return [{ key: "pl", name: "Cała Polska", values: metric === "mortality" ? deaths : urgent, base: hospitalizations, tone: "primary" }];
  }, [data, linePool, regions, metric]);
  // Województwa mają tylko liczby hospitalizacji miesięcznie, więc przy wybranych województwach wykres pokazuje liczby.
  const shown = METRICS[regions.length ? "hospitalizations" : metric];
  return <>
    <section className={styles.sec} aria-labelledby="s-ile">
      <SectionHead id="s-ile" question="Ile?" context={`${regions.length ? "Hospitalizacje w wybranych województwach miesięcznie" : shown.title}, wszystkie lata`} tag="Lata" />
      {!regions.length ? <div className={base.segmented} role="group" aria-label="Miara">
        {(Object.keys(METRICS) as Metric[]).map((key) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{METRICS[key].button}</button>)}
      </div> : null}
      <GroupLineChart months={data.months} lines={lines} valueLabel={shown.unit} legend={regions.length > 0} height={420} highlightYear={data.year} fitAxis={!regions.length && metric === "urgent"} note={shown.note} ariaLabel={`Wykres liniowy: ${shown.title.toLowerCase()} we wszystkich latach`} />
    </section>
    <RegionsSection data={data} pool={pool} map={map} regions={regions} onToggle={onToggleRegion} onYear={onYear} onRegionYear={onRegionYear} onClear={onClearRegions} onShowProviders={onShowProviders} />
    <CostSection data={data} onYear={onYear} />
    <ProfileSection data={data} />
    {data.family ? <FamilySection data={data} /> : null}
  </>;
}

/** Od tylu lat mapa ciepła ma wąskie kolumny i krótkie lata. */
const HEAT_COMPACT_YEARS = 5;

function RegionsSection({ data, pool, map, regions, onToggle, onYear, onRegionYear, onClear, onShowProviders }: {
  data: JgpPageData; pool: JgpProviderRow[]; map: RegionsMap | null; regions: string[]; onToggle: (ow: string) => void; onYear: (year: string) => void;
  onRegionYear: (ow: string, year: string) => void; onClear: () => void; onShowProviders: () => void;
}) {
  const { cells, scale } = cartogramCells(data.regions);
  const names = new Map(data.regions.map((row) => [row.owNfz, row.name]));
  const titles = new Map(cells.map((cell) => [cell.owNfz, regionTitle(cell)]));
  // Mapa ciepła: wskaźnik województwa jako wielokrotność średniej Polski w danym roku (ta sama skala co mapa).
  const people = data.regions.reduce((sum, row) => sum + row.population, 0);
  // Tylko lata, które karta umie pokazać (rok z pliku grupy); bez pliku – wszystkie lata trendów.
  const cardYears = new Set(data.admissionYears.length ? data.admissionYears : data.regionYears.map((year) => year.year));
  const heat = data.regionYears.filter((year) => cardYears.has(year.year)).map((year) => {
    const national = people ? (year.rows.reduce((sum, row) => sum + row[2], 0) / people) * 100_000 : 0;
    return { year: year.year, national, values: new Map(year.rows.map(([ow, per100k]) => [ow, per100k])) };
  });
  const position = (value: number, national: number) => value > 0 && national > 0 ? Math.max(-1, Math.min(1, Math.log2(value / national))) : -1;
  const first = heat[0];
  const last = heat.at(-1);
  // Położenie tła kolumny wybranego roku: od nagłówka roku do komórki w ostatnim wierszu (mierzone po narysowaniu i przy zmianie rozmiaru).
  const heatRef = useRef<HTMLTableElement>(null);
  const [band, setBand] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const table = heatRef.current;
    if (!table) return;
    const measure = () => {
      const cells = table.querySelectorAll<HTMLElement>(`[data-year="${data.year}"]`);
      const first = cells[0];
      const last = cells[cells.length - 1];
      if (!first || !last) { setBand(null); return; }
      const box = table.getBoundingClientRect();
      const a = first.getBoundingClientRect();
      const b = last.getBoundingClientRect();
      setBand({ left: a.left - box.left + table.offsetLeft, top: a.top - box.top + table.offsetTop, width: a.width, height: b.bottom - a.top });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    // Także nagłówki lat: zmiana szerokości kolumny nie zawsze zmienia rozmiar tabeli.
    observer.observe(table);
    table.querySelectorAll("th[data-year]").forEach((cell) => observer.observe(cell));
    return () => observer.disconnect();
  }, [data.year, data.regions]);
  // Wiersze alfabetycznie (łatwiej znaleźć województwo); kolor pokazuje kolejność.
  const rows = [...data.regions].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const compact = heat.length >= HEAT_COMPACT_YEARS;
  return <section className={styles.sec} aria-labelledby="s-gdzie">
    <SectionHead id="s-gdzie" question="Gdzie?" context={`Szpitale w województwie na 100 tys. mieszkańców: mapa ${data.year}, mapa ciepła lat`} tag="Mapa: rok · tabela: lata" />
    {/* Przy wielu latach mapa ciepła jest ścieśniona (wąskie kolumny, rok jako „’17”), żeby mieściła się obok mapy. */}
    <div className={`${styles.geo} ${compact ? styles.geoCompact : ""}`}>
      <div className={styles.mapCol}>
        {map ? <RegionMap map={map} cells={cells} regions={regions} onToggle={onToggle} colors={REGION_PICK_COLORS} /> : null}
        <div className={base.scale}>
          <span>½ × średniej</span>
          <i className={base.scaleGradient} style={{ background: `linear-gradient(90deg, ${scaleColor(-1)}, ${scaleColor(0)}, ${scaleColor(1)})` }} aria-hidden />
          <span>2 × średniej</span>
        </div>
        <div className={styles.mapInfo} aria-live="polite">
          {regions.length
            ? <>
              <span>Wybrane: <b>{regions.map((ow) => (names.get(ow) ?? ow).toLocaleLowerCase("pl-PL")).join(", ")}</b> · {integer(pool.length)} ośrodków</span>
              <span className={styles.mapActions}>
                <button type="button" className={styles.primaryLink} onClick={onShowProviders}>Ośrodki w {regions.length > 1 ? "wybranych województwach" : `województwie ${(names.get(regions[0]) ?? "").toLocaleLowerCase("pl-PL")}`} →</button>
                <button type="button" className={base.linkButton} onClick={onClear}>Wyczyść wybór ({regions.length})</button>
              </span>
            </>
            : <span>Kliknij województwo na mapie albo w tabeli, żeby zawęzić kartę (do {MAX_REGIONS} naraz).</span>}
        </div>
      </div>
      <div className={styles.heatWrap} role="region" aria-label="Mapa ciepła: województwa w latach" tabIndex={0}>
        {/* Jedno tło całej kolumny wybranego roku (od nagłówka do ostatniego wiersza), jak „wybrany rok” na wykresie liniowym. */}
        {band ? <div className={styles.heatBand} style={band} aria-hidden /> : null}
        <table ref={heatRef} className={`${styles.heat} ${compact ? styles.heatCompact : ""}`}>
          <thead><tr>
            <th>Województwo</th>
            {heat.map((year) => <th key={year.year} className={`${base.num} ${styles.yearCell}`} data-year={year.year}>
              <button type="button" className={`${styles.yearHead} ${year.year === data.year ? styles.heatOn : ""}`} aria-pressed={year.year === data.year} onClick={() => onYear(year.year)} title={`Pokaż mapę za ${year.year} r.`}>{compact ? `’${year.year.slice(2)}` : year.year}</button>
            </th>)}
            {heat.length > 1 ? <th className={`${base.num} ${styles.heatChange}`}>{first?.year.slice(2)}→{last?.year.slice(2)}</th> : null}
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const a = first?.values.get(row.owNfz) ?? 0;
              const b = last?.values.get(row.owNfz) ?? 0;
              const change = a ? ((b - a) / a) * 100 : null;
              return <tr key={row.owNfz} className={regions.includes(row.owNfz) ? base.rowSelected : undefined}>
                <td><button type="button" className={styles.linkCell} aria-pressed={regions.includes(row.owNfz)} onClick={() => onToggle(row.owNfz)} title={titles.get(row.owNfz)}>{names.get(row.owNfz)}</button></td>
                {heat.map((year) => {
                  const value = year.values.get(row.owNfz) ?? 0;
                  const pos = position(value, year.national);
                  return <td key={year.year} data-year={year.year} className={styles.heatCell} style={{ background: scaleColor(pos), color: pos > 0.15 ? "#fff" : "#172033" }}>
                    <button type="button" className={styles.heatButton} onClick={() => onRegionYear(row.owNfz, year.year)} title={`${names.get(row.owNfz)} ${year.year}: ${decimal(value)} na 100 tys. — kliknij, żeby pokazać ten rok i województwo`}>{decimal(value)}</button>
                  </td>;
                })}
                {heat.length > 1 ? <td className={`${base.num} ${styles.heatChange}`}>{change === null ? "—" : signedPct(change)}</td> : null}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
    <p className={base.note}>Liczba: hospitalizacje na 100 tys. mieszkańców; kolor: ile razy więcej albo mniej niż średnia Polski w danym roku (średnia w {data.year} r.: {decimal(scale.national)}). Kliknięcie roku w tabeli zmienia rok mapy i całej karty; kliknięcie komórki dodatkowo wybiera województwo.</p>
  </section>;
}

function CostSection({ data, onYear }: { data: JgpPageData; onYear: (year: string) => void }) {
  const totals = new Map(data.admissions.map((row) => [row.year, row.total]));
  const bars = data.valuePln.map((item) => ({ ...item, perStay: totals.get(item.year) ? item.value / (totals.get(item.year) as number) : null }));
  const max = Math.max(...bars.map((item) => item.value), 1);
  const at = bars.findIndex((item) => item.year === data.year);
  const latest = at >= 0 ? bars[at] : bars.at(-1);
  const previous = at > 0 ? bars[at - 1] : undefined;
  const perChange = latest?.perStay && previous?.perStay ? ((latest.perStay - previous.perStay) / previous.perStay) * 100 : null;
  return <section className={styles.sec} aria-labelledby="s-koszt">
    <SectionHead id="s-koszt" question="Za ile?" context="Wycena i kwota świadczeń NFZ, wszystkie lata" tag="Lata" />
    <div className={styles.cost}>
      {bars.length ? <div className={styles.costBars} role="img" aria-label={`Kwota świadczeń NFZ za ${data.jgpCode}: ${bars.map((item) => `${item.year} ${millions(item.value)}`).join(", ")}`}>
        {bars.map((item) => <div key={item.year} className={`${styles.costBar} ${item.perStay ? styles.costBarPick : ""}`} onClick={item.perStay ? () => onYear(item.year) : undefined} title={item.perStay ? `Pokaż kartę za ${item.year} r.` : undefined}>
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
    <div className={styles.scrollX}><table className={base.table}>
      <thead><tr><th>Rok</th><th>Struktura przyjęć</th><th className={base.num}>Nagłe</th><th className={base.num}>Planowe</th><th className={base.num}>Śmiertelność</th></tr></thead>
      <tbody>
        {data.admissions.map((row) => <tr key={row.year} className={row.year === data.year ? base.rowSelected : undefined}>
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
    </table></div>
    <p className={base.note}>Nagłe: tryb przyjęcia 2 i 3; planowe: tryb 6. Śmiertelność surowa: zgony w szpitalu podczas hospitalizacji, bez uwzględnienia wieku, stanu pacjentów i zgonów po wypisie.</p>
  </section>;
}

/** Rodzina wariantów: udział każdego wariantu w hospitalizacjach rodziny w każdym roku; ta grupa w ramce. */
function FamilySection({ data }: { data: JgpPageData }) {
  const family = data.family!;
  const years = data.catalogYears;
  const palette = ["#2856A3", "#6F8FC9", "#A9BCE0", "#5B8C7A", "#A3C4B5", "#C9A86A", "#E2CFA3"];
  const color = new Map(family.variants.map((variant, i) => [variant.code, palette[i % palette.length]]));
  const totals = years.map((_, j) => family.variants.reduce((sum, variant) => sum + (variant.values[j] ?? 0), 0));
  const own = family.variants.find((variant) => variant.code === data.jgpCode);
  const share = (value: number | null, j: number) => totals[j] ? ((value ?? 0) / totals[j]) * 100 : 0;
  const first = own ? share(own.values[0], 0) : 0;
  const last = own ? share(own.values.at(-1) ?? null, years.length - 1) : 0;
  return <section className={styles.sec} aria-labelledby="s-rodzina">
    <SectionHead id="s-rodzina" question="Jak wygląda rodzina?" context={`Udziały wariantów: ${family.name.toLocaleLowerCase("pl-PL")}, wszystkie lata`} tag="Lata" />
    {own ? <p className={styles.lead}>{data.jgpCode} to <b>{pct(last, 0)}</b> hospitalizacji rodziny w {years.at(-1)} r.{years.length > 1 ? ` (w ${years[0]} r.: ${pct(first, 0)})` : ""}.</p> : null}
    <ul className={base.legend} aria-label="Warianty rodziny">
      {family.variants.map((variant) => <li key={variant.code} title={variant.name}><span className={base.swatch} style={{ background: color.get(variant.code) }} aria-hidden /><b>{variant.code}</b>&nbsp;{variant.name.toLocaleLowerCase("pl-PL")}</li>)}
    </ul>
    <div className={styles.famRows}>
      {years.map((year, j) => <div key={year} className={styles.famRow}>
        <span className={styles.famYear}>{year}</span>
        <div className={styles.famBar} role="img" aria-label={`${year}: ${family.variants.map((variant) => `${variant.code} ${pct(share(variant.values[j], j))}`).join(", ")}`}>
          {family.variants.map((variant) => {
            const value = share(variant.values[j], j);
            return value > 0 ? <span
              key={variant.code}
              className={variant.code === data.jgpCode ? styles.famOwn : undefined}
              style={{ flex: value, background: color.get(variant.code) }}
              title={`${variant.code} ${variant.name}: ${pct(value)} (${integer(variant.values[j] ?? 0)} hosp.)`}
            >{value >= 9 ? `${variant.code} ${pct(value, 0)}` : ""}</span> : null;
          })}
        </div>
        <span className={styles.famTotal}>{integer(totals[j])}</span>
      </div>)}
    </div>
    <p className={base.note}>Ramka: ta grupa ({data.jgpCode}). Liczba po prawej: hospitalizacje całej rodziny. {family.note ?? ""} Przesunięcie udziałów może wynikać z praktyki leczenia, zmiany katalogu albo sposobu kodowania. Rodziny to lista redakcyjna (na razie dla E10, H52 i H55).</p>
  </section>;
}

// ——— Ośrodki ———

function ProvidersTab({ data, pool, comparison, regions, selectedRow, scope, filtered, onSelect, onScope, onClear }: {
  data: JgpPageData; pool: JgpProviderRow[]; comparison: JgpProviderRow[]; regions: string[]; selectedRow: JgpProviderRow | null; scope: CompareScope; filtered: boolean;
  onSelect: (key: string) => void; onScope: (scope: CompareScope) => void; onClear: () => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  // Stała lista linii przy najechaniu (nowa tablica przerysowywałaby wykres przy każdym ruchu myszy).
  const top = useMemo(() => pool.slice(0, TOP_LINES), [pool]);
  const regionColor = useMemo(() => regionColors(regions), [regions]);
  const lines = useMemo((): ChartLine[] => {
    const shown = selectedRow && !top.includes(selectedRow) ? [...top, selectedRow] : top;
    // Linie ośrodków szare; wybrany ośrodek – czerwona linia z podpisem „★ nazwa”.
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
        selectedColor={STAR_COLOR}
        highlightYear={data.year}
        selectedLabel={selectedRow ? `★ ${selectedRow.name.length > 40 ? `${selectedRow.name.slice(0, 39)}…` : selectedRow.name}` : undefined}
        ariaLabel={`Wykres liniowy: hospitalizacje miesięcznie w ${lines.length} ośrodkach`}
      />
      <ProviderBar
        data={data}
        pool={pool}
        regionColor={regionColor}
        row={hoverRow ?? selectedRow}
        preview={Boolean(hoverRow && hoverRow !== selectedRow)}
        selected={Boolean(selectedRow && (!hoverRow || hoverRow === selectedRow))}
        details={details}
        onDetails={() => setDetails((value) => !value)}
        onClear={() => { setDetails(false); onClear(); }}
      />
      {selectedRow && details ? <ProviderDetails data={data} row={selectedRow} comparison={comparison} scope={scope} onScope={onScope} /> : null}
    </section>
    <RankingSection data={data} pool={pool} selectedRow={selectedRow} filtered={filtered} regionColor={regionColor} onSelect={onSelect} onHover={setHoverKey} />
    <HowSection data={data} rows={comparison} regions={regions} selectedRow={selectedRow} onSelect={onSelect} />
  </>;
}

/** Zwarty pasek ośrodka (jedna linia): najechany albo wybrany; pełne porównanie po „Szczegóły”. */
function ProviderBar({ data, pool, regionColor, row, preview, selected, details, onDetails, onClear }: {
  data: JgpPageData; pool: JgpProviderRow[]; regionColor: Map<string, string>; row: JgpProviderRow | null; preview: boolean; selected: boolean; details: boolean; onDetails: () => void; onClear: () => void;
}) {
  if (!row) return <p className={styles.bar} aria-live="polite"><span className={styles.hint}>Najedź na linię albo wiersz rankingu, żeby zobaczyć ośrodek. Kliknij, żeby go wybrać.</span></p>;
  const group = poolStats(pool);
  const rank = pool.indexOf(row) + 1;
  const change = yearChangePct(row.hospitalizations, row.previousHospitalizations);
  return <p className={`${styles.bar} ${preview ? styles.barPreview : ""}`} aria-live="polite">
    {selected ? <span className={styles.star} aria-hidden>★</span> : <i className={styles.dot} style={{ background: regionColor.get(row.owNfz) ?? "#98A2B3" }} aria-hidden />}
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

function RankingSection({ data, pool, selectedRow, filtered, regionColor, onSelect, onHover }: {
  data: JgpPageData; pool: JgpProviderRow[]; selectedRow: JgpProviderRow | null; filtered: boolean; regionColor: Map<string, string>; onSelect: (key: string) => void; onHover: (key: string | null) => void;
}) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const visible = mounted ? pool : pool.slice(0, SERVER_ROWS);
  const total = pool.reduce((sum, row) => sum + row.hospitalizations, 0);
  const shares = structureShares(pool);
  const colors = ["#2856A3", "#6F8FC9", "#A9BCE0"];
  const yearAt = data.admissionYears.indexOf(data.year);
  const previousYear = yearAt > 0 ? data.admissionYears[yearAt - 1] : undefined;
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
              className={`${styles.rankRow} ${isSelected ? `${base.rowSelected} ${styles.rankSelected}` : ""}`}
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => onSelect(row.key)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.key); } }}
              onMouseEnter={() => onHover(row.key)}
            >
              <td>{data.providers.indexOf(row) + 1}</td>
              <td className={styles.nameCell}>
                {/* Znak jak na wykresach: gwiazdka = wybrany ośrodek, kropka = kolor województwa. */}
                {isSelected ? <span className={styles.star} aria-label="wybrany ośrodek">★</span> : regionColor.has(row.owNfz) ? <i className={styles.dot} style={{ background: regionColor.get(row.owNfz) }} aria-hidden /> : null}
                <ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /><small>{formatCityName(row.city)} · {row.voivodeship}</small>
              </td>
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

/**
 * „Jak leczą?”: zawsze wszystkie ośrodki (po porównaniu z podobnymi, bez filtra województw).
 * Przy wybranych województwach ich ośrodki mają kolory z mapy, pozostałe są szare.
 * Lejek śmiertelności (granice 95% i 99,8%) rysujemy, gdy grupa ma co najmniej 30 zgonów; przy mniejszej liczbie same punkty.
 */
function HowSection({ data, rows, regions, selectedRow, onSelect }: { data: JgpPageData; rows: JgpProviderRow[]; regions: string[]; selectedRow: JgpProviderRow | null; onSelect: (key: string) => void }) {
  const stats = poolStats(rows);
  const regionColor = useMemo(() => regionColors(regions), [regions]);
  const highlight = regions.length > 0;
  const colorOf = useCallback((row: JgpProviderRow, fallback?: string) => highlight ? regionColor.get(row.owNfz) ?? OTHER_POINT : fallback, [highlight, regionColor]);
  // Wybrany ośrodek: czerwona gwiazdka; nazwa i liczby tylko w podpowiedzi, jak przy innych punktach.
  const point = useCallback((row: JgpProviderRow, y: number, line: string, color?: string): ScatterPoint => ({
    key: row.key, name: row.name, lines: [`${formatCityName(row.city)} · OW ${row.voivodeship}`, line], x: row.hospitalizations, y, selected: row === selectedRow, color,
  }), [selectedRow]);
  const urgency = useMemo(() => rows.map((row) => point(row, row.urgentPct, `${integer(row.hospitalizations)} hosp. · nagłe ${pct(row.urgentPct)}`, colorOf(row))), [rows, point, colorOf]);
  const showFunnel = stats.deaths >= MIN_FUNNEL_DEATHS;
  const mortality = useMemo(() => {
    const points = rows.map((row) => {
      const status = showFunnel ? funnelStatus(row.mortalityPct, stats.mortalityPct, row.hospitalizations) : null;
      const funnelColor = status === "powyżej 99,8%" ? FUNNEL_COLORS.up998 : status === "powyżej 95%" ? FUNNEL_COLORS.up95 : status === "poniżej 99,8%" ? FUNNEL_COLORS.down998 : status === "poniżej 95%" ? FUNNEL_COLORS.down95 : undefined;
      return point(row, row.mortalityPct, `${integer(row.deaths)} zgonów · ${pct(row.mortalityPct)}${status ? ` · ${status}` : ""}`, colorOf(row, funnelColor));
    });
    if (!showFunnel) return { points, curves: [] as ScatterCurve[] };
    const xMax = Math.max(...rows.map((row) => row.hospitalizations), 10);
    const c = funnelCurves(stats.mortalityPct, Math.max(5, Math.round(xMax * 0.01)), Math.round(xMax * 1.05));
    const curves: ScatterCurve[] = [
      { x: c.x, y: c.inner[0], color: "#98A2B3", dash: "dot" }, { x: c.x, y: c.inner[1], color: "#98A2B3", dash: "dot" },
      { x: c.x, y: c.outer[0], color: "#667085", dash: "dash" }, { x: c.x, y: c.outer[1], color: "#667085", dash: "dash" },
    ];
    return { points, curves };
  }, [rows, point, colorOf, showFunnel, stats.mortalityPct]);
  const referenceUrgent = useMemo(() => ({ y: stats.urgentPct, label: `grupa: ${pct(stats.urgentPct)}` }), [stats.urgentPct]);
  const referenceMortality = useMemo(() => ({ y: stats.mortalityPct, label: `grupa: ${pct(stats.mortalityPct, stats.mortalityPct < 1 ? 2 : 1)}` }), [stats.mortalityPct]);
  const names = new Map(data.regions.map((row) => [row.owNfz, row.name]));
  const regionLegend = highlight || selectedRow ? <ul className={base.legend} aria-label="Legenda województw">
    {selectedRow ? <li><span className={styles.star} aria-hidden>★</span>wybrany ośrodek: {selectedRow.name}</li> : null}
    {regions.map((ow) => <li key={ow}><span className={base.swatch} style={{ background: regionColor.get(ow) }} aria-hidden />{(names.get(ow) ?? ow).toLocaleLowerCase("pl-PL")}</li>)}
    {highlight ? <li><span className={base.swatch} style={{ background: OTHER_POINT }} aria-hidden />pozostałe ośrodki</li> : null}
  </ul> : null;
  return <section className={styles.sec} aria-labelledby="s-jak">
    <SectionHead id="s-jak" question="Jak leczą?" context={`Wszystkie ośrodki w ${data.year} r.${highlight ? "; wybrane województwa w kolorach" : ""}`} tag="Rok" />
    {regionLegend}
    <div className={styles.two}>
      <div>
        <h3 className={base.chartTitle}>Udział przyjęć nagłych</h3>
        <ProviderScatter points={urgency} xTitle="Hospitalizacje" yTitle="Nagłe" ySuffix="%" reference={referenceUrgent} onSelect={onSelect} height={300} marker="star" ariaLabel={`Wykres punktowy: ${rows.length} ośrodków, liczba hospitalizacji i udział przyjęć nagłych`} />
      </div>
      <div>
        <h3 className={base.chartTitle}>{showFunnel ? "Śmiertelność: wykres lejkowy" : "Śmiertelność"}</h3>
        <ProviderScatter points={mortality.points} curves={mortality.curves} xTitle="Hospitalizacje" yTitle="Śmiertelność" ySuffix="%" reference={referenceMortality} onSelect={onSelect} height={300} marker="star" ariaLabel={`${showFunnel ? "Wykres lejkowy" : "Wykres punktowy"}: ${rows.length} ośrodków, śmiertelność względem liczby hospitalizacji`} />
        {showFunnel && !highlight ? <ul className={base.legend} aria-label="Legenda lejka">
          <li><span className={base.swatch} style={{ background: "rgba(40, 86, 163, 0.55)" }} aria-hidden />w granicach</li>
          <li><span className={base.swatch} style={{ background: FUNNEL_COLORS.up95 }} aria-hidden />powyżej 95%</li>
          <li><span className={base.swatch} style={{ background: FUNNEL_COLORS.up998 }} aria-hidden />powyżej 99,8%</li>
          <li><span className={base.swatch} style={{ background: FUNNEL_COLORS.down998 }} aria-hidden />poniżej granic</li>
        </ul> : null}
        {!showFunnel ? <p className={base.note}>Bez granic lejka: {integer(stats.deaths)} {stats.deaths === 1 ? "zgon" : "zgonów"} w grupie w {data.year} r. to za mało, żeby odróżnić różnice między ośrodkami od przypadku (granice rysujemy od {MIN_FUNNEL_DEATHS} zgonów).</p> : null}
      </div>
    </div>
    <p className={base.note}>{showFunnel ? "Lejek: linia środkowa to śmiertelność grupy, linie przerywane to granice 95% i 99,8% dla danej liczby hospitalizacji. Mały ośrodek ma szersze granice. Punkt poza granicą to sygnał do sprawdzenia, nie ocena jakości: śmiertelność jest surowa, a wartości <5 są szacowane. " : "Śmiertelność surowa: zgony w szpitalu podczas hospitalizacji. "}Kliknięcie punktu wybiera ośrodek.</p>
  </section>;
}
