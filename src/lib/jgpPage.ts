import { isProceduralJgpName, productTrend, type StaticDataset, type TrendsDataset } from "@/lib/staticData";
import { regionalBreakdown, type RegionRow } from "@/lib/regions";
import { productCodesForJgp } from "@/lib/trends";
import { familyFor, JGP_DESCRIPTIONS } from "@/lib/jgpGroupInfo";
import type { EstimationMethod } from "@/lib/types";

/** Model par A/B: pary klasy A z dystansem do tej wartości (jak domyślnie w widoku „Porównanie”). */
export const PEER_GRADE = "A";
export const PEER_MAX_DISTANCE = 10.01;

/**
 * Plik grupy z `scripts/build_jgp_pages.py` (`build-data/jgp/<KOD>.json.gz`, tylko dla buildu) po odczycie:
 * wiersze jako krotki (na dysku format v3 zapisuje je kolumnami, `decodeJgpGroupFile`).
 * Liczby metodą konserwatywną (`<5` = 1), tą samą co na stronach grup.
 */
export interface JgpGroupFile {
  version: number;
  jgp: string;
  years: string[];
  /** Klucze świadczeniodawców „OW|NIP”; wiersze wskazują indeks w tej liście. */
  providers: string[];
  /** [świadczeniodawca, miesiąc (indeks roku × 12 + miesiąc − 1), tryb 0 planowe / 1 nagłe / 2 pozostałe, hospitalizacje, zgony] */
  rows: [number, number, number, number, number][];
  /** Rozliczenia NFZ w zł: kraj w latach, świadczeniodawcy w roku `year`. */
  valuePln?: { national: Record<string, number>; year: string; providers: [string, number][] };
}

/** Lista grup ze stroną (`build-data/jgp/index.json`). */
export interface JgpPagesIndex { version: 2; years: string[]; groups: string[] }

export type { JgpValuation } from "@/lib/valuations";
import type { JgpValuation } from "@/lib/valuations";

/** Para szpitali z modelu podobieństwa (tylko pola używane na stronie grupy). */
export interface JgpPeerPair { a: string; b: string; peer_grade_pred: string; distance_score: number }

export interface JgpPageExtras {
  groupFile?: JgpGroupFile | null;
  valuationYear?: string;
  valuations?: JgpValuation[];
  peerPairs?: JgpPeerPair[];
  /**
   * Ośrodki ze wszystkich lat pliku grupy, także bez hospitalizacji w najnowszym roku (wybór roku na nowej karcie).
   * Bez tej opcji ranking ma tylko ośrodki z najnowszego roku.
   */
  allYearProviders?: boolean;
  /** Nazwy ośrodków z wcześniejszych lat (słowniki starszych plików roku). */
  facilities?: StaticDataset["facilities"];
}

/** Rodzina grupy: udziały wariantów w latach (hospitalizacje z trendów, w kolejności `catalogYears`). */
export interface JgpFamilyData {
  id: string;
  name: string;
  note?: string;
  variants: { code: string; name: string; values: (number | null)[] }[];
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
  /** Tryb przyjęcia [planowe, nagłe, pozostałe] w latach `JgpPageData.admissionYears` (krotki — mniejsza strona); puste bez pliku. */
  yearly: [number, number, number][];
  /** Zgony w latach `JgpPageData.admissionYears`; puste bez pliku. */
  yearlyDeaths: number[];
}

/** Struktura trybu przyjęcia w jednym roku (p = planowe, u = nagłe, o = pozostałe). */
export interface JgpAdmissionYear {
  year: string;
  total: number;
  planned: number;
  urgent: number;
  other: number;
  /** Zgony w szpitalu (z trendów kraju); brak w strukturze liczonej z pliku grupy. */
  deaths?: number;
}

/** Województwa w jednym roku: [OW NFZ, hospitalizacje na 100 tys. (1 miejsce po przecinku), hospitalizacje]. */
export interface JgpRegionYear { year: string; rows: [string, number, number][] }

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
  /** Województwa w każdym roku danych (mapa ciepła lat); ludność z najnowszego roku. */
  regionYears: JgpRegionYear[];
  /** Tryb przyjęcia w latach, w których grupa występuje w danych. */
  admissions: JgpAdmissionYear[];
  /** Lata pliku grupy (kolejność krotek `JgpProviderRow.yearly`). */
  admissionYears: string[];
  /** Miesiące wykresu „W czasie” jako „RRRR-MM”; puste bez pliku grupy. */
  months: string[];
  /** Cała Polska miesięcznie: hospitalizacje, zgony, przyjęcia nagłe. */
  national: { hospitalizations: number[]; deaths: number[]; urgent: number[] };
  /** Hospitalizacje grupy w poprzednim roku albo `null`. */
  previousHospitalizations: number | null;
  valuation: { year: string; points: number | null; daysFinanced: number | null; extraDayPoints: number | null } | null;
  /** Rozliczenia NFZ za grupę w kraju w kolejnych pełnych latach (zł). */
  valuePln: { year: string; value: number }[];
  /** Rodzina wariantów (lista ręczna w `jgpGroupInfo.ts`) albo `null`. */
  family: JgpFamilyData | null;
  /** Opis redakcyjny grupy albo `null`. */
  description: string | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Dane strony grupy JGP: zakres lat z trendów, ranking świadczeniodawców z najnowszego roku. */
export function buildJgpPageData(trends: TrendsDataset, latest: StaticDataset, jgpCode: string, method: EstimationMethod = "min", limit = 15, extras: JgpPageExtras = {}): JgpPageData | null {
  const productCodes = productCodesForJgp(trends, jgpCode);
  if (!productCodes.length) return null;
  const products = trends.products.filter(([code]) => productCodes.includes(code));
  const catalogYears = trends.years.filter((year) => products.some(([, , , years]) => years.includes(year)));
  // Nazwa z najnowszego produktu, w którym grupa występuje.
  const name = products.at(-1)?.[2]?.trim() ?? jgpCode;

  const selected = new Set(productCodes);
  const facilities = new Map([...(extras.facilities ?? []), ...latest.facilities].map(([ow, nip, facilityName, city]) => [`${ow}|${nip}`, { name: facilityName, city }]));
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
  const yearly = new Map<string, [number, number, number][]>();
  const yearlyDeaths = new Map<string, number[]>();
  const national = { hospitalizations: months.map(() => 0), deaths: months.map(() => 0), urgent: months.map(() => 0) };
  for (const [providerIndex, monthIndexInFile, admissionGroup, h, d] of file?.rows ?? []) {
    const year = file!.years[Math.floor(monthIndexInFile / 12)];
    const i = monthIndex.get(`${year}-${String((monthIndexInFile % 12) + 1).padStart(2, "0")}`);
    const key = file!.providers[providerIndex];
    if (i === undefined || !key || !year) continue;
    const providerSeries = series.get(key) ?? months.map(() => 0);
    providerSeries[i] += h;
    series.set(key, providerSeries);
    if (year === previousYear) previous.set(key, (previous.get(key) ?? 0) + h);
    const years = yearly.get(key) ?? file!.years.map((): [number, number, number] => [0, 0, 0]);
    years[Math.floor(monthIndexInFile / 12)][Math.min(admissionGroup, 2)] += h;
    yearly.set(key, years);
    const deaths = yearlyDeaths.get(key) ?? file!.years.map(() => 0);
    deaths[Math.floor(monthIndexInFile / 12)] += d;
    yearlyDeaths.set(key, deaths);
    national.hospitalizations[i] += h;
    national.deaths[i] += d;
    if (admissionGroup === 1) national.urgent[i] += h;
  }
  const value = new Map(file?.valuePln?.year === latest.analysisYear ? file.valuePln.providers : []);
  // Ośrodki z wcześniejszych lat bez hospitalizacji w najnowszym roku: na końcu rankingu, z zerem w najnowszym roku.
  if (file && extras.allYearProviders) {
    for (const key of file.providers) {
      if (grouped.has(key) || !series.has(key)) continue;
      const [ow, nip] = key.split("|");
      grouped.set(key, { ow, nip, h: 0, d: 0, urgent: 0 });
    }
  }

  const rows = [...grouped.entries()].map(([key, row]): JgpProviderRow => ({
    key,
    owNfz: row.ow,
    nip: row.nip,
    name: facilities.get(key)?.name ?? key,
    city: facilities.get(key)?.city.trim() ?? "",
    voivodeship: regions.get(row.ow) ?? row.ow,
    hospitalizations: row.h,
    deaths: row.d,
    // Dwa miejsca po przecinku wystarczą do wyświetlenia (jedno) i skracają dane strony.
    mortalityPct: row.h ? round2((row.d / row.h) * 100) : 0,
    urgentPct: row.h ? round2((row.urgent / row.h) * 100) : 0,
    series: series.get(key) ?? (file ? months.map(() => 0) : []),
    previousHospitalizations: file ? previous.get(key) ?? 0 : null,
    valuePln: value.get(key) ?? null,
    peers: [],
    yearly: file ? yearly.get(key) ?? file.years.map((): [number, number, number] => [0, 0, 0]) : [],
    yearlyDeaths: file ? yearlyDeaths.get(key) ?? file.years.map(() => 0) : [],
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
  const previousIndex = file ? file.years.indexOf(previousYear) : -1;
  const previousTotal = file && previousIndex >= 0
    ? file.rows.filter(([, month]) => Math.floor(month / 12) === previousIndex).reduce((sum, row) => sum + row[3], 0)
    : null;

  const trend = productTrend(trends, productCodes, method);
  const admissions = trend.yearly.flatMap((point) => point ? [{
    year: point.year,
    total: point.hospitalizations,
    planned: point.planned,
    urgent: point.urgent,
    other: point.hospitalizations - point.planned - point.urgent,
    deaths: point.deaths,
  }] : []);
  const familyDefinition = familyFor(jgpCode);
  const family: JgpFamilyData | null = familyDefinition ? {
    id: familyDefinition.id,
    name: familyDefinition.name,
    note: familyDefinition.note,
    variants: familyDefinition.codes.flatMap((code) => {
      const codes = productCodesForJgp(trends, code);
      if (!codes.length) return [];
      const variant = productTrend(trends, codes, method);
      const variantName = trends.products.filter(([product]) => codes.includes(product)).at(-1)?.[2]?.replace(/\s*\*\s*$/, "").trim() ?? code;
      return [{ code, name: variantName, values: catalogYears.map((year) => variant.yearly[trends.years.indexOf(year)]?.hospitalizations ?? null) }];
    }),
  } : null;
  const regionYears = catalogYears.map((year): JgpRegionYear => ({
    year,
    rows: regionalBreakdown(trends, productCodes, year, method, latest.regions, latest.populations)
      .map((row): [string, number, number] => [row.owNfz, Math.round(row.per100k * 10) / 10, row.hospitalizations]),
  }));

  return {
    jgpCode,
    name: name.replace(/\s*\*\s*$/, ""),
    procedural: isProceduralJgpName(name),
    productCodes,
    catalogYears,
    year: latest.analysisYear,
    providerCount: rows.filter((row) => row.hospitalizations > 0).length,
    hospitalizations: rows.reduce((sum, row) => sum + row.hospitalizations, 0),
    topProviders: rows.filter((row) => row.hospitalizations > 0).slice(0, limit),
    providers: rows,
    regions: regionalBreakdown(trends, productCodes, latest.analysisYear, method, latest.regions, latest.populations),
    regionYears,
    admissions,
    admissionYears: file?.years ?? [],
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
    family,
    description: JGP_DESCRIPTIONS[jgpCode] ?? null,
  };
}
