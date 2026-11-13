import { PEER_DISTANCE_A_LIMIT } from "@/lib/peerDistance";
import { catalogDotRadius, catalogFacilityDots } from "@/lib/hospitalCatalog";
import type { RegionsMap } from "@/lib/jgpCard";
import type { JgpPeerPair } from "@/lib/jgpPage";
import type { CitiesMap, FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";

/** Profil szpitala z RPWDL: tylko pola czytane przez stronę główną (`rpwdl_summary_profiles.json.gz`). */
export interface HospitalProfileSummary {
  oz_nfz: string;
  nip: string;
  core?: { beds?: number | null } | null;
  capabilities?: { sor?: { count?: number } | null } | null;
}

/** Wynik finansowy podmiotu (NIP) z `financial_results.json.gz`. */
export interface FinancialRecordSummary {
  nip: string;
  years: { year: number; revenue: number | null; net_result: number | null; net_margin: number | null }[];
}

/**
 * Przedział histogramu: etykieta osi i liczba szpitali. `negative` = przedział straty.
 * `from`/`to`: granice przedziału na osi liczbowej (brak = przedział otwarty).
 */
export interface HistogramBin { label: string; count: number; negative?: boolean; from?: number; to?: number }

export interface PeerExample {
  key: string;
  name: string;
  city: string;
  peers: { key: string; name: string; city: string; distance: number }[];
  /** Wszystkie pary klasy A tego szpitala (wykres pokazuje najbliższe). */
  peerCount: number;
}

/** Liczby do sekcji „Szpitale publiczne” i „Porównanie placówek”. Liczone podczas budowania. */
export interface HospitalHomeStats {
  profiles: number;
  /** Profile z łóżkami szpitalnymi; pozostałe to placówki bez łóżek w RPWDL (np. kliniki zabiegów jednego dnia). */
  withBeds: number;
  medianBeds: number;
  /** Podmioty z co najmniej jednym SOR i łączna liczba oddziałów SOR (podmiot może mieć dwa). */
  withSor: number;
  sorUnits: number;
  beds: HistogramBin[];
  finance: { year: number; reported: number; loss: number; netResult: number; margins: HistogramBin[] } | null;
  comparison: { pairsA: number; hospitalsWithPeers: number; example: PeerExample | null };
}

/** Szpital pokazany w przykładzie porównania (ten sam co w podpowiedzi wyszukiwarki: Nowa Sól). */
export const FEATURED_HOSPITAL_KEY = "04|9251723350";
const EXAMPLE_PEERS = 5;

const BED_BINS: { label: string; max: number }[] = [
  { label: "bez łóżek", max: 1 },
  { label: "1–99", max: 100 },
  { label: "100–199", max: 200 },
  { label: "200–299", max: 300 },
  { label: "300–499", max: 500 },
  { label: "500–799", max: 800 },
  { label: "800+", max: Infinity },
];

// Marża netto w %: przedziały po 2,5 p.p. od −20 do 15, skrajne otwarte.
const MARGIN_STEP = 2.5;
const MARGIN_MIN = -20;
const MARGIN_MAX = 15;
const pl = (value: number) => value.toLocaleString("pl-PL").replace("-", "−");

function marginBins(): HistogramBin[] {
  const bins: HistogramBin[] = [{ label: `< ${pl(MARGIN_MIN)}`, count: 0, negative: true, to: MARGIN_MIN }];
  for (let from = MARGIN_MIN; from < MARGIN_MAX; from += MARGIN_STEP) {
    bins.push({ label: `${pl(from)}…${pl(from + MARGIN_STEP)}`, count: 0, negative: from < 0, from, to: from + MARGIN_STEP });
  }
  bins.push({ label: `≥ ${pl(MARGIN_MAX)}`, count: 0, negative: false, from: MARGIN_MAX });
  return bins;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function financeStats(allRecords: FinancialRecordSummary[], pszNips: ReadonlySet<string>): HospitalHomeStats["finance"] {
  // Tylko szpitale z sieci PSZ (wykaz NFZ).
  const records = allRecords.filter((record) => pszNips.has(record.nip));
  // Rok z największą liczbą wyników netto (najczęściej najnowszy rok sprawozdań).
  const counts = new Map<number, number>();
  for (const record of records) for (const y of record.years) if (y.net_result !== null) counts.set(y.year, (counts.get(y.year) ?? 0) + 1);
  const year = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  if (year === undefined) return null;
  const results = records.flatMap((record) => record.years.filter((y) => y.year === year && y.net_result !== null));
  const margins = marginBins();
  for (const y of results) {
    const margin = y.net_margin ?? (y.revenue ? y.net_result! / y.revenue : null);
    if (margin === null) continue;
    margins.find((bin) => bin.to === undefined || margin * 100 < bin.to)!.count++;
  }
  return {
    year,
    reported: results.length,
    loss: results.filter((y) => y.net_result! < 0).length,
    netResult: results.reduce((sum, y) => sum + y.net_result!, 0),
    margins,
  };
}

function peerExample(pairs: JgpPeerPair[], facilities: Map<string, [string, string]>, featuredKey: string): PeerExample | null {
  const byHospital = new Map<string, { key: string; distance: number }[]>();
  for (const pair of pairs) {
    if (pair.distance_score > PEER_DISTANCE_A_LIMIT) continue;
    for (const [self, other] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      const list = byHospital.get(self) ?? [];
      list.push({ key: other, distance: pair.distance_score });
      byHospital.set(self, list);
    }
  }
  const key = byHospital.has(featuredKey) ? featuredKey : [...byHospital].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]?.[0];
  if (!key) return null;
  const describe = (k: string) => {
    const [name, city] = facilities.get(k) ?? [k, ""];
    return { key: k, name, city };
  };
  const all = byHospital.get(key)!.sort((a, b) => a.distance - b.distance);
  return {
    ...describe(key),
    peers: all.slice(0, EXAMPLE_PEERS).map(({ key: k, distance }) => ({ ...describe(k), distance })),
    peerCount: all.length,
  };
}

/**
 * Liczby sekcji szpitali: wielkość (łóżka), SOR, wyniki finansowe szpitali PSZ i model par A/B.
 * `facilities`: krotki `[OW, NIP, nazwa, miasto]` z najnowszego roku (nazwy w przykładzie porównania).
 */
export function buildHospitalHomeStats(
  profiles: HospitalProfileSummary[],
  financial: FinancialRecordSummary[],
  pairs: JgpPeerPair[],
  facilities: readonly (readonly [string, string, string, string])[],
  pszNips: ReadonlySet<string>,
  featuredKey = FEATURED_HOSPITAL_KEY,
): HospitalHomeStats {
  const allBeds = profiles.map((profile) => profile.core?.beds ?? 0);
  const beds = allBeds.filter((value) => value > 0);
  const bins = BED_BINS.map((bin) => ({ label: bin.label, count: 0 }));
  for (const value of allBeds) bins[BED_BINS.findIndex((bin) => value < bin.max)].count++;
  const names = new Map(facilities.map(([ow, nip, name, city]) => [`${ow}|${nip}`, [name, city] as [string, string]]));
  const pairsA = pairs.filter((pair) => pair.distance_score <= PEER_DISTANCE_A_LIMIT);
  const withPeers = new Set(pairsA.flatMap((pair) => [pair.a, pair.b]));
  return {
    profiles: profiles.length,
    withBeds: beds.length,
    medianBeds: median(beds),
    withSor: profiles.filter((profile) => (profile.capabilities?.sor?.count ?? 0) > 0).length,
    sorUnits: profiles.reduce((sum, profile) => sum + (profile.capabilities?.sor?.count ?? 0), 0),
    beds: bins,
    finance: financeStats(financial, pszNips),
    comparison: { pairsA: pairsA.length, hospitalsWithPeers: withPeers.size, example: peerExample(pairs, names, featuredKey) },
  };
}

/**
 * Mapa szpitali na stronie głównej: gotowe kształty do statycznego SVG (bez dymków i interakcji).
 * `dots`: `[x, y, promień, 1 = szpital sieci PSZ / 0 = poza siecią]` w jednostkach mapy, zaokrąglone do 0,1.
 */
export interface HospitalMapStats {
  year: string;
  viewBox: [number, number];
  /** Ścieżki SVG województw. */
  regions: string[];
  dots: [number, number, number, 0 | 1][];
  /** Szpitale z hospitalizacjami w roku mapy (także bez kropki) i szpitale sieci PSZ wśród nich. */
  hospitals: number;
  inPsz: number;
  /** Szpitale z siedzibą spoza słownika miast (głównie wsie): bez kropki. */
  missing: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Kropki szpitali jak na mapie katalogu `/szpitale` (`catalogFacilityDots`, `catalogDotRadius`): świadczeniodawca (OW + NIP)
 * z hospitalizacjami w najnowszym roku (metoda min) w mieście siedziby. Liczone podczas budowania; `null` bez mapy województw.
 */
export function buildHospitalMapStats(
  index: FacilityYearsIndex,
  sections: FacilityYearsSection[],
  cities: CitiesMap,
  map: RegionsMap | null,
  pszNips: ReadonlySet<string>,
): HospitalMapStats | null {
  const last = index.years.length - 1;
  if (!map || last < 0) return null;
  const latest = index.facilities.map(() => 0);
  for (const section of sections) {
    const { facility, year, hMin } = section.rows;
    for (let i = 0; i < facility.length; i += 1) if (year[i] === last) latest[facility[i]] += hMin[i];
  }
  const rows = index.facilities.flatMap(([owNfz, nip, , city], i) => latest[i] > 0
    ? [{ key: `${owNfz}|${nip}`, city, latest: latest[i], psz: pszNips.has(nip) }]
    : []);
  const max = Math.max(1, ...rows.map((row) => row.latest));
  const { dots, missing } = catalogFacilityDots(rows, cities.cities, (value) => catalogDotRadius(value, max));
  return {
    year: index.years[last],
    viewBox: map.viewBox,
    regions: map.regions.map(([, , path]) => path),
    // Szpitale sieci na wierzchu (kolor danych), poza siecią pod spodem.
    dots: dots
      .sort((a, b) => Number(a.row.psz) - Number(b.row.psz))
      .map(({ row, x, y, r }) => [round1(x), round1(y), round1(r), row.psz ? 1 : 0]),
    hospitals: rows.length,
    inPsz: rows.filter((row) => row.psz).length,
    missing,
  };
}
