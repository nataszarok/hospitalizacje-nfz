"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartTooltip, TooltipHead, TooltipLines } from "@/components/ChartTooltip";

import { CHART_COLORS } from "@/lib/chartPalette";
import { formatCityName } from "@/lib/formatters";
import { catalogCityPoints, catalogDotRadius, catalogFacilityDots, type CatalogFacilityDot, type HospitalCatalogRow } from "@/lib/hospitalCatalog";
import type { RegionsMap } from "@/lib/jgpCard";
import { HospitalLink } from "@/components/TableLinks";
import type { CitiesMap } from "@/lib/regions";
import { loadCitiesMap, loadRegionsMap } from "@/lib/staticData";
import { elementBox, type Box } from "@/lib/tooltipPosition";
import styles from "./HospitalCatalog.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
/** Szpitale w panelu obok mapy (reszta na liście). */
export const MAP_SIDE_ROWS = 10;
const providersWord = (n: number) => n === 1 ? "szpital" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "szpitale" : "szpitali";

/**
 * Mapa katalogu: kropka = świadczeniodawca z hospitalizacjami w najnowszym roku, w mieście siedziby; wielkość z `catalogDotRadius`
 * (od 3 do 14 jednostek mapy). Placówki miasta są upakowane wokół jego punktu, a kropki sąsiednich miast rozsunięte,
 * więc kropki nie nachodzą na siebie (`catalogFacilityDots`: `packCircles` + `separateDots`, ten sam mechanizm co w eksploratorze).
 * Kolor: szpital sieci (PSZ) — błękit danych, poza siecią — jasny błękit, szpitale wybranego miasta — sygnał.
 * Kliknięcie kropki wybiera miasto placówki (filtr listy), kliknięcie województwa — filtr województwa. Wiersze po filtrach katalogu.
 * Kropki i ich położenie liczymy ze wszystkich szpitali katalogu (`allRows`, bez filtrów): po wyszukaniu albo wyborze filtra kropki
 * nie zmieniają wielkości ani miejsca. Szpitale spoza filtrów zostają na mapie jako szare tło (bez kliknięcia).
 */
export function HospitalCatalogMap({ rows, allRows, latestYear, regionName, region, city, onRegion, onCity, onShowList }: {
  rows: HospitalCatalogRow[];
  allRows: HospitalCatalogRow[];
  latestYear: string;
  regionName: (owNfz: string) => string;
  region: string;
  city: string;
  onRegion: (owNfz: string) => void;
  onCity: (city: string) => void;
  onShowList: () => void;
}) {
  const [maps, setMaps] = useState<{ regions: RegionsMap; cities: CitiesMap } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRegionsMap(), loadCitiesMap()])
      .then(([regions, cities]) => { if (!cancelled) setMaps({ regions, cities }); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  // Miasta: panel obok mapy (wybrane miasto, największe miasta).
  const { points } = useMemo(() => maps ? catalogCityPoints(rows, maps.cities.cities) : { points: [] }, [maps, rows]);
  const max = useMemo(() => Math.max(1, ...allRows.map((row) => row.latest)), [allRows]);
  const { dots, missing } = useMemo(
    () => maps ? catalogFacilityDots(allRows, maps.cities.cities, (value) => catalogDotRadius(value, max)) : { dots: [], missing: 0 },
    [maps, allRows, max],
  );
  // Szpitale po filtrach katalogu: kolor; pozostałe — szare tło pod spodem.
  const matching = useMemo(() => new Set(rows.map((row) => row.key)), [rows]);
  const filtered = matching.size < allRows.length;
  const ordered = useMemo(() => [...dots].sort((a, b) => Number(matching.has(a.row.key)) - Number(matching.has(b.row.key))), [dots, matching]);
  const selected = points.find((point) => point.city === city) ?? null;
  const [hover, setHover] = useState<{ dot: CatalogFacilityDot; anchor: Box } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Panel: szpitale wybranego miasta albo wszystkie po filtrach (z hospitalizacjami w najnowszym roku).
  const side = selected ? selected.rows : rows.filter((row) => row.latest > 0);
  const [width, height] = maps?.regions.viewBox ?? [1000, 946];

  return <section className={styles.mapCard} aria-label="Mapa szpitali">
    <div className={styles.mapGrid}>
      <div ref={wrapRef} className={styles.mapWrap} onMouseLeave={() => setHover(null)}>
        {maps ? <svg className={styles.map} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Mapa: hospitalizacje szpitali w ${latestYear} r.`}>
          {maps.regions.regions.map(([code, name, path]) => <path
            key={code}
            d={path}
            className={`${styles.mapRegion} ${region === code ? styles.mapRegionOn : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`Województwo ${name}`}
            aria-pressed={region === code}
            onClick={() => onRegion(code)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRegion(code); } }}
          />)}
          {ordered.map((dot) => {
            const { row } = dot;
            if (!matching.has(row.key)) return <circle key={row.key} cx={dot.x} cy={dot.y} r={dot.r} className={styles.mapDotOff} aria-hidden />;
            const on = row.city === city;
            const pick = () => { setHover(null); onCity(on ? "" : row.city); };
            return <circle
              key={row.key}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill={on ? CHART_COLORS.signal : row.psz !== null ? CHART_COLORS.data : CHART_COLORS.dataSoft}
              className={`${styles.mapDot} ${on ? styles.mapDotOn : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${row.name}, ${formatCityName(row.city)}: ${integer(row.latest)} hospitalizacji`}
              aria-pressed={on}
              onClick={pick}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } }}
              onMouseEnter={(event) => setHover({ dot, anchor: elementBox(event.currentTarget) })}
              onMouseLeave={() => setHover(null)}
              onFocus={(event) => setHover({ dot, anchor: elementBox(event.currentTarget) })}
              onBlur={() => setHover(null)}
            />;
          })}
        </svg> : <div className={styles.mapPlaceholder} role="status" aria-label={failed ? undefined : "Wczytywanie mapy"}>{failed ? "Nie udało się wczytać mapy." : null}</div>}
        {hover ? <ChartTooltip anchor={hover.anchor} container={wrapRef}>
          <TooltipHead title={hover.dot.row.name} context={`${formatCityName(hover.dot.row.city)} · ${regionName(hover.dot.row.owNfz)}`} />
          <TooltipLines lines={[
            <>Hospitalizacje {latestYear}: <b>{integer(hover.dot.row.latest)}</b></>,
            hover.dot.row.psz !== null ? "w sieci szpitali (PSZ)" : "poza siecią szpitali",
            <>Kliknij, aby wybrać miasto: {formatCityName(hover.dot.row.city)}</>,
          ]} />
        </ChartTooltip> : null}
        <ul className={styles.mapLegend} aria-label="Legenda mapy">
          <li><i style={{ background: CHART_COLORS.data }} aria-hidden />szpital sieci (PSZ)</li>
          <li><i style={{ background: CHART_COLORS.dataSoft }} aria-hidden />poza siecią</li>
          <li><i style={{ background: CHART_COLORS.signal }} aria-hidden />szpitale wybranego miasta</li>
          {filtered ? <li><i className={styles.mapDotOffKey} aria-hidden />poza filtrami</li> : null}
        </ul>
      </div>
      <aside className={styles.mapSide} aria-label="Szpitale na mapie">
        <h3>{selected ? formatCityName(selected.city) : region ? `Województwo ${regionName(region)}` : "Cała Polska"}</h3>
        <p className={styles.mapNote}>{selected
          ? <>{integer(selected.hospitalizations)} hospitalizacji w {latestYear} r. <button type="button" className={styles.linkButton} onClick={() => onCity("")}>Pokaż wszystkie miasta</button></>
          : points.length ? <>Największe miasta: {points.slice(0, 3).map((point) => formatCityName(point.city)).join(", ")}. Kliknij kropkę, aby wybrać miasto, albo województwo, aby je zawęzić.</> : "Brak szpitali dla tych filtrów."}</p>
        <ol className={styles.mapList}>
          {side.slice(0, MAP_SIDE_ROWS).map((row) => <li key={row.key}>
            <HospitalLink owNfz={row.owNfz} nip={row.nip} title={row.name}>{row.name}</HospitalLink>
            <b>{integer(row.latest)}</b>
          </li>)}
        </ol>
        {side.length > MAP_SIDE_ROWS ? <button type="button" className={styles.linkButton} onClick={onShowList}>Wszystkie na liście ({integer(side.length)}) →</button> : null}
      </aside>
    </div>
    <p className={styles.mapNote}>
      Kropka: świadczeniodawca w mieście siedziby; większa kropka — więcej hospitalizacji w {latestYear} r. (metoda konserwatywna;
      skala złagodzona, żeby duże szpitale nie zasłaniały mapy, a małe były widoczne — dokładna liczba w dymku). Placówki jednego miasta
      są zebrane wokół jego punktu, a kropki sąsiednich miast rozsunięte. Siedziba to adres podmiotu, nie zawsze miejsce leczenia.{missing ? ` ${integer(missing)} ${providersWord(missing)} bez punktu: siedziba spoza słownika miast (głównie wsie).` : ""}
    </p>
  </section>;
}
