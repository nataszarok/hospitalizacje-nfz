"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { RegionMap } from "@/components/jgp/RegionMap";
import { ProviderLink } from "@/components/TableLinks";
import { areaLabel, areaToValue, inArea, MAX_AREAS, type AnalysisArea } from "@/lib/area";
import { REGION_PICK_COLORS } from "@/lib/chartPalette";
import { formatCityName } from "@/lib/formatters";
import { cartogramCells, scaleColor, type CartogramCell, type RegionsMap } from "@/lib/jgpCard";
import {
  cityProviders, citySection, cityYearPoints, cityYearTotals, facilityDots, facilityYearTotals, MIN_FACILITY_HOSPITALIZATIONS, regionalBreakdown,
  type CitiesMap, type CityProviderRow, type CityYearPoint, type FacilityDot, type FacilityYearsIndex, type FacilityYearsSection, type RegionRow,
} from "@/lib/regions";
import {
  loadCitiesMap, loadFacilityYearsIndex, loadFacilityYearsSection, loadRegionsMap, loadStaticDataset, loadTrends,
  type StaticDataset, type TrendsDataset,
} from "@/lib/staticData";
import type { EstimationMethod } from "@/lib/types";
import jgp from "@/components/jgp/JgpPage.module.css";
import styles from "./Explorer.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const CITY_LIMIT = 15;
/** Promień kropki placówki z największą liczbą hospitalizacji we wszystkich latach (jednostki mapy o szerokości 1000). */
export const MAX_DOT = 30;
/** Najmniejsza widoczna kropka placówki z hospitalizacjami. */
const MIN_DOT = 2;
/** Kolory kropek: placówki, gdy obszar nie jest wybrany / placówki spoza wybranych obszarów. */
const DOT_COLOR = "#2856A3";
const DOT_OUTSIDE = "#9DB4D9";

type MapMode = "regions" | "cities";

export type RegionViewProps = {
  productCodes: string[];
  /** Rok mapy i tabeli (oś czasu w panelu po lewej). */
  year: string;
  method: EstimationMethod;
  /** Obszary analizy (do 5); kliknięcie województwa dodaje je albo usuwa. */
  areas?: AnalysisArea[];
  onAreasChange?: (areas: AnalysisArea[]) => void;
};

/**
 * Promień kropki: pole koła proporcjonalne do liczby hospitalizacji (promień ∝ √wartości),
 * skala wspólna dla wszystkich lat — `max` to największa wartość placówki w całym okresie.
 */
export function dotRadius(hospitalizations: number, max: number): number {
  if (hospitalizations <= 0 || max <= 0) return 0;
  return Math.max(MIN_DOT, MAX_DOT * Math.sqrt(hospitalizations / max));
}

/** Położenie na skali koloru (−1 = ½ × odniesienia, 0 = odniesienie, 1 = 2 × odniesienia). */
const scalePosition = (value: number, reference: number) => value > 0 && reference > 0 ? Math.max(-1, Math.min(1, Math.log2(value / reference))) : -1;

const NO_AREAS: AnalysisArea[] = [];

/**
 * Widok „Gdzie”: mapa jak na karcie grupy JGP w wybranym roku z osią czasu (suwak, odtwarzanie).
 * Województwa: kolor = hospitalizacje na 100 tys. mieszkańców, obok tabela województw.
 * Miasta: kropka na placówkę przy jej mieście (pole = hospitalizacje), obok tabela miast; kliknięcie pokazuje placówki miasta.
 * Skale są wspólne dla wszystkich lat. Wybrane obszary mają kolory wyróżnień (jak na wykresach Kto leczy, Tryb przyjęcia).
 */
export function RegionView({ productCodes, year, method, areas = NO_AREAS, onAreasChange }: RegionViewProps) {
  const [data, setData] = useState<{ trends: TrendsDataset; dataset: StaticDataset; regionsMap: RegionsMap; citiesMap: CitiesMap; facilityIndex: FacilityYearsIndex } | null>(null);
  const [sections, setSections] = useState<{ key: string; files: FacilityYearsSection[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("regions");
  const [focus, setFocus] = useState<{ city: string; facility?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTrends(), loadStaticDataset(year), loadRegionsMap(), loadCitiesMap(), loadFacilityYearsIndex()])
      .then(([trends, dataset, regionsMap, citiesMap, facilityIndex]) => { if (!cancelled) setData({ trends, dataset, regionsMap, citiesMap, facilityIndex }); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania danych."); });
    return () => { cancelled = true; };
  }, [year]);

  // Pliki placówek: tylko sekcje katalogu JGP wybranych grup.
  const sectionKey = useMemo(() => {
    if (!data) return "";
    const jgpCodes = new Map(data.trends.products.map(([code, jgpCode]) => [code, jgpCode]));
    return [...new Set(productCodes.map((code) => citySection(jgpCodes.get(code))))].sort().join(",");
  }, [data, productCodes]);
  useEffect(() => {
    if (!sectionKey) return;
    let cancelled = false;
    Promise.all(sectionKey.split(",").map(loadFacilityYearsSection))
      .then((files) => { if (!cancelled) setSections({ key: sectionKey, files }); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania danych placówek."); });
    return () => { cancelled = true; };
  }, [sectionKey]);

  const years = useMemo(() => data?.trends.years ?? [], [data]);
  const yearIndex = years.includes(year) ? years.indexOf(year) : years.length - 1;
  const mapYear = years[yearIndex] ?? year;
  // Szerokość mapy w pikselach: legenda wielkości rysuje kropki w tej samej skali co mapa (viewBox o szerokości 1000).
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(0);
  useEffect(() => {
    const element = mapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setMapWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, mode]);

  // Województwa we wszystkich latach; środek skali = średnia Polski z całego okresu (kolor porównywalny między latami).
  const regionYears = useMemo(() => data && productCodes.length
    ? years.map((y) => regionalBreakdown(data.trends, productCodes, y, method, data.dataset.regions, data.dataset.populations))
    : [], [data, years, productCodes, method]);
  const regionReference = useMemo(() => {
    const nationals = regionYears.map((rows) => {
      const people = rows.reduce((sum, row) => sum + row.population, 0);
      return people ? (rows.reduce((sum, row) => sum + row.hospitalizations, 0) / people) * 100_000 : 0;
    }).filter((value) => value > 0);
    return nationals.length ? nationals.reduce((sum, value) => sum + value, 0) / nationals.length : 0;
  }, [regionYears]);

  const facilityTotals = useMemo(() => data && sections?.key === sectionKey
    ? facilityYearTotals(data.facilityIndex, sections.files, productCodes, method)
    : null, [data, sections, sectionKey, productCodes, method]);
  // Skala wielkości wspólna dla lat: największa wartość placówki w całym okresie.
  const maxFacility = useMemo(() => facilityTotals ? Math.max(0, ...[...facilityTotals.values()].flat()) : 0, [facilityTotals]);
  const dots = useMemo(() => data && facilityTotals
    ? facilityDots(data.facilityIndex, facilityTotals, data.citiesMap, yearIndex, (value) => dotRadius(value, maxFacility))
    : null, [data, facilityTotals, yearIndex, maxFacility]);
  const cityYear = useMemo(() => data && facilityTotals
    ? cityYearPoints(cityYearTotals(data.facilityIndex, facilityTotals), data.citiesMap, yearIndex)
    : null, [data, facilityTotals, yearIndex]);

  if (error) return <div className="alert">{error}</div>;
  if (!productCodes.length) return <div className="empty-chart">Wybierz co najmniej jeden produkt.</div>;
  if (!data) return <div className="empty-chart">Ładowanie danych…</div>;

  const reference = { regions: data.dataset.regions.map(([owNfz, name]) => ({ owNfz, name })) };
  // Kolor obszaru = jego pozycja na liście (jak na wykresach Kto leczy i Tryb przyjęcia).
  const areaColor = (area: AnalysisArea) => REGION_PICK_COLORS[areas.findIndex((item) => areaToValue(item) === areaToValue(area)) % REGION_PICK_COLORS.length];
  const regionAreas = areas.filter((area): area is Extract<AnalysisArea, { kind: "region" }> => area.kind === "region");
  const toggleRegion = (ow: string) => {
    if (!onAreasChange) return;
    const selected = regionAreas.some((area) => area.owNfz === ow);
    if (selected) onAreasChange(areas.filter((area) => !(area.kind === "region" && area.owNfz === ow)));
    else if (areas.length < MAX_AREAS) onAreasChange([...areas, { kind: "region", owNfz: ow }]);
  };
  const rows = regionYears[yearIndex] ?? [];
  const { cells: yearCells } = cartogramCells(rows);
  const cells: CartogramCell[] = yearCells.map((cell) => ({ ...cell, position: scalePosition(cell.per100k, regionReference) }));
  const range = years.length > 1 ? `${years[0]}–${years.at(-1)}` : mapYear;
  const mapHelp = mode === "regions"
    ? `Hospitalizacje na 100 tys. mieszkańców województwa. Kolor względem średniej Polski z lat ${range} (${decimal(regionReference)}), wspólny dla wszystkich lat. Województwo to oddział NFZ, w którym świadczeniodawca rozlicza hospitalizacje, nie miejsce zamieszkania pacjenta. Kliknij województwo, aby dodać je do obszaru analizy (do ${MAX_AREAS} obszarów) albo usunąć.`
    : `Kropka = placówka z co najmniej ${MIN_FACILITY_HOSPITALIZATIONS} hospitalizacjami wybranych grup w roku; placówki jednego miasta są zebrane wokół jego punktu. Pole kropki = liczba hospitalizacji; największa kropka to największa wartość placówki w latach ${range}, więc wielkości są porównywalne między latami. Wybrane obszary mają swoje kolory. Placówki z siedzibą poza słownikiem miast (głównie wsie) nie mają kropki. Kliknij kropkę, aby zobaczyć placówki miasta.`;

  return <div className={styles.viewStack}>
    <section className={styles.card} aria-labelledby="region-map">
      <div className={styles.cardHeader}>
        <h2 id="region-map" className={styles.cardTitle}>
          {mode === "regions" ? "Województwa na 100 tys. mieszkańców" : "Placówki i miasta"}
          <InfoTip label={mapHelp} ariaLabel="Jak czytać mapę" />
        </h2>
        <div className={styles.modeToggle} role="group" aria-label="Mapa">
          <button type="button" aria-pressed={mode === "regions"} onClick={() => setMode("regions")}>Województwa</button>
          <button type="button" aria-pressed={mode === "cities"} onClick={() => setMode("cities")}>Miasta</button>
        </div>
      </div>
      <div className={styles.mapLayout}>
        <div className={styles.mapColumn}>
          <div ref={mapRef}>
            {mode === "regions"
              ? <RegionMap map={data.regionsMap} cells={cells} regions={regionAreas.map((area) => area.owNfz)} onToggle={toggleRegion} colors={regionAreas.map(areaColor)} />
              : dots
                ? <FacilityMap map={data.regionsMap} dots={dots} mapYear={mapYear} areas={areas} areaColor={areaColor} focus={focus} onSelect={(dot) => setFocus({ city: dot.city, facility: dot.facility })} />
                : <div className="empty-chart">Ładowanie danych placówek…</div>}
          </div>
          <MapLegend
            mode={mode}
            range={range}
            areas={areas}
            areaColor={areaColor}
            reference={reference}
            max={maxFacility}
            scale={mapWidth / data.regionsMap.viewBox[0]}
          />
        </div>
        {mode === "regions"
          ? <RegionTable year={mapYear} rows={rows} areas={regionAreas} areaColor={areaColor} onToggle={onAreasChange ? toggleRegion : undefined} />
          : focus && cityYear
            ? <CityProviders
              city={focus.city}
              facility={focus.facility === undefined ? undefined : data.facilityIndex.facilities[focus.facility]}
              year={mapYear}
              point={cityYear.points.find((point) => point.city === focus.city)}
              productCodes={productCodes}
              method={method}
              onBack={() => setFocus(null)}
              onAddArea={onAreasChange && areas.length < MAX_AREAS && !areas.some((area) => area.kind === "city" && area.city === focus.city)
                ? () => onAreasChange([...areas, { kind: "city", city: focus.city }])
                : undefined}
            />
            : cityYear ? <CityTable year={mapYear} cityYear={cityYear} areas={areas} areaColor={areaColor} onShowCity={(city) => setFocus({ city })} /> : null}
      </div>
    </section>
  </div>;
}

/** Zaokrąglenie wartości legendy do 1, 2 albo 5 × potęga 10. */
function niceValue(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  return [5, 2, 1].map((step) => step * power).find((candidate) => candidate <= value) ?? power;
}

/**
 * Legenda mapy w jednym układzie: grupy z nagłówkiem (jak legenda obok mapy w przykładzie).
 * Województwa: skala koloru i wybrane obszary. Placówki: kolory i wielkość — kropki w skali mapy
 * (`scale` = piksele na jednostkę mapy), więc kropka legendy ma rozmiar kropki na mapie.
 */
function MapLegend({ mode, range, areas, areaColor, reference, max, scale }: {
  mode: MapMode;
  range: string;
  areas: AnalysisArea[];
  areaColor: (area: AnalysisArea) => string;
  reference: { regions: { owNfz: string; name: string }[] };
  max: number;
  scale: number;
}) {
  const regionAreas = areas.filter((area) => area.kind === "region");
  if (mode === "regions") return <div className={styles.mapLegend}>
    <div className={styles.legendGroup}>
      <div className={styles.legendTitle}>Na 100 tys. mieszkańców wobec średniej {range}</div>
      <div className={styles.legendScale}>
        <span>½ ×</span>
        <i style={{ background: `linear-gradient(90deg, ${scaleColor(-1)}, ${scaleColor(0)}, ${scaleColor(1)})` }} aria-hidden />
        <span>2 ×</span>
      </div>
    </div>
    {regionAreas.length ? <div className={styles.legendGroup}>
      <div className={styles.legendTitle}>Obszary</div>
      <ul className={styles.legendItems}>
        {regionAreas.map((area) => <li key={areaToValue(area)}><i className={styles.legendRing} style={{ borderColor: areaColor(area) }} aria-hidden />{areaLabel(area, reference)}</li>)}
      </ul>
    </div> : null}
  </div>;
  const sizes = [...new Set([niceValue(max), niceValue(max / 4), niceValue(max / 16)])].filter((value) => value > 0);
  return <div className={styles.mapLegend}>
    <div className={styles.legendGroup}>
      <div className={styles.legendTitle}>Kolor</div>
      <ul className={styles.legendItems}>
        {areas.map((area) => <li key={areaToValue(area)}><i className={styles.legendDot} style={{ background: areaColor(area) }} aria-hidden />{areaLabel(area, reference)}</li>)}
        <li><i className={styles.legendDot} style={{ background: areas.length ? DOT_OUTSIDE : DOT_COLOR }} aria-hidden />{areas.length ? "pozostałe placówki" : "placówka"}</li>
      </ul>
    </div>
    <div className={styles.legendGroup}>
      <div className={styles.legendTitle}>Hospitalizacje w roku</div>
      <ul className={styles.legendSizes}>
        {sizes.map((value) => {
          const r = Math.max(1.5, dotRadius(value, max) * scale);
          return <li key={value}>
            <svg width={2 * r + 2} height={2 * r + 2} aria-hidden><circle cx={r + 1} cy={r + 1} r={r} /></svg>
            <span>{integer(value)}</span>
          </li>;
        })}
      </ul>
    </div>
  </div>;
}

const dotTitle = (dot: FacilityDot, year: string) =>
  `${dot.name} (${formatCityName(dot.city)}): ${integer(dot.hospitalizations)} hospitalizacji w ${year} r.`;

/**
 * Mapa placówek: kontury województw i kropka na każdą placówkę z kropką w roku mapy (`facilityDots`).
 * Większe kropki pod spodem, mniejsze na wierzchu; przy zmianie roku kropki płynnie zmieniają wielkość i miejsce.
 */
function FacilityMap({ map, dots, mapYear, areas, areaColor, focus, onSelect }: {
  map: RegionsMap;
  dots: FacilityDot[];
  mapYear: string;
  areas: AnalysisArea[];
  areaColor: (area: AnalysisArea) => string;
  focus: { city: string; facility?: number } | null;
  onSelect: (dot: FacilityDot) => void;
}) {
  const [width, height] = map.viewBox;
  const shown = [...dots].sort((a, b) => b.r - a.r);
  const colorOf = (dot: FacilityDot) => {
    const area = areas.find((candidate) => inArea(candidate, { owNfz: dot.owNfz, city: dot.city }));
    return area ? areaColor(area) : areas.length ? DOT_OUTSIDE : DOT_COLOR;
  };
  return <svg className={jgp.regionMap} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Mapa placówek: hospitalizacje w ${mapYear} r.`}>
    {map.regions.map(([code, , path]) => <path key={code} d={path} className={styles.cityMapRegion} fill="#EEF2F7" aria-hidden />)}
    {shown.map((dot) => {
      const selected = focus?.facility === dot.facility || (focus?.facility === undefined && focus?.city === dot.city);
      return <circle
        key={dot.facility}
        cx={dot.x}
        cy={dot.y}
        r={dot.r}
        fill={colorOf(dot)}
        className={`${styles.cityDot} ${selected ? styles.facilityDotSelected : ""}`}
        role="button"
        tabIndex={0}
        aria-label={dotTitle(dot, mapYear)}
        aria-pressed={selected}
        onClick={() => onSelect(dot)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(dot); } }}
      ><title>{dotTitle(dot, mapYear)}</title></circle>;
    })}
  </svg>;
}

/** Tabela województw w roku mapy: od najwyższego wskaźnika na 100 tys.; kliknięcie dodaje albo usuwa obszar. */
function RegionTable({ year, rows, areas, areaColor, onToggle }: {
  year: string;
  rows: RegionRow[];
  areas: Extract<AnalysisArea, { kind: "region" }>[];
  areaColor: (area: AnalysisArea) => string;
  onToggle?: (ow: string) => void;
}) {
  const max = Math.max(0, ...rows.map((row) => row.per100k));
  return <section className={styles.citySection} aria-labelledby="region-table">
    <h3 id="region-table" className={styles.cardTitle}>Województwa · {year}</h3>
    <div className="table-wrap">
      <table className={styles.cityTable}>
        <thead><tr><th>#</th><th>Województwo</th><th>Na 100 tys.</th><th className={styles.num}>Hosp.</th></tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const area = areas.find((item) => item.owNfz === row.owNfz);
            return <tr key={row.owNfz} className={area ? styles.citySelected : undefined} aria-current={area ? "true" : undefined}>
              <td>{area ? <i className={styles.areaSwatch} style={{ background: areaColor(area) }} aria-hidden /> : i + 1}</td>
              <td>{onToggle ? <button type="button" className={styles.cityButton} onClick={() => onToggle(row.owNfz)}>{row.name}</button> : row.name}</td>
              <td>
                <div className={styles.barCell}>
                  <span className={styles.bar} style={{ width: `${max ? (row.per100k / max) * 100 : 0}%` }} aria-hidden />
                  <span className={styles.barValue}>{decimal(row.per100k)}</span>
                </div>
              </td>
              <td className={styles.num}>{integer(row.hospitalizations)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}

/** Tabela miast w roku mapy (w wybranych obszarach, jeśli są); kliknięcie miasta pokazuje jego placówki. */
function CityTable({ year, cityYear, areas, areaColor, onShowCity }: {
  year: string;
  cityYear: ReturnType<typeof cityYearPoints>;
  areas: AnalysisArea[];
  areaColor: (area: AnalysisArea) => string;
  onShowCity: (city: string) => void;
}) {
  const areaOf = (city: string, owNfz: string | null) => areas.find((area) => area.kind === "city" ? area.city.toUpperCase() === city : area.kind === "region" && area.owNfz === owNfz);
  const located = cityYear.points.map(({ city, owNfz, hospitalizations, per100k }) => ({ city, owNfz: owNfz as string | null, hospitalizations, per100k: per100k as number | null }));
  // Siedziby bez punktu na mapie (wsie) nie mają województwa położenia: tylko w widoku całej Polski.
  const all = [...located, ...cityYear.missing.map(({ city, hospitalizations }) => ({ city, owNfz: null, hospitalizations, per100k: null }))]
    .filter((row) => !areas.length || areaOf(row.city, row.owNfz))
    .sort((a, b) => b.hospitalizations - a.hospitalizations);
  const top = all.slice(0, CITY_LIMIT);
  const max = Math.max(0, ...top.map((row) => row.hospitalizations));
  return <section className={styles.citySection} aria-labelledby="region-cities">
    <h3 id="region-cities" className={styles.cardTitle}>
      Miasta · {year}
      <InfoTip label="Miasto siedziby świadczeniodawcy, od największej liczby hospitalizacji; przy wybranych obszarach tylko miasta tych obszarów. Na 100 tys.: hospitalizacje / mieszkańcy miasta (ludność z Wikidata). Szpital leczy też pacjentów spoza miasta, więc wskaźnik pokazuje rolę ośrodka. Kliknij miasto, aby zobaczyć jego placówki." ariaLabel="Jak czytać tabelę miast" />
    </h3>
    {top.length ? <div className="table-wrap">
      <table className={styles.cityTable}>
        <thead><tr><th>#</th><th>Miasto</th><th>Hospitalizacje</th><th className={styles.num}>Na 100 tys.</th></tr></thead>
        <tbody>
          {top.map((row, i) => {
            const area = areaOf(row.city, row.owNfz);
            return <tr key={row.city}>
              <td>{area ? <i className={styles.areaSwatch} style={{ background: areaColor(area) }} aria-hidden /> : null}{i + 1}</td>
              <td><button type="button" className={styles.cityButton} onClick={() => onShowCity(row.city)}>{formatCityName(row.city)}</button></td>
              <td>
                <div className={styles.barCell}>
                  <span className={styles.bar} style={{ width: `${max ? (row.hospitalizations / max) * 100 : 0}%` }} aria-hidden />
                  <span className={styles.barValue}>{integer(row.hospitalizations)}</span>
                </div>
              </td>
              <td className={styles.num}>{row.per100k === null ? "—" : decimal(row.per100k)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <div className="empty-chart">Brak hospitalizacji w wybranym obszarze.</div>}
    {all.length > CITY_LIMIT ? <p className={styles.cardNote}>{CITY_LIMIT} z {integer(all.length)} miast.</p> : null}
  </section>;
}

/** Placówki miasta w roku mapy (plik roku pobierany przy wyborze); kliknięta placówka jest wyróżniona. */
function CityProviders({ city, facility, year, point, productCodes, method, onBack, onAddArea }: {
  city: string;
  facility?: [string, string, string, string];
  year: string;
  point?: CityYearPoint;
  productCodes: string[];
  method: EstimationMethod;
  onBack: () => void;
  onAddArea?: () => void;
}) {
  const key = `${city}|${year}|${productCodes.join(",")}|${method}`;
  const [loaded, setLoaded] = useState<{ key: string; rows: CityProviderRow[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadStaticDataset(year)
      .then((dataset) => { if (!cancelled) setLoaded({ key, rows: cityProviders(dataset, productCodes, method, city) }); })
      .catch(() => { if (!cancelled) setLoaded({ key, rows: [] }); });
    return () => { cancelled = true; };
  }, [key, year, productCodes, method, city]);
  const rows = loaded?.key === key ? loaded.rows : null;
  const isFocused = (row: CityProviderRow) => facility !== undefined && row.owNfz === facility[0] && row.nip === facility[1];

  return <section className={styles.citySection} aria-labelledby="city-providers">
    <button type="button" className={styles.backButton} onClick={onBack}>← Wszystkie miasta</button>
    <h3 id="city-providers" className={styles.cardTitle}>{formatCityName(city)} · {year}</h3>
    <p className={styles.cityFacts}>
      {point ? <><b>{integer(point.hospitalizations)}</b> hospitalizacji · <b>{decimal(point.per100k)}</b> na 100 tys. mieszkańców · {integer(point.population)} mieszkańców</> : "Brak hospitalizacji w tym roku."}
      {onAddArea ? <> · <button type="button" className={styles.cityButton} onClick={onAddArea}>Dodaj miasto do obszaru analizy</button></> : null}
    </p>
    {rows === null ? <div className="empty-chart">Ładowanie placówek…</div>
      : rows.length ? <div className="table-wrap">
        <table className={`${styles.cityTable} ${styles.providerTable}`}>
          <thead><tr><th>Placówka</th><th className={styles.num}>Hosp.</th><th className={styles.num} title="Śmiertelność">Zgony %</th><th className={styles.num} title="Przyjęcia nagłe">Nagłe</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={`${row.owNfz}|${row.nip}`} className={isFocused(row) ? styles.citySelected : undefined} aria-current={isFocused(row) ? "true" : undefined}>
              <td><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /></td>
              <td className={styles.num}>{integer(row.hospitalizations)}</td>
              <td className={styles.num}>{decimal(row.mortalityPct)}%</td>
              <td className={styles.num}>{decimal(row.urgentPct)}%</td>
            </tr>)}
          </tbody>
        </table>
      </div> : <div className="empty-chart">Brak placówek z hospitalizacjami w wybranych grupach.</div>}
  </section>;
}
