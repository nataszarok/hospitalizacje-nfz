import { PEER_DISTANCE_A_LIMIT } from "@/lib/peerDistance";
import type { JgpPeerPair } from "@/lib/jgpPage";

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

/** Przedział histogramu: etykieta osi i liczba szpitali. `negative` = przedział straty. */
export interface HistogramBin { label: string; count: number; negative?: boolean }

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
  withBeds: number;
  medianBeds: number;
  withSor: number;
  beds: HistogramBin[];
  finance: { year: number; reported: number; loss: number; netResult: number; margins: HistogramBin[] } | null;
  comparison: { pairsA: number; hospitalsWithPeers: number; example: PeerExample | null };
}

/** Szpital pokazany w przykładzie porównania (ten sam co w podpowiedzi wyszukiwarki: Nowa Sól). */
export const FEATURED_HOSPITAL_KEY = "04|9251723350";
const EXAMPLE_PEERS = 8;

const BED_BINS: { label: string; max: number }[] = [
  { label: "<100", max: 100 },
  { label: "100–199", max: 200 },
  { label: "200–299", max: 300 },
  { label: "300–499", max: 500 },
  { label: "500–799", max: 800 },
  { label: "800+", max: Infinity },
];

// Marża netto w %: górne granice przedziałów (bez granicy), ujemne przedziały to strata.
const MARGIN_BINS: { label: string; max: number }[] = [
  { label: "< −15", max: -15 },
  { label: "−15…−10", max: -10 },
  { label: "−10…−5", max: -5 },
  { label: "−5…0", max: 0 },
  { label: "0…5", max: 5 },
  { label: "5…10", max: 10 },
  { label: "≥ 10", max: Infinity },
];

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function financeStats(records: FinancialRecordSummary[]): HospitalHomeStats["finance"] {
  // Rok z największą liczbą wyników netto (najczęściej najnowszy rok sprawozdań).
  const counts = new Map<number, number>();
  for (const record of records) for (const y of record.years) if (y.net_result !== null) counts.set(y.year, (counts.get(y.year) ?? 0) + 1);
  const year = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  if (year === undefined) return null;
  const results = records.flatMap((record) => record.years.filter((y) => y.year === year && y.net_result !== null));
  const margins = MARGIN_BINS.map((bin) => ({ label: bin.label, count: 0, negative: bin.max <= 0 }));
  for (const y of results) {
    const margin = y.net_margin ?? (y.revenue ? y.net_result! / y.revenue : null);
    if (margin === null) continue;
    margins[MARGIN_BINS.findIndex((bin) => margin * 100 < bin.max)].count++;
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
 * Liczby sekcji szpitali: wielkość (łóżka), SOR, wyniki finansowe i model par A/B.
 * `facilities`: krotki `[OW, NIP, nazwa, miasto]` z najnowszego roku (nazwy w przykładzie porównania).
 */
export function buildHospitalHomeStats(
  profiles: HospitalProfileSummary[],
  financial: FinancialRecordSummary[],
  pairs: JgpPeerPair[],
  facilities: readonly (readonly [string, string, string, string])[],
  featuredKey = FEATURED_HOSPITAL_KEY,
): HospitalHomeStats {
  const beds = profiles.map((profile) => profile.core?.beds ?? 0).filter((value) => value > 0);
  const bins = BED_BINS.map((bin) => ({ label: bin.label, count: 0 }));
  for (const value of beds) bins[BED_BINS.findIndex((bin) => value < bin.max)].count++;
  const names = new Map(facilities.map(([ow, nip, name, city]) => [`${ow}|${nip}`, [name, city] as [string, string]]));
  const pairsA = pairs.filter((pair) => pair.distance_score <= PEER_DISTANCE_A_LIMIT);
  const withPeers = new Set(pairsA.flatMap((pair) => [pair.a, pair.b]));
  return {
    profiles: profiles.length,
    withBeds: beds.length,
    medianBeds: median(beds),
    withSor: profiles.filter((profile) => (profile.capabilities?.sor?.count ?? 0) > 0).length,
    beds: bins,
    finance: financeStats(financial),
    comparison: { pairsA: pairsA.length, hospitalsWithPeers: withPeers.size, example: peerExample(pairs, names, featuredKey) },
  };
}
