import { isProceduralJgpName, productTrend, type StaticDataset, type TrendsDataset } from "@/lib/staticData";
import { regionalBreakdown, type RegionRow } from "@/lib/regions";
import { productCodesForJgp } from "@/lib/trends";
import type { EstimationMethod } from "@/lib/types";
import pageCodes from "@/lib/jgpPageCodes.json";

/**
 * Grupy JGP ze stroną `/jgp/[kod]`. Na start jedna grupa; docelowo cały katalog.
 * Lista w pliku JSON, bo czyta ją też `scripts/build_jgp_pages.py`.
 */
export const JGP_PAGE_CODES: readonly string[] = pageCodes;

/** Model par A/B: pary klasy A z dystansem do tej wartości (jak domyślnie w widoku „Porównanie”). */
export const PEER_GRADE = "A";
export const PEER_MAX_DISTANCE = 10.01;

/** Plik grupy z `scripts/build_jgp_pages.py` (`public/data/jgp/<KOD>.json.gz`). */
export interface JgpGroupFile {
  version: 1;
  jgp: string;
  years: string[];
  /** [rok, miesiąc, OW NFZ, NIP, grupa trybu p/u/o, hSim, hMin, dSim, dMin] */
  monthly: [string, number, string, string, string, number, number, number, number][];
  /** Rozliczenia NFZ w zł: kraj i świadczeniodawcy (rok, OW, NIP, kwota). */
  valuePln?: { national: Record<string, number>; providers: [string, string, string, number][] };
}

export type { JgpValuation } from "@/lib/valuations";
import type { JgpValuation } from "@/lib/valuations";

/** Para szpitali z modelu podobieństwa (tylko pola używane na stronie grupy). */
export interface JgpPeerPair { a: string; b: string; peer_grade_pred: string; distance_score: number }

export interface JgpPageExtras {
  groupFile?: JgpGroupFile | null;
  valuationYear?: string;
  valuations?: JgpValuation[];
  peerPairs?: JgpPeerPair[];
}

export interface JgpProviderRow {
  key: string;
  owNfz: string;
  nip: string;
  name: string;
  city: string;
  voivodeship: string;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
  /** Hospitalizacje miesięcznie (metoda rankingu), w kolejności `JgpPageData.months`; puste bez pliku grupy. */
  series: number[];
  /** Hospitalizacje w poprzednim roku albo `null`, gdy brak danych. */
  previousHospitalizations: number | null;
  /** Rozliczenia NFZ za grupę w roku rankingu (zł) albo `null`. */
  valuePln: number | null;
  /** Indeksy w `JgpPageData.providers` podobnych szpitali (model par), które leczą w tej grupie. */
  peers: number[];
  /** Tryb przyjęcia w latach pliku grupy (do sekcji „Planowo czy nagle” po filtrach); puste bez pliku. */
  yearly: JgpAdmissionYear[];
}

/** Struktura trybu przyjęcia w jednym roku (p = planowe, u = nagłe, o = pozostałe). */
export interface JgpAdmissionYear {
  year: string;
  total: number;
  planned: number;
  urgent: number;
  other: number;
}

export interface JgpPageData {
  jgpCode: string;
  name: string;
  /** Grupa zabiegowa (w katalogu NFZ nazwa kończy się „*”) albo zachowawcza. */
  procedural: boolean;
  productCodes: string[];
  /** Lata, w których grupa występuje w danych. */
  catalogYears: string[];
  /** Rok rankingu świadczeniodawców (najnowszy). */
  year: string;
  providerCount: number;
  hospitalizations: number;
  topProviders: JgpProviderRow[];
  /** Wszyscy świadczeniodawcy z najnowszego roku, w kolejności rankingu (do wyróżnienia `?osrodek=`). */
  providers: JgpProviderRow[];
  /** Województwa w najnowszym roku, od największej liczby na 100 tys. mieszkańców. */
  regions: RegionRow[];
  /** Tryb przyjęcia w latach, w których grupa występuje w danych. */
  admissions: JgpAdmissionYear[];
  /** Miesiące wykresu „W czasie” jako „RRRR-MM”; puste bez pliku grupy. */
  months: string[];
  /** Cała Polska miesięcznie: hospitalizacje, zgony, przyjęcia nagłe. */
  national: { hospitalizations: number[]; deaths: number[]; urgent: number[] };
  /** Hospitalizacje grupy w poprzednim roku albo `null`. */
  previousHospitalizations: number | null;
  valuation: { year: string; points: number | null; daysFinanced: number | null; extraDayPoints: number | null } | null;
  /** Rozliczenia NFZ za grupę w kraju w kolejnych pełnych latach (zł). */
  valuePln: { year: string; value: number }[];
}

/** Dane strony grupy JGP: zakres lat z trendów, ranking świadczeniodawców z najnowszego roku. */
export function buildJgpPageData(trends: TrendsDataset, latest: StaticDataset, jgpCode: string, method: EstimationMethod = "min", limit = 15, extras: JgpPageExtras = {}): JgpPageData | null {
  const productCodes = productCodesForJgp(trends, jgpCode);
  if (!productCodes.length) return null;
  const products = trends.products.filter(([code]) => productCodes.includes(code));
  const catalogYears = trends.years.filter((year) => products.some(([, , , years]) => years.includes(year)));
  // Nazwa z najnowszego produktu, w którym grupa występuje.
  const name = products.at(-1)?.[2]?.trim() ?? jgpCode;

  const selected = new Set(productCodes);
  const facilities = new Map(latest.facilities.map(([ow, nip, facilityName, city]) => [`${ow}|${nip}`, { name: facilityName, city }]));
  const regions = new Map(latest.regions);
  const grouped = new Map<string, { ow: string; nip: string; h: number; d: number; urgent: number }>();
  for (const [ow, nip, product, , admission, hSim, hMin, dSim, dMin] of latest.facts) {
    if (!selected.has(product)) continue;
    const key = `${ow}|${nip}`;
    const row = grouped.get(key) ?? { ow, nip, h: 0, d: 0, urgent: 0 };
    const h = method === "sim" ? hSim : hMin;
    row.h += h;
    row.d += method === "sim" ? dSim : dMin;
    if (admission === "2" || admission === "3") row.urgent += h;
    grouped.set(key, row);
  }

  const file = extras.groupFile && extras.groupFile.jgp === jgpCode ? extras.groupFile : null;
  const months = file ? file.years.flatMap((year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)) : [];
  const monthIndex = new Map(months.map((month, i) => [month, i]));
  const previousYear = String(Number(latest.analysisYear) - 1);
  const series = new Map<string, number[]>();
  const previous = new Map<string, number>();
  const yearly = new Map<string, Map<string, JgpAdmissionYear>>();
  const national = { hospitalizations: months.map(() => 0), deaths: months.map(() => 0), urgent: months.map(() => 0) };
  for (const [year, month, ow, nip, admissionGroup, hSim, hMin, dSim, dMin] of file?.monthly ?? []) {
    const i = monthIndex.get(`${year}-${String(month).padStart(2, "0")}`);
    if (i === undefined) continue;
    const h = method === "sim" ? hSim : hMin;
    const key = `${ow}|${nip}`;
    const providerSeries = series.get(key) ?? months.map(() => 0);
    providerSeries[i] += h;
    series.set(key, providerSeries);
    if (year === previousYear) previous.set(key, (previous.get(key) ?? 0) + h);
    const years = yearly.get(key) ?? new Map<string, JgpAdmissionYear>();
    const point = years.get(year) ?? { year, total: 0, planned: 0, urgent: 0, other: 0 };
    point.total += h;
    if (admissionGroup === "p") point.planned += h;
    else if (admissionGroup === "u") point.urgent += h;
    else point.other += h;
    years.set(year, point);
    yearly.set(key, years);
    national.hospitalizations[i] += h;
    national.deaths[i] += method === "sim" ? dSim : dMin;
    if (admissionGroup === "u") national.urgent[i] += h;
  }
  const value = new Map((file?.valuePln?.providers ?? []).filter(([year]) => year === latest.analysisYear).map(([, ow, nip, pln]) => [`${ow}|${nip}`, pln]));

  const rows = [...grouped.entries()].map(([key, row]): JgpProviderRow => ({
    key,
    owNfz: row.ow,
    nip: row.nip,
    name: facilities.get(key)?.name ?? key,
    city: facilities.get(key)?.city.trim() ?? "",
    voivodeship: regions.get(row.ow) ?? row.ow,
    hospitalizations: row.h,
    deaths: row.d,
    mortalityPct: row.h ? (row.d / row.h) * 100 : 0,
    urgentPct: row.h ? (row.urgent / row.h) * 100 : 0,
    series: series.get(key) ?? (file ? months.map(() => 0) : []),
    previousHospitalizations: file ? previous.get(key) ?? 0 : null,
    valuePln: value.get(key) ?? null,
    peers: [],
    yearly: file ? file.years.map((year) => yearly.get(key)?.get(year) ?? { year, total: 0, planned: 0, urgent: 0, other: 0 }) : [],
  })).sort((a, b) => b.hospitalizations - a.hospitalizations || a.name.localeCompare(b.name, "pl"));

  // Podobne szpitale: pary klasy A z modelu, ograniczone do świadczeniodawców tej grupy.
  const position = new Map(rows.map((row, i) => [row.key, i]));
  for (const pair of extras.peerPairs ?? []) {
    if (pair.peer_grade_pred !== PEER_GRADE || pair.distance_score > PEER_MAX_DISTANCE) continue;
    const a = position.get(pair.a);
    const b = position.get(pair.b);
    if (a === undefined || b === undefined) continue;
    rows[a].peers.push(b);
    rows[b].peers.push(a);
  }
  for (const row of rows) row.peers.sort((x, y) => x - y);

  const valuationRow = extras.valuations?.find((row) => row.kod_jgp === jgpCode);
  const previousTotal = file && file.years.includes(previousYear)
    ? file.monthly.filter(([year]) => year === previousYear).reduce((sum, row) => sum + (method === "sim" ? row[5] : row[6]), 0)
    : null;

  const trend = productTrend(trends, productCodes, method);
  const admissions = trend.yearly.flatMap((point) => point ? [{
    year: point.year,
    total: point.hospitalizations,
    planned: point.planned,
    urgent: point.urgent,
    other: point.hospitalizations - point.planned - point.urgent,
  }] : []);

  return {
    jgpCode,
    name: name.replace(/\s*\*\s*$/, ""),
    procedural: isProceduralJgpName(name),
    productCodes,
    catalogYears,
    year: latest.analysisYear,
    providerCount: rows.length,
    hospitalizations: rows.reduce((sum, row) => sum + row.hospitalizations, 0),
    topProviders: rows.slice(0, limit),
    providers: rows,
    regions: regionalBreakdown(trends, productCodes, latest.analysisYear, method, latest.regions, latest.populations),
    admissions,
    months,
    national,
    previousHospitalizations: previousTotal,
    valuation: valuationRow ? {
      year: extras.valuationYear ?? latest.analysisYear,
      points: valuationRow.pkt_hospitalizacja ?? null,
      daysFinanced: valuationRow.dni_finansowane_grupa ?? null,
      extraDayPoints: valuationRow.pkt_osobodzien_ponad_ryczalt ?? null,
    } : null,
    valuePln: Object.entries(file?.valuePln?.national ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([year, pln]) => ({ year, value: pln })),
  };
}
