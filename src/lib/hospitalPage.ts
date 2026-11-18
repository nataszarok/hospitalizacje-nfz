import type { FinancialRecordSummary } from "@/lib/hospitalHomeStats";
import { latestNetResult } from "@/lib/hospitalCatalog";
import type { JgpGroupFile } from "@/lib/jgpPage";
import type { FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";
import type { StaticDataset, TrendsDataset } from "@/lib/staticData";
import { buildHospitalFinance, type HospitalContractsFile, type HospitalFinance, type LumpIndex } from "@/lib/hospitalFinance";

/**
 * Oddział z rejestru RPWDL: kod resortowy, nazwa urzędowa kodu (`build_ward_names.py`; bez niej nazwa z rejestru), łóżka,
 * dziedziny medycyny i nazwy komórek szpitala w rejestrze (często kilka komórek o tym samym kodzie, połączone „ / ”).
 */
export type HospitalWard = [code: string, name: string, beds: number, fields: string[], registerName: string];

/**
 * Grupa JGP szpitala w latach: kod, nazwa, hospitalizacje szpitala, miejsce szpitala w Polsce (0 = szpital bez grupy w roku),
 * liczba ośrodków grupy, rozliczenia NFZ szpitala w zł (0 = brak kwoty), zgony w szpitalu, a dla całej Polski (wszystkie ośrodki
 * grupy): hospitalizacje, zgony i rozliczenia NFZ w zł. Tablice mają długość `years`.
 */
export type HospitalGroupRow = [
  code: string, name: string, hospitalizations: number[], rank: number[], providers: number[], valuePln: number[],
  deaths: number[], nationalHospitalizations: number[], nationalDeaths: number[], nationalPln: number[],
];

/**
 * Sposób zapłaty szpitala według zakresów umowy (`scripts/build_hospital_payment.py`): zakres z osobną kwotą w planie umowy
 * w danym miesiącu = za wykonanie, inaczej ryczałt. Hospitalizacje z plików NFZ (2017–2025), kwoty z zestawienia (od 2019 r.).
 */
export interface HospitalPaymentFile {
  years: string[];
  /** [kod zakresu, nazwa zakresu] */
  scopes: [string, string][];
  /** [indeks roku, indeks zakresu, za wykonanie 0/1, hospitalizacje] */
  hosp: [number, number, 0 | 1, number][];
  /** [indeks roku, indeks zakresu, za wykonanie 0/1, zł] — rozliczenia grup JGP (dla zakładki Finanse). */
  value: [number, number, 0 | 1, number][];
  /** Kody JGP rozliczeń (`jgp`). */
  codes?: string[];
  /** [indeks roku, indeks zakresu, za wykonanie 0/1, indeks kodu JGP, zł] — `value` według grup JGP (zakładka Finanse). */
  jgp?: [number, number, 0 | 1, number, number][];
}

/** Dane karty szpitala `/szpitale/[nip]` liczone podczas budowania (metoda konserwatywna, wartości <5 = 1). */
export interface HospitalPageData {
  key: string;
  owNfz: string;
  nip: string;
  name: string;
  city: string;
  region: string;
  /** Poziom sieci szpitali (PSZ) albo `null` poza siecią. */
  pszLevel: string | null;
  years: string[];
  /** Miesiące „RRRR-MM” wszystkich lat. */
  months: string[];
  /** Szpital miesięcznie: hospitalizacje, zgony w szpitalu, przyjęcia nagłe. */
  monthly: { hospitalizations: number[]; deaths: number[]; urgent: number[] };
  /**
   * Szpitale sieci PSZ w całej Polsce miesięcznie: linia odniesienia dla udziałów. `null` dla świadczeniodawcy spoza sieci
   * (szpital sieci porównujemy z siecią; mała placówka spoza sieci nie ma porównywalnej grupy).
   */
  network: { hospitalizations: number[]; deaths: number[]; urgent: number[] } | null;
  groups: HospitalGroupRow[];
  /** Przedziały długości pobytu i hospitalizacje szpitala w latach: `values[rok][przedział]`. */
  durations: { labels: string[]; values: number[][] };
  wards: HospitalWard[];
  beds: number | null;
  net: { year: number; value: number } | null;
  /**
   * Hospitalizacje oddziału według sposobu zapłaty: kod oddziału z kodu zakresu (03.<4450>.260.02 → 4450) →
   * [w ryczałcie w latach karty, za wykonanie w latach karty]. `null` bez danych o umowie.
   */
  wardPayment: Record<string, [number[], number[]]> | null;
  /** Rok stanu rejestru RPWDL (łóżka, oddziały) albo `null`. */
  rpwdlYear: string | null;
  /** Zaplecze z rejestru RPWDL („Czym dysponuje?”): SOR, OIT, poradnie, lokalizacje; `null` bez profilu w rejestrze. */
  resources: HospitalResources | null;
  /** Zakładka „Finanse” (umowy, rozliczenia, sprawozdanie) albo `null` (szpital spoza sieci PSZ albo bez umów). */
  finance: HospitalFinance | null;
}

/** Profil RPWDL szpitala (pola czytane przez kartę). */
export interface HospitalRpwdlRecord {
  oz_nfz: string;
  nip: string;
  core?: { beds?: number | null; wards?: { code: string; name: string; beds: number | null; fields?: string[] }[] } | null;
  outpatient?: { cell_count?: number; field_count?: number; location_count?: number } | null;
  registry?: { location_count?: number; city_count?: number; total_beds?: number } | null;
  capabilities?: Record<string, { count?: number; beds?: number; stations?: number; day_places?: number }> | null;
}

/**
 * Lokalizacja z rejestru RPWDL (adresy zapisane różnie złączone): adres, łóżka, rodzaje działalności
 * (`hospital`, `sor`, `outpatient`, `psychiatry`, `rehab`, `long_term`, `hospice`, `dialysis`, `spa`; bez nich `other:<nazwa komórki>`).
 */
export type HospitalLocation = [address: string, beds: number, kinds: string[]];

/**
 * Zaplecze szpitala z rejestru RPWDL: obecne komórki (nazwa, szczegół, np. „13 łóżek”), poradnie AOS i lokalizacje.
 * Komórki w stałej kolejności `HOSPITAL_CAPABILITIES`; brak komórki = brak w rejestrze.
 */
export interface HospitalResources {
  capabilities: [label: string, detail: string | null][];
  /** Poradnie i gabinety AOS: komórki, lokalizacje, dziedziny medycyny. */
  outpatient: { cells: number; locations: number; fields: number } | null;
  /** Wszystkie lokalizacje podmiotu w rejestrze i łóżka łącznie (z ZOL, rehabilitacją itp.); `list` — do dymka. */
  locations: { count: number; cities: number; beds: number; list: HospitalLocation[] } | null;
}

/** Komórki zaplecza w kolejności na karcie: pomoc doraźna, intensywna opieka, zabiegi, opieka długoterminowa, inne. */
export const HOSPITAL_CAPABILITIES: [key: string, label: string, unit: "beds" | "stations" | "day_places" | "teams" | "cells" | null][] = [
  ["sor", "SOR", "beds"], ["admission", "Izba przyjęć", "beds"], ["icu", "OIT", "beds"], ["stroke", "Oddział udarowy", "beds"],
  ["ccu", "Intensywny nadzór kardiologiczny", "beds"], ["operating", "Blok operacyjny", null], ["delivery", "Sala porodowa", null],
  ["dialysis", "Dializy", "stations"], ["day_treatment", "Leczenie jednego dnia", "day_places"], ["rehab", "Rehabilitacja stacjonarna", "beds"],
  ["psychiatry", "Psychiatria / leczenie uzależnień", "beds"], ["long_term", "ZOL / ZPO", "beds"], ["palliative", "Opieka paliatywna", "beds"],
  ["hospice", "Hospicjum", "beds"], ["spa", "Leczenie uzdrowiskowe", "beds"], ["zrm", "Zespoły ratownictwa (ZRM)", "teams"],
  ["poz", "POZ", "cells"], ["npl", "Nocna i świąteczna opieka", "cells"],
];

const pl = (value: number) => value.toLocaleString("pl-PL");
const UNIT_WORDS: Record<string, [string, string, string]> = {
  beds: ["łóżko", "łóżka", "łóżek"], stations: ["stanowisko", "stanowiska", "stanowisk"], day_places: ["miejsce dzienne", "miejsca dzienne", "miejsc dziennych"],
  teams: ["zespół", "zespoły", "zespołów"], cells: ["komórka", "komórki", "komórek"],
};
const unitWord = (n: number, [one, few, many]: [string, string, string]) => n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

/** Zaplecze z profilu RPWDL; `null` bez profilu. */
export function hospitalResources(profile: HospitalRpwdlRecord | null, list: HospitalLocation[] = []): HospitalResources | null {
  if (!profile) return null;
  const present = profile.capabilities ?? {};
  const capabilities = HOSPITAL_CAPABILITIES.flatMap(([key, label, unit]): [string, string | null][] => {
    const cell = present[key];
    if (!cell) return [];
    const value = unit === "beds" ? cell.beds : unit === "stations" ? cell.stations ?? cell.beds : unit === "day_places" ? cell.day_places ?? cell.beds : unit ? cell.count : undefined;
    const words = unit === "stations" && !cell.stations ? UNIT_WORDS.beds : unit === "day_places" && !cell.day_places ? UNIT_WORDS.beds : unit ? UNIT_WORDS[unit] : null;
    return [[label, value && words ? `${pl(value)} ${unitWord(value, words)}` : null]];
  });
  const out = profile.outpatient;
  const reg = profile.registry;
  return {
    capabilities,
    outpatient: out?.cell_count ? { cells: out.cell_count, locations: out.location_count ?? 0, fields: out.field_count ?? 0 } : null,
    locations: reg?.location_count ? { count: reg.location_count, cities: reg.city_count ?? 0, beds: reg.total_beds ?? 0, list } : null,
  };
}

export interface HospitalPageInput {
  /** NIP szpitali sieci PSZ (linia odniesienia „sieć PSZ”); przy `cards` niepotrzebne. */
  networkNips?: ReadonlySet<string>;
  key: string;
  trends: TrendsDataset;
  groupFiles: JgpGroupFile[];
  datasets: StaticDataset[];
  facilities: { index: FacilityYearsIndex; sections: FacilityYearsSection[] };
  pszLevel: string | null;
  profile: HospitalRpwdlRecord | null;
  financial: FinancialRecordSummary | undefined;
  regionName: string;
  payment?: HospitalPaymentFile | null;
  /** Umowy z NFZ (zakładka „Finanse”, tylko szpitale sieci PSZ). */
  contracts?: HospitalContractsFile | null;
  /** Ryczałt PSZ jako indeks wobec średnich sieci (zakładka „Finanse”). */
  lumpIndex?: LumpIndex | null;
  /** Data stanu rejestru RPWDL („RRRR-MM-DD”). */
  rpwdlDate?: string | null;
  /** Kod resortowy oddziału → nazwa urzędowa (`build-data/hospitals/ward-names.json`). */
  wardNames?: Record<string, string>;
  /** Lokalizacje z rejestru RPWDL (`build-data/hospitals/rpwdl-locations.json.gz`). */
  locations?: HospitalLocation[];
}

const URGENT_MODE = 1;

/** Kolejność przedziałów długości pobytu: według pierwszej liczby („0 dni”, „1-2 dni”, …, „6 i więcej dni”). */
const durationOrder = (label: string) => Number(label.match(/\d+/)?.[0] ?? 0);

/** Karta szpitala; `null`, gdy szpitala nie ma w danych. */
type MonthlySeries = { hospitalizations: number[]; deaths: number[]; urgent: number[] };
/** Dane wspólne dla kart: miesiące, sieć PSZ miesięcznie, przedziały długości pobytu. */
interface CardsCommon { years: string[]; months: string[]; network: MonthlySeries; labels: string[] }
/** Części karty jednego szpitala liczone z plików grup i plików lat. */
interface CardParts { monthly: HospitalPageData["monthly"]; groups: HospitalGroupRow[]; durations: number[][] }
/** Części kart wielu szpitali policzone w jednym przejściu po plikach grup i plikach lat (`buildHospitalCards`). */
export interface HospitalCards { common: CardsCommon; byKey: Map<string, CardParts> }

/**
 * Części kart dla wielu szpitali naraz: jedno przejście po ok. 780 plikach grup i 9 plikach lat zamiast przejścia na każdą
 * kartę (build wszystkich kart). Miejsce w Polsce: pozycja szpitala wśród wszystkich ośrodków grupy w roku.
 * Sieć PSZ miesięcznie: suma ośrodków, których NIP jest w `networkNips` (wykaz PSZ), we wszystkich OW NFZ.
 */
export function buildHospitalCards(keys: readonly string[], trends: TrendsDataset, groupFiles: JgpGroupFile[], datasets: StaticDataset[], networkNips: ReadonlySet<string> = new Set()): HospitalCards {
  const years = trends.years;
  const months = years.flatMap((year) => Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, "0")}`));
  const zeros = () => months.map(() => 0);
  const wanted = new Set(keys);

  const network: MonthlySeries = { hospitalizations: zeros(), deaths: zeros(), urgent: zeros() };

  // Nazwa grupy: z najnowszego produktu o tym kodzie.
  const groupNames = new Map<string, string>();
  for (const [, jgp, productName, productYears] of trends.products) {
    if (jgp && productName && (!groupNames.has(jgp) || productYears.includes(years.at(-1)!))) groupNames.set(jgp, productName.replace(/\s*\*\s*$/, "").trim());
  }

  const labels = [...new Set(datasets.flatMap((dataset) => dataset.facts.map((fact) => fact[3]).filter(Boolean)))].sort((a, b) => durationOrder(a) - durationOrder(b));
  const byKey = new Map<string, CardParts>();
  const parts = (key: string) => {
    let entry = byKey.get(key);
    if (!entry) byKey.set(key, entry = { monthly: { hospitalizations: zeros(), deaths: zeros(), urgent: zeros() }, groups: [], durations: years.map(() => labels.map(() => 0)) });
    return entry;
  };

  for (const file of groupFiles) {
    // Miesiąc w pliku grupy liczy się od pierwszego roku pliku; przeliczamy na indeks miesiąca karty.
    const offset = years.indexOf(file.years[0]) * 12;
    const totals = file.providers.map(() => years.map(() => 0));
    const deathsOf = new Map<number, number[]>();
    const nationalDeaths = years.map(() => 0);
    const mine = file.providers.map((provider) => wanted.has(provider));
    const inNetwork = file.providers.map((provider) => networkNips.has(provider.split("|")[1]));
    for (const [provider, month, mode, hosp, deaths] of file.rows) {
      const i = offset + month;
      if (i < 0 || i >= months.length) continue;
      totals[provider][Math.floor(i / 12)] += hosp;
      nationalDeaths[Math.floor(i / 12)] += deaths;
      if (inNetwork[provider]) {
        network.hospitalizations[i] += hosp;
        network.deaths[i] += deaths;
        if (mode === URGENT_MODE) network.urgent[i] += hosp;
      }
      if (!mine[provider]) continue;
      const { monthly } = parts(file.providers[provider]);
      let own = deathsOf.get(provider);
      if (!own) deathsOf.set(provider, own = years.map(() => 0));
      own[Math.floor(i / 12)] += deaths;
      monthly.hospitalizations[i] += hosp;
      monthly.deaths[i] += deaths;
      if (mode === URGENT_MODE) monthly.urgent[i] += hosp;
    }
    // Liczba ośrodków i posortowane sumy roku: miejsce = 1 + liczba ośrodków z większą liczbą hospitalizacji.
    const sortedByYear = years.map((_, y) => totals.map((row) => row[y]).filter((value) => value > 0).sort((a, b) => b - a));
    const amounts = file.valuePln?.providers ?? {};
    const nationalHosp = years.map((_, y) => totals.reduce((sum, row) => sum + row[y], 0));
    const nationalPln = years.map((year) => file.valuePln?.national?.[year] ?? 0);
    file.providers.forEach((provider, p) => {
      if (!mine[p] || !totals[p].some((value) => value > 0)) return;
      const own = totals[p];
      const rank = years.map((_, y) => own[y] > 0 ? 1 + sortedByYear[y].filter((value) => value > own[y]).length : 0);
      const valuePln = years.map((year) => amounts[year]?.find(([key]) => key === provider)?.[1] ?? 0);
      parts(provider).groups.push([
        file.jgp, groupNames.get(file.jgp) ?? file.jgp, own, rank, sortedByYear.map((list) => list.length), valuePln,
        deathsOf.get(p) ?? years.map(() => 0), nationalHosp, nationalDeaths, nationalPln,
      ]);
    });
  }
  for (const entry of byKey.values()) entry.groups.sort((a, b) => b[2].at(-1)! - a[2].at(-1)! || a[0].localeCompare(b[0]));

  years.forEach((year, y) => {
    const dataset = datasets.find((item) => item.analysisYear === year);
    for (const [ow, n, , duration, , , hMin] of dataset?.facts ?? []) {
      const key = `${ow}|${n}`;
      if (wanted.has(key)) parts(key).durations[y][labels.indexOf(duration)] += hMin;
    }
  });
  return { common: { years, months, network, labels }, byKey };
}

/** Karta szpitala; `null`, gdy szpitala nie ma w danych. `cards`: części policzone wcześniej dla wielu kart (build). */
export function buildHospitalPageData(input: HospitalPageInput, cards?: HospitalCards): HospitalPageData | null {
  const { key, trends, groupFiles, datasets, facilities, pszLevel, profile, financial, regionName, payment = null, contracts = null, lumpIndex = null, rpwdlDate = null, wardNames = {} } = input;
  const [owNfz, nip] = key.split("|");
  const facilityIndex = facilities.index.facilities.findIndex(([ow, n]) => ow === owNfz && n === nip);
  if (facilityIndex < 0) return null;
  const [, , name, city] = facilities.index.facilities[facilityIndex];
  const { common, byKey } = cards ?? buildHospitalCards([key], trends, groupFiles, datasets, input.networkNips);
  const { years, months, network, labels } = common;
  const zeros = () => months.map(() => 0);
  const own = byKey.get(key) ?? { monthly: { hospitalizations: zeros(), deaths: zeros(), urgent: zeros() }, groups: [], durations: years.map(() => labels.map(() => 0)) };
  const wards: HospitalWard[] = (profile?.core?.wards ?? []).map((ward) => [ward.code, wardNames[ward.code] ?? ward.name, ward.beds ?? 0, ward.fields ?? [], ward.name] as HospitalWard).sort((a, b) => b[2] - a[2]);
  return {
    key, owNfz, nip, name: name.trim(), city, region: regionName, pszLevel, years, months, monthly: own.monthly, network: pszLevel ? network : null,
    groups: own.groups, durations: { labels, values: own.durations }, wards, beds: profile?.core?.beds ?? null, net: latestNetResult(financial),
    wardPayment: payment ? wardPaymentByYear(payment, years) : null,
    rpwdlYear: rpwdlDate?.slice(0, 4) ?? null,
    resources: hospitalResources(profile, input.locations),
    finance: pszLevel ? buildHospitalFinance(contracts, payment, financial, years, lumpIndex, wards) : null,
  };
}

/** Hospitalizacje oddziałów (kod oddziału z kodu zakresu) w latach karty: [w ryczałcie, za wykonanie]. */
export function wardPaymentByYear(payment: HospitalPaymentFile, years: string[]): Record<string, [number[], number[]]> {
  const out: Record<string, [number[], number[]]> = {};
  for (const [yearIndex, scopeIndex, paid, value] of payment.hosp) {
    const y = years.indexOf(payment.years[yearIndex]);
    if (y < 0) continue;
    const ward = payment.scopes[scopeIndex][0].slice(3, 7);
    const sums = out[ward] ??= [years.map(() => 0), years.map(() => 0)];
    sums[paid][y] += value;
  }
  return out;
}

export type WardPaymentStatus = "ryczalt" | "czesciowo" | "poza";

/** Kod oddziału w danych zakresów: ten sam albo (bez własnego zakresu) o tych samych trzech pierwszych cyfrach. */
const matchWard = <T,>(wardCode: string, byWard: Record<string, T>) =>
  byWard[wardCode] ?? Object.entries(byWard).find(([code]) => code.slice(0, 3) === wardCode.slice(0, 3))?.[1];


/**
 * Sposób zapłaty oddziału z RPWDL w roku (udział hospitalizacji): zakres o tym samym kodzie, a bez niego zakres o tych samych trzech pierwszych
 * cyfrach (np. obserwacyjno-zakaźny 4348 rozlicza się w zakresie 4340).
 * `null` bez hospitalizacji w roku. Status po zaokrągleniu udziału: 0% za wykonanie = ryczałt, 100% = poza ryczałtem, inaczej częściowo.
 */
export function wardPaymentStatus(wardCode: string, payment: Record<string, [number[], number[]]> | null, yearIndex: number):
  { status: WardPaymentStatus; paidPct: number; total: number } | null {
  if (!payment) return null;
  const sums = matchWard(wardCode, payment);
  if (!sums) return null;
  const lump = sums[0][yearIndex] ?? 0;
  const paid = sums[1][yearIndex] ?? 0;
  const total = lump + paid;
  if (!total) return null;
  const paidPct = (paid / total) * 100;
  const rounded = Math.round(paidPct);
  return { status: rounded <= 0 ? "ryczalt" : rounded >= 100 ? "poza" : "czesciowo", paidPct, total };
}

/** Sekcja katalogu JGP (pierwsza litera kodu) → hospitalizacje szpitala w latach. */
export function sectionTotals(groups: HospitalGroupRow[], years: string[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const [code, , hospitalizations] of groups) {
    const letter = code[0];
    const totals = out.get(letter) ?? years.map(() => 0);
    hospitalizations.forEach((value, y) => { totals[y] += value; });
    out.set(letter, totals);
  }
  return out;
}

/** Suma miesięcy każdego roku. */
export const yearlySums = (values: number[], years: string[]) => years.map((_, y) => values.slice(y * 12, y * 12 + 12).reduce((sum, value) => sum + value, 0));
