import type { FinancialRecordSummary, HospitalProfileSummary } from "@/lib/hospitalHomeStats";
import { packCircles, separateDots, type FacilityYearsIndex, type FacilityYearsSection } from "@/lib/regions";

/** Wiersz katalogu szpitali (`/szpitale`): jeden świadczeniodawca (OW NFZ + NIP), liczony podczas budowania (metoda min). */
export interface HospitalCatalogRow {
  /** Klucz „OW|NIP”. */
  key: string;
  owNfz: string;
  nip: string;
  name: string;
  /** Miasto siedziby wielkimi literami (jak w danych NFZ). */
  city: string;
  /** Poziom sieci szpitali (indeks w `HospitalCatalog.pszLevels`) albo `null` poza siecią. */
  psz: number | null;
  /** Hospitalizacje w kolejnych latach katalogu. */
  series: number[];
  latest: number;
  previous: number;
  /** Zmiana r/r (%) albo `null` bez hospitalizacji w poprzednim roku. */
  changePct: number | null;
  /** Śmiertelność w najnowszym roku (%) albo `null` bez hospitalizacji. */
  mortalityPct: number | null;
  /** Łóżka z RPWDL (stan rejestru) albo `null` bez profilu. */
  beds: number | null;
  /** Wynik netto z najnowszego roku sprawozdania podmiotu (NIP) albo `null`. */
  net: { year: number; value: number } | null;
}

export interface HospitalCatalog {
  years: string[];
  latestYear: string;
  previousYear: string | null;
  /** Nazwy poziomów sieci szpitali (PSZ). */
  pszLevels: string[];
  /** Kod OW NFZ → nazwa województwa. */
  regions: Record<string, string>;
  rows: HospitalCatalogRow[];
  totals: { providers: number; inPsz: number; inPszLatest: number; latest: number; previous: number; beds: number };
}

export interface HospitalCatalogInput {
  index: FacilityYearsIndex;
  sections: FacilityYearsSection[];
  /** NIP → poziom sieci (indeks w `pszLevels`). */
  psz: Map<string, number>;
  pszLevels: string[];
  profiles: HospitalProfileSummary[];
  financial: FinancialRecordSummary[];
  regions: Record<string, string>;
}

/** Najnowszy rok z wynikiem netto podmiotu (NIP) albo `null`. */
export function latestNetResult(record: FinancialRecordSummary | undefined): { year: number; value: number } | null {
  const years = (record?.years ?? []).filter((item) => item.net_result !== null).sort((a, b) => b.year - a.year);
  return years.length ? { year: years[0].year, value: years[0].net_result! } : null;
}

/** Katalog: wiersz na świadczeniodawcę z hospitalizacjami w którymkolwiek roku, od największej liczby w najnowszym roku. */
export function buildHospitalCatalog({ index, sections, psz, pszLevels, profiles, financial, regions }: HospitalCatalogInput): HospitalCatalog {
  const years = index.years;
  const latestYear = years.at(-1) ?? "";
  const previousYear = years.length > 1 ? years[years.length - 2] : null;
  const last = years.length - 1;
  const hosp = index.facilities.map(() => years.map(() => 0));
  const deaths = index.facilities.map(() => 0);
  for (const section of sections) {
    const { facility, year, hMin, dMin } = section.rows;
    for (let i = 0; i < facility.length; i += 1) {
      hosp[facility[i]][year[i]] += hMin[i];
      if (year[i] === last) deaths[facility[i]] += dMin[i];
    }
  }
  const beds = new Map(profiles.map((profile) => [`${profile.oz_nfz}|${profile.nip}`, profile.core?.beds ?? null]));
  const finance = new Map(financial.map((record) => [record.nip, record]));
  const rows = index.facilities.flatMap(([owNfz, nip, name, city], i): HospitalCatalogRow[] => {
    const series = hosp[i];
    if (!series.some((value) => value > 0)) return [];
    const latest = series[last] ?? 0;
    const previous = last > 0 ? series[last - 1] : 0;
    return [{
      key: `${owNfz}|${nip}`,
      owNfz,
      nip,
      name: name.trim(),
      city,
      psz: psz.get(nip) ?? null,
      series,
      latest,
      previous,
      changePct: previous ? ((latest - previous) / previous) * 100 : null,
      mortalityPct: latest ? (deaths[i] / latest) * 100 : null,
      beds: beds.get(`${owNfz}|${nip}`) ?? null,
      net: latestNetResult(finance.get(nip)),
    }];
  }).sort((a, b) => b.latest - a.latest || a.name.localeCompare(b.name, "pl"));
  const active = rows.filter((row) => row.latest > 0);
  return {
    years,
    latestYear,
    previousYear,
    pszLevels,
    regions,
    rows,
    totals: {
      providers: active.length,
      inPsz: active.filter((row) => row.psz !== null).length,
      inPszLatest: active.filter((row) => row.psz !== null).reduce((sum, row) => sum + row.latest, 0),
      latest: active.reduce((sum, row) => sum + row.latest, 0),
      previous: rows.reduce((sum, row) => sum + row.previous, 0),
      beds: rows.reduce((sum, row) => sum + (row.beds ?? 0), 0),
    },
  };
}

/** Największe wzrosty i spadki r/r wśród szpitali z co najmniej `minPrevious` hospitalizacji w poprzednim roku. */
export function biggestHospitalChanges(rows: HospitalCatalogRow[], minPrevious = 1000, limit = 5) {
  const eligible = rows.filter((row) => row.previous >= minPrevious && row.latest > 0 && row.changePct !== null);
  const byChange = [...eligible].sort((a, b) => b.changePct! - a.changePct!);
  return { up: byChange.slice(0, limit), down: byChange.reverse().slice(0, limit) };
}

/** Miasto siedziby na mapie katalogu: punkt ze słownika miast i szpitale z hospitalizacjami w najnowszym roku. */
export interface CatalogCityPoint {
  /** Miasto wielkimi literami (jak w danych NFZ). */
  city: string;
  /** OW NFZ położenia miasta (ze słownika miast). */
  owNfz: string;
  x: number;
  y: number;
  /** Suma hospitalizacji szpitali miasta w najnowszym roku. */
  hospitalizations: number;
  /** Szpitale miasta od największego. */
  rows: HospitalCatalogRow[];
  /** Czy w mieście jest co najmniej jeden szpital sieci (PSZ). */
  inPsz: boolean;
}

/**
 * Punkty miast mapy katalogu z wierszy po filtrach (tylko szpitale z hospitalizacjami w najnowszym roku): od największego miasta.
 * Siedziba spoza słownika miast (głównie wsie) nie ma punktu: `missing` to liczba takich szpitali.
 */
export function catalogCityPoints(rows: HospitalCatalogRow[], cities: readonly [string, string, number, number, ...unknown[]][]): { points: CatalogCityPoint[]; missing: number } {
  const byName = new Map(cities.map((city) => [city[0], city]));
  const points = new Map<string, CatalogCityPoint>();
  let missing = 0;
  for (const row of rows) {
    if (row.latest <= 0) continue;
    const city = byName.get(row.city);
    if (!city) { missing += 1; continue; }
    const point = points.get(row.city) ?? { city: row.city, owNfz: city[1], x: city[2], y: city[3], hospitalizations: 0, rows: [], inPsz: false };
    point.hospitalizations += row.latest;
    point.rows.push(row);
    point.inPsz ||= row.psz !== null;
    points.set(row.city, point);
  }
  const sorted = [...points.values()].sort((a, b) => b.hospitalizations - a.hospitalizations || a.city.localeCompare(b.city, "pl"));
  for (const point of sorted) point.rows.sort((a, b) => b.latest - a.latest);
  return { points: sorted, missing };
}

/** Kropka świadczeniodawcy na mapie katalogu (po upakowaniu wokół miasta i rozsunięciu kolizji). */
export interface CatalogFacilityDot<R = HospitalCatalogRow> {
  row: R;
  x: number;
  y: number;
  r: number;
}

/**
 * Kropki świadczeniodawców z hospitalizacjami w najnowszym roku, jak mapa „Gdzie” w eksploratorze (`facilityDots`):
 * placówki jednego miasta ciasno wokół punktu miasta (`packCircles`, największa w środku), potem rozsunięcie kolizji
 * między sąsiednimi miastami (`separateDots`). Promień z `radius(hospitalizacje)`. Siedziba spoza słownika miast nie ma kropki.
 */
export function catalogFacilityDots<R extends Pick<HospitalCatalogRow, "key" | "city" | "latest">>(rows: R[], cities: readonly [string, string, number, number, ...unknown[]][], radius: (hospitalizations: number) => number): { dots: CatalogFacilityDot<R>[]; missing: number } {
  const byName = new Map(cities.map((city) => [city[0], city]));
  const byCity = new Map<string, R[]>();
  let missing = 0;
  for (const row of rows) {
    if (row.latest <= 0) continue;
    if (!byName.has(row.city)) { missing += 1; continue; }
    byCity.set(row.city, [...(byCity.get(row.city) ?? []), row]);
  }
  const dots: CatalogFacilityDot<R>[] = [];
  for (const [name, list] of byCity) {
    const [, , cx, cy] = byName.get(name)!;
    // Od największej; przy równej wartości po kluczu (stały układ).
    const ordered = [...list].sort((a, b) => b.latest - a.latest || a.key.localeCompare(b.key));
    const radii = ordered.map((row) => radius(row.latest));
    packCircles(radii).forEach((offset, i) => dots.push({ row: ordered[i], x: cx + offset.x, y: cy + offset.y, r: radii[i] }));
  }
  return { dots: separateDots(dots), missing };
}

/** Promień kropki szpitala na mapie katalogu (jednostki mapy o szerokości 1000): od `min` do `max`. */
export const CATALOG_DOT_RADIUS = { min: 3, max: 14 } as const;

/**
 * Promień kropki szpitala: `min` + (`max` − `min`) × √(hospitalizacje / największa placówka). Pierwiastek łagodzi wzrost, a stałe minimum
 * i niskie maksimum zawężają rozpiętość: przy samym polu ∝ wartości (`dotRadius`, mapa „Gdzie”) placówki 20–30 tys. były wielkie,
 * a placówki poniżej kilku tysięcy — kropkami 3 px. Przy mapie szerokiej na ok. 740 px: 4,4 px (najmniejsza) do ok. 21 px (największa).
 */
export function catalogDotRadius(hospitalizations: number, max: number): number {
  if (hospitalizations <= 0 || max <= 0) return 0;
  const { min, max: top } = CATALOG_DOT_RADIUS;
  return min + (top - min) * Math.sqrt(Math.min(hospitalizations, max) / max);
}
