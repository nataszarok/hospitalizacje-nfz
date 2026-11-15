import { formatCityName } from "@/lib/formatters";
import { H55_CONTROLS, type H55Control } from "@/lib/h55Controls";
import { REGION_PICK_COLORS } from "@/lib/chartPalette";

/**
 * Dane artykułu „H55. Historia jednego kodu” (`scripts/articles/build_h55_article.py` → `build-data/articles/h55.json.gz`).
 * Hospitalizacje H55 świadczeniodawca × miesiąc (metoda „sim”, jak trendy portalu) i udział procedury 03.96 z API NFZ.
 */
export interface H55ArticleFile {
  version: 1;
  jgp: string;
  product: string;
  years: string[];
  method: "sim" | "min";
  providers: string[];
  /** Kolumny: indeks świadczeniodawcy, miesiąc (indeks roku × 12 + miesiąc − 1), hospitalizacje. */
  rows: { provider: number[]; month: number[]; hospitalizations: number[] };
  procedure: { code: string; source: string; fields: string[]; years: [number, number, number, number][] };
  /** Szacunek hospitalizacji w roku bez danych API (opis: `HospitalizationEstimate`). */
  estimate?: HospitalizationEstimate;
  /** Pobyty H55 z API statystyk JGP: [rok, hospitalizacje, w zakresach „jednego dnia”, 0 dni, 1 dzień]. */
  stays: { source: string; fields: string[]; rows: [number, number, number, number, number][] };
  /** Wycena grupy HK14 (od 2026 r. termolezja) z katalogu grup NFZ. */
  valuation2026: { group: string; year: number; source: string; points: ValuationPoints };
  /** Kwoty rozliczone przez NFZ (zestawienie świadczeń): [rok, grupa, zł, punkty]. */
  settled: { fields: string[]; rows: [number, string, number, number][] };
  /**
   * Poradnie i umowy w latach `years`: [świadczeniodawca, poradnia neurochirurgiczna w RPWDL (0/1 na rok), umowa AOS NFZ
   * w zakresie neurochirurgii (0/1/null na rok; null = brak danych o umowach), poradnia leczenia bólu i oddział neurochirurgii
   * (0/1 na rok), pierwsza poradnia neurochirurgiczna od „RRRR-MM”].
   */
  clinics?: { years: number[]; contractYears?: number[]; source: string; fields: string[]; rows: [string, number[], (number | null)[], number[], number[], string | null, (number | null)[]?][] };
  /**
   * Pacjenci z termolezją (NFZ, zestawienie pacjentów wg ICD-10 i ICD-9): 03.96 (szpital, H55) i 04.25 (kod termolezji w AOS).
   * rows: [świadczeniodawca, rok, procedura, pacjenci sim, pacjenci min]; national: [rok, procedura, sim, min, świadczeniodawcy];
   * diagnoses: [rok, procedura, kategoria ICD-10, pacjenci sim].
   */
  thermolysis?: { source: string; fields: string[]; rows: [string, number, string, number, number][]; national: [number, string, number, number, number][]; diagnoses: [number, string, string, number][]; unmapped: Record<string, number> } | null;
  /** Pobyty według świadczeniodawcy i roku: [świadczeniodawca, rok, hospitalizacje, w zakresach „jednego dnia”, 0 dni]. */
  oneDay?: { fields: string[]; rows: [string, number, number, number, number][] };
}

/** Punkty grupy w katalogu: hospitalizacja, planowa, leczenie jednego dnia, pobyt 0-, 1- i 2-dniowy. */
export interface ValuationPoints {
  hospitalizacja: number;
  planowa?: number;
  jeden_dzien?: number;
  zero_dni?: number;
  jeden_dzien_pobytu?: number;
  dwa_dni_pobytu?: number;
}

/** Kwoty H55 rozliczone przez NFZ (zł): kraj i świadczeniodawcy w latach (`valuePln` pliku grupy H55). */
export interface H55ValuePln { national: Record<string, number>; providers: Record<string, [string, number][]> }

/**
 * Kwota H55 rozliczona przez NFZ za okres objęty kontrolą. Rozliczenia są roczne: rok w całości w okresie = kwota roku;
 * rok w części = kwota roku × udział hospitalizacji z miesięcy okresu (`estimated`, gdy placówka miała H55 także poza okresem
 * w tym roku; gdy cała aktywność roku mieści się w okresie, kwota jest dokładna). Lata bez danych o kwotach
 * (przed 2019 r.) są w `missingYears`, a kwota ich nie obejmuje.
 */
export interface SettledInPeriod { pln: number; estimated: boolean; missingYears: string[] }

export function settledInPeriod(values: number[], months: string[], from: string, to: string, byYear: Map<string, number>): SettledInPeriod {
  const out: SettledInPeriod = { pln: 0, estimated: false, missingYears: [] };
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    const key = String(year);
    const amount = byYear.get(key);
    if (amount === undefined) { out.missingYears.push(key); continue; }
    const inYear = months.map((month, i) => [month, values[i] ?? 0] as const).filter(([month]) => month.startsWith(key));
    const inPeriod = inYear.filter(([month]) => month >= from && month <= to);
    if (inPeriod.length === 12) { out.pln += amount; continue; }
    const all = inYear.reduce((total, [, value]) => total + value, 0);
    const within = inPeriod.reduce((total, [, value]) => total + value, 0);
    out.pln += all ? amount * within / all : 0;
    // Szacunek tylko wtedy, gdy placówka miała H55 także w miesiącach roku poza okresem; cała aktywność roku w okresie
    // (albo żadna) = kwota dokładna.
    if (within > 0 && within < all) out.estimated = true;
  }
  return out;
}

/** Miesiąc „intensywny”: co najmniej tyle hospitalizacji H55 w placówce. */
export const INTENSE_MONTH = 20;
/** Reguła krótkiej serii: cała aktywność H55 w najwyżej tylu kolejnych miesiącach… */
export const SHORT_SERIES_MAX_SPAN = 12;
/** …i co najmniej tyle hospitalizacji łącznie. */
export const SHORT_SERIES_MIN_TOTAL = 100;

/** Miesiące „RRRR-MM” wszystkich lat pliku. */
export function monthKeys(years: string[]): string[] {
  return years.flatMap((year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));
}

/** Szereg miesięczny każdego świadczeniodawcy („OW|NIP” → hospitalizacje w kolejnych miesiącach). */
export function providerSeries(file: H55ArticleFile): Map<string, number[]> {
  const length = file.years.length * 12;
  const out = new Map<string, number[]>();
  file.rows.provider.forEach((provider, i) => {
    const key = file.providers[provider];
    let values = out.get(key);
    if (!values) out.set(key, values = new Array<number>(length).fill(0));
    values[file.rows.month[i]] += file.rows.hospitalizations[i];
  });
  return out;
}

/** Suma kraju w miesiącach. */
export function nationalSeries(series: Map<string, number[]>, length: number): number[] {
  const out = new Array<number>(length).fill(0);
  for (const values of series.values()) values.forEach((value, i) => { out[i] += value; });
  return out;
}

/** Sumy lat z szeregu miesięcznego. */
export const yearTotals = (values: number[], years: string[]) => years.map((_, y) => values.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0));

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Pokrycie kontrolą: miesiące z H55 w okresie badanym, przed nim i po nim, oraz po zakończeniu kontroli. */
export interface ControlCoverage {
  /** Miesiące z co najmniej jedną hospitalizacją H55. */
  months: number;
  studied: number;
  before: number;
  after: number;
  /** Miesiące z H55 po miesiącu zakończenia kontroli (pełne miesiące). */
  afterControl: number;
  intense: number;
  intenseStudied: number;
  hospitalizations: number;
  hospitalizationsStudied: number;
  hospitalizationsAfterControl: number;
}

/** Pokrycie miesięcy szeregu przez okres badany kontroli (miesiące „RRRR-MM”, porównanie tekstowe). */
export function controlCoverage(values: number[], months: string[], control: Pick<H55Control, "studyFrom" | "studyTo" | "end">): ControlCoverage {
  return periodsCoverage(values, months, [{ from: control.studyFrom, to: control.studyTo }], control.end);
}

/** Okres świadczeń objęty kontrolą (miesiące „RRRR-MM”, włącznie). */
export interface StudyPeriod { from: string; to: string }

/**
 * Pokrycie miesięcy kilkoma okresami (placówka z kilkoma kontrolami): miesiąc w którymkolwiek okresie = objęty kontrolą;
 * „przed” = przed pierwszym okresem, „po” = pozostałe; „po kontroli” = po miesiącu zakończenia ostatniej kontroli (`end`).
 */
export function periodsCoverage(values: number[], months: string[], periods: StudyPeriod[], end: string): ControlCoverage {
  const endMonth = end.slice(0, 7);
  const firstFrom = periods.reduce((min, period) => period.from < min ? period.from : min, periods[0]?.from ?? "");
  const out: ControlCoverage = { months: 0, studied: 0, before: 0, after: 0, afterControl: 0, intense: 0, intenseStudied: 0, hospitalizations: 0, hospitalizationsStudied: 0, hospitalizationsAfterControl: 0 };
  values.forEach((value, i) => {
    if (value <= 0) return;
    const month = months[i];
    const studied = periods.some((period) => month >= period.from && month <= period.to);
    const intense = value >= INTENSE_MONTH;
    out.months += 1;
    out.hospitalizations += value;
    if (intense) out.intense += 1;
    if (studied) {
      out.studied += 1;
      out.hospitalizationsStudied += value;
      if (intense) out.intenseStudied += 1;
    } else if (month < firstFrom) out.before += 1;
    else out.after += 1;
    if (month > endMonth) {
      out.afterControl += 1;
      out.hospitalizationsAfterControl += value;
    }
  });
  return out;
}

/** Pierwszy i ostatni miesiąc z H55 (indeksy) albo `null`. */
export function activeRange(values: number[]): [number, number] | null {
  const first = values.findIndex((value) => value > 0);
  if (first < 0) return null;
  let last = values.length - 1;
  while (values[last] <= 0) last -= 1;
  return [first, last];
}

/**
 * Placówki z krótką serią H55 bez kontroli w zestawieniu: cała aktywność w najwyżej `SHORT_SERIES_MAX_SPAN`
 * kolejnych miesiącach i co najmniej `SHORT_SERIES_MIN_TOTAL` hospitalizacji. Kolejność: od najwcześniejszej serii.
 */
export function shortSeriesProviders(series: Map<string, number[]>, excluded: Set<string>): string[] {
  return [...series.entries()]
    .filter(([key, values]) => {
      if (excluded.has(key)) return false;
      const range = activeRange(values);
      return range !== null && range[1] - range[0] + 1 <= SHORT_SERIES_MAX_SPAN && sum(values) >= SHORT_SERIES_MIN_TOTAL;
    })
    .sort(([a, va], [b, vb]) => activeRange(va)![0] - activeRange(vb)![0] || a.localeCompare(b))
    .map(([key]) => key);
}

/** Placówka w artykule: szereg miesięczny i (dla kontroli) pokrycie okresem badanym. */
export interface H55Facility {
  key: string;
  label: string;
  /** Miejscowość (dla placówek bez kontroli: z indeksu placówek). */
  detail?: string;
  values: number[];
  control?: H55Control;
  /** Wszystkie kontrole placówki (wiersz placówki w siatce i sumach; kontrola pojedyncza: `control`). */
  controls?: H55Control[];
  coverage?: ControlCoverage;
  /** Kwota H55 rozliczona za okres objęty kontrolą (tylko placówki z kontrolą, gdy są dane o kwotach). */
  settled?: SettledInPeriod;
  /** Kwota H55 rozliczona we wszystkich latach z danymi o kwotach (zł). */
  settledTotal?: number;
  /** Kwoty H55 rozliczone w latach (zł), lata z danymi o kwotach. */
  plnByYear?: Record<string, number>;
}

/** Sumy pokrycia grupy placówek (pola `ControlCoverage` zsumowane). */
export function sumCoverage(items: ControlCoverage[]): ControlCoverage {
  const out = controlCoverage([], [], { studyFrom: "", studyTo: "", end: "" });
  for (const item of items) for (const key of Object.keys(out) as (keyof ControlCoverage)[]) out[key] += item[key];
  return out;
}

/** Pobyty H55 w roku (API statystyk JGP NFZ): w zakresach „zespół chirurgii jednego dnia”, 0-dniowe i 1-dniowe. */
export interface StayYear { year: number; hospitalizations: number; oneDayScope: number; day0: number; day1: number }

/**
 * Szacunek liczby hospitalizacji H55 w roku bez danych API (2025) — `scripts/articles/build_h55_article.py`: dla każdego świadczeniodawcy
 * punkty rozliczone przez NFZ przeliczone na pobyty (zakresy „jednego dnia” ÷ 3362 pkt, pozostałe ÷ `pointsPerStay`, co najmniej
 * liczba pacjentów), suma wszystkich. `pointsPerStay` skalibrowane na ostatnim roku API; `backtest` — ta sama metoda z parametrem
 * z roku wcześniej zastosowana do ostatniego roku API.
 */
export interface HospitalizationEstimate {
  year: number;
  hospitalizations: number;
  providers: number;
  pointsPerStay: number;
  referenceYear: number;
  backtest: { year: number; estimate: number; api: number; errorPct: number };
}

/** Udział procedury 03.96 w hospitalizacjach H55 w roku (API statystyk JGP NFZ). */
export interface ProcedureShare { year: number; hospitalizations: number; withProcedure: number; percent: number }

export interface H55ArticleData {
  /** Kod produktu H55 w katalogu JGP (mapa w czasie z plików placówek portalu). */
  product: string;
  years: string[];
  months: string[];
  national: number[];
  nationalByYear: number[];
  total: number;
  controls: H55Facility[];
  shortSeries: H55Facility[];
  /** Sumy pokrycia: seria 17, pięć wcześniejszych, 13 krótkich serii (bez kontroli: studied = 0). */
  totals: { series: ControlCoverage; early: ControlCoverage; short: ControlCoverage };
  /**
   * Placówki z kontrolami (jedna pozycja na placówkę; Koszalin miał dwie kontrole): pokrycie sumą okresów objętych
   * kontrolami. „series” = placówka z kontrolą z serii 2023–2026, „early” = tylko kontrole z lat 2019–2022.
   */
  facilities: { series: H55Facility[]; early: H55Facility[] };
  /** Placówki spoza kontroli i krótkich serii. */
  others: { facilities: number; hospitalizations: number };
  facilitiesWithH55: number;
  /** Wszystkie placówki z H55 (wybór szpitala na wykresie): kontrole, krótkie serie, pozostałe. */
  allFacilities: H55Facility[];
  /** Placówki bez kontroli z gwałtowną zmianą H55 (`suddenChangeProviders`). */
  sudden: SuddenCase[];
  /** Kwoty H55 rozliczone przez NFZ według świadczeniodawcy i roku (zł). */
  providerPln: Record<string, Record<string, number>>;
  /** Poradnie i pobyty świadczeniodawców; lata z danymi o poradniach. */
  clinics: Record<string, ClinicInfo>;
  clinicYears: number[];
  clinicSource: string;
  oneDay: Record<string, OneDayYear[]>;
  /** Pacjenci z termolezją: kraj i świadczeniodawcy (klucz „rok|procedura”), albo `null` bez pliku źródłowego. */
  thermolysis: {
    source: string;
    years: number[];
    national: { year: number; procedure: string; patients: number; providers: number }[];
    byProvider: Record<string, Record<string, number>>;
    diagnoses: { year: number; procedure: string; icd: string; patients: number }[];
  } | null;
  procedure: { code: string; source: string; years: ProcedureShare[] };
  /** Długość pobytów i rozliczenie w zakresach „jednego dnia” (API statystyk JGP), lata z API. */
  stays: StayYear[];
  /** Kwoty rozliczone przez NFZ za H55 w latach (zł) i lata z danymi o kwotach. */
  nationalPln: Record<string, number>;
  /** Szacunek hospitalizacji H55 w roku po ostatnim roku API (z punktów rozliczonych przez NFZ) albo `null`. */
  estimate: HospitalizationEstimate | null;
  /** Koszt H55 dla NFZ we wszystkich latach (opis: `totalCost`). */
  cost: TotalCost | null;
  /** Wycena: H55 w ostatnim roku przed zmianą i HK14 od 2026 r.; przeciętna wartość punktu (zł) z rozliczeń. */
  valuation: {
    h55?: { year: string; points: ValuationPoints };
    hk14: { group: string; year: number; source: string; points: ValuationPoints };
    pointValue: { year: number; group: string; pln: number; points: number; perPoint: number }[];
  };
}

/** Poradnie i pobyty świadczeniodawcy (RPWDL, umowy NFZ, otwarte dane). */
export interface ClinicInfo {
  /** Poradnia neurochirurgiczna w RPWDL w roku (komórka działała choć jeden dzień roku). */
  neurosurgery: Record<number, boolean>;
  /** Umowa AOS NFZ w zakresie neurochirurgii w roku; brak klucza = brak danych o umowach. */
  contract: Record<number, boolean>;
  painClinic: Record<number, boolean>;
  neurosurgeryWard: Record<number, boolean>;
  /** Najwcześniejsza poradnia neurochirurgiczna w RPWDL („RRRR-MM”). */
  since: string | null;
  /** Kwota w planie umów AOS NFZ w zakresie leczenia bólu (zł) w roku; brak klucza = brak danych o umowach. */
  painContractPln: Record<number, number>;
}

/** Pobyty świadczeniodawcy w roku: wszystkie, w zakresach „jednego dnia”, 0-dniowe. */
export interface OneDayYear { year: number; total: number; oneDayScope: number; day0: number }

/** Placówka bez kontroli z gwałtowną zmianą H55 (reguła: `suddenChangeProviders`). */
export interface SuddenCase {
  facility: H55Facility;
  kind: "growth" | "drop";
  /** Średnio rocznie w latach bazowych (`SUDDEN_BASE_YEARS`). */
  base: number;
  byYear: Record<string, number>;
}

/** Lata bazowe i lata badane reguły gwałtownej zmiany. */
export const SUDDEN_BASE_YEARS = ["2019", "2020", "2021"];
export const SUDDEN_YEARS = ["2023", "2024", "2025"];
/** Wzrost: rok z co najmniej tyloma H55 w latach badanych… */
export const SUDDEN_MIN_YEAR = 300;
/** …i co najmniej tyle razy więcej niż średnio w latach bazowych. */
export const SUDDEN_GROWTH = 5;
/** Spadek: ostatni rok najwyżej taki ułamek najwyższego z wcześniejszych lat badanych (co najmniej `SUDDEN_MIN_YEAR`). */
export const SUDDEN_DROP = 0.25;

/**
 * Placówki bez kontroli i spoza krótkich serii z gwałtowną zmianą H55: wzrost (rok z ≥ `SUDDEN_MIN_YEAR` H55 w latach 2023–2025
 * i ≥ `SUDDEN_GROWTH` × średnia z lat 2019–2021) albo nagły spadek w ostatnim roku. Kolejność: wzrosty od największego roku, potem spadki.
 */
export function suddenChangeProviders(facilities: H55Facility[], years: string[]): SuddenCase[] {
  const yearSum = (values: number[], year: string) => { const i = years.indexOf(year); return i < 0 ? 0 : sum(values.slice(i * 12, i * 12 + 12)); };
  const cases = facilities.flatMap((facility): SuddenCase[] => {
    const byYear = Object.fromEntries(years.map((year) => [year, yearSum(facility.values, year)]));
    const base = sum(SUDDEN_BASE_YEARS.map((year) => byYear[year] ?? 0)) / SUDDEN_BASE_YEARS.length;
    const studied = SUDDEN_YEARS.map((year) => byYear[year] ?? 0);
    const peak = Math.max(...studied);
    const earlier = Math.max(...studied.slice(0, -1));
    if (peak >= SUDDEN_MIN_YEAR && peak >= SUDDEN_GROWTH * Math.max(base, 1)) return [{ facility, kind: "growth", base, byYear }];
    if (earlier >= SUDDEN_MIN_YEAR && studied.at(-1)! <= SUDDEN_DROP * earlier) return [{ facility, kind: "drop", base, byYear }];
    return [];
  });
  const peakOf = (item: SuddenCase) => Math.max(...SUDDEN_YEARS.map((year) => item.byYear[year] ?? 0));
  return cases.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "growth" ? -1 : 1) || peakOf(b) - peakOf(a) || a.facility.key.localeCompare(b.facility.key));
}

/**
 * Dane artykułu z pliku budowania. `names`: „OW|NIP” → [nazwa, miejscowość] z indeksu placówek
 * (podpis placówek z krótką serią). Brak świadczeniodawcy kontroli w danych = błąd budowania.
 */
export function buildH55ArticleData(
  file: H55ArticleFile,
  names: Map<string, [string, string]> = new Map(),
  valuePln: H55ValuePln = { national: {}, providers: {} },
  h55Valuation?: { year: string; points: ValuationPoints },
): H55ArticleData {
  const months = monthKeys(file.years);
  const series = providerSeries(file);
  const national = nationalSeries(series, months.length);
  // Kwoty świadczeniodawcy w latach: „OW|NIP” → rok → zł (rok bez wpisu = 0, gdy rok jest w danych o kwotach).
  const plnYears = Object.keys(valuePln.national);
  const providerPln = (key: string) => new Map(plnYears.map((year) => [year, Object.fromEntries(valuePln.providers[year] ?? [])[key] ?? 0]));
  const controls = H55_CONTROLS.map((control): H55Facility => {
    const values = series.get(control.provider);
    if (!values) throw new Error(`Brak hospitalizacji H55 świadczeniodawcy kontroli ${control.label} (${control.provider})`);
    const byYear = providerPln(control.provider);
    return {
      key: control.provider, label: control.label, values, control, coverage: controlCoverage(values, months, control),
      ...(plnYears.length ? { settled: settledInPeriod(values, months, control.studyFrom, control.studyTo, byYear), settledTotal: sum([...byYear.values()]), plnByYear: Object.fromEntries(byYear) } : {}),
    };
  });
  const controlled = new Set(H55_CONTROLS.map((control) => control.provider));
  // Placówki: kontrole zgrupowane po świadczeniodawcy, w kolejności pierwszej kontroli.
  const byProvider = new Map<string, H55Control[]>();
  for (const control of H55_CONTROLS) byProvider.set(control.provider, [...(byProvider.get(control.provider) ?? []), control]);
  const facilityList = [...byProvider.entries()].map(([key, list]): H55Facility => {
    const values = series.get(key)!;
    const last = list.reduce((latest, control) => control.end > latest ? control.end : latest, list[0].end);
    const coverage = periodsCoverage(values, months, list.map((control) => ({ from: control.studyFrom, to: control.studyTo })), last);
    return { key, label: list[0].label, values, control: list[0], controls: list, coverage };
  });
  const facilities = {
    series: facilityList.filter((item) => item.controls!.some((control) => control.wave === "series")),
    early: facilityList.filter((item) => item.controls!.every((control) => control.wave === "early")),
  };
  const shortSeries = shortSeriesProviders(series, controlled).map((key): H55Facility => {
    const [name, city] = names.get(key) ?? [key, ""];
    const values = series.get(key)!;
    const never = { studyFrom: "9999-12", studyTo: "9999-12", end: "9999-12-31" };
    // Podpis: miejscowość (krótko na wykresie i w tabeli), pełna nazwa w dymku.
    return { key, label: city ? formatCityName(city) : name, detail: name, values, coverage: controlCoverage(values, months, never) };
  });
  const listed = new Set([...controlled, ...shortSeries.map((item) => item.key)]);
  const others = [...series.entries()].filter(([key]) => !listed.has(key));
  const total = sum(national);
  const named = (key: string, values: number[]): H55Facility => {
    const [name, city] = names.get(key) ?? [key, ""];
    return { key, label: city ? formatCityName(city) : name, detail: name, values };
  };
  const otherFacilities = others.map(([key, values]) => named(key, values));
  const clinicYears = file.clinics?.years ?? [];
  const contractYears = file.clinics?.contractYears ?? [];
  const clinics = Object.fromEntries((file.clinics?.rows ?? []).map(([key, neuro, contract, pain, ward, since, painPln]): [string, ClinicInfo] => [key, {
    neurosurgery: Object.fromEntries(clinicYears.map((year, i) => [year, neuro[i] === 1])),
    contract: Object.fromEntries(clinicYears.flatMap((year, i) => contract[i] === null ? [] : [[year, contract[i] === 1]])),
    painClinic: Object.fromEntries(clinicYears.map((year, i) => [year, pain[i] === 1])),
    neurosurgeryWard: Object.fromEntries(clinicYears.map((year, i) => [year, ward[i] === 1])),
    since,
    painContractPln: Object.fromEntries(contractYears.flatMap((year, i) => painPln?.[i] == null ? [] : [[year, painPln[i]!]])),
  }]));
  const oneDay: Record<string, OneDayYear[]> = {};
  for (const [key, year, totalStays, oneDayScope, day0] of file.oneDay?.rows ?? []) (oneDay[key] ??= []).push({ year, total: totalStays, oneDayScope, day0 });
  return {
    product: file.product,
    years: file.years,
    months,
    national,
    nationalByYear: yearTotals(national, file.years),
    total,
    controls,
    shortSeries,
    facilities,
    totals: {
      series: sumCoverage(facilities.series.map((item) => item.coverage!)),
      early: sumCoverage(facilities.early.map((item) => item.coverage!)),
      short: sumCoverage(shortSeries.map((item) => item.coverage!)),
    },
    others: { facilities: others.length, hospitalizations: sum(others.map(([, values]) => sum(values))) },
    facilitiesWithH55: series.size,
    allFacilities: [...facilityList.map((item) => ({ ...item, detail: item.control!.name })), ...shortSeries, ...otherFacilities]
      .sort((a, b) => a.label.localeCompare(b.label, "pl") || a.key.localeCompare(b.key)),
    sudden: suddenChangeProviders(otherFacilities, file.years),
    clinics,
    providerPln: Object.fromEntries(Object.entries(valuePln.providers).reduce((map, [year, rows]) => {
      for (const [key, pln] of rows) map.set(key, { ...(map.get(key) ?? {}), [year]: pln });
      return map;
    }, new Map<string, Record<string, number>>())),
    clinicYears,
    clinicSource: file.clinics?.source ?? "",
    oneDay,
    thermolysis: file.thermolysis ? (() => {
      const byProvider: Record<string, Record<string, number>> = {};
      // Pacjenci metodą min („<5” = 1), jak w aplikacji.
      for (const [key, year, procedure, , patients] of file.thermolysis.rows) (byProvider[key] ??= {})[`${year}|${procedure}`] = patients;
      const national = file.thermolysis.national.map(([year, procedure, , patients, providers]) => ({ year, procedure, patients, providers }));
      return {
        source: file.thermolysis.source,
        years: [...new Set(national.map((row) => row.year))].sort(),
        national,
        byProvider,
        diagnoses: file.thermolysis.diagnoses.map(([year, procedure, icd, patients]) => ({ year, procedure, icd, patients })),
      };
    })() : null,
    procedure: {
      code: file.procedure.code,
      source: file.procedure.source,
      years: file.procedure.years.map(([year, hospitalizations, withProcedure, percent]) => ({ year, hospitalizations, withProcedure, percent })),
    },
    stays: (file.stays?.rows ?? []).map(([year, hospitalizations, oneDayScope, day0, day1]) => ({ year, hospitalizations, oneDayScope, day0, day1 })),
    nationalPln: valuePln.national,
    estimate: file.estimate ?? null,
    cost: totalCost(file.procedure.years.map(([year, hospitalizations]) => ({ year, hospitalizations })), valuePln.national),
    valuation: {
      h55: h55Valuation,
      hk14: file.valuation2026,
      pointValue: file.settled.rows.map(([year, group, pln, points]) => ({ year, group, pln, points, perPoint: points ? pln / points : 0 })),
    },
  };
}

/** Kod termolezji w szpitalu (H55) i w poradni (AOS, grupa Z13). */
export const HOSPITAL_THERMOLYSIS = "03.96";
export const CLINIC_THERMOLYSIS = "04.25";

/** Pacjenci z termolezją u świadczeniodawcy w roku (0 bez danych). */
export const thermolysisOf = (data: H55ArticleData, key: string, year: number, procedure: string) =>
  data.thermolysis?.byProvider[key]?.[`${year}|${procedure}`] ?? 0;

/**
 * Przeniesienie termolezji do poradni: w ostatnim roku pacjentów z 03.96 ubyło co najmniej o połowę (z ≥ 100), a pacjentów z 04.25
 * przybyło co najmniej tyle, ile wynosi połowa tego spadku. Kolejność: od największego przyrostu 04.25.
 */
export function clinicShifts(data: H55ArticleData, facilities: H55Facility[]): { facility: H55Facility; hospital: [number, number]; clinic: [number, number] }[] {
  const years = data.thermolysis?.years ?? [];
  if (years.length < 2) return [];
  const [from, to] = years.slice(-2);
  return facilities.flatMap((facility) => {
    const hospital: [number, number] = [thermolysisOf(data, facility.key, from, HOSPITAL_THERMOLYSIS), thermolysisOf(data, facility.key, to, HOSPITAL_THERMOLYSIS)];
    const clinic: [number, number] = [thermolysisOf(data, facility.key, from, CLINIC_THERMOLYSIS), thermolysisOf(data, facility.key, to, CLINIC_THERMOLYSIS)];
    const drop = hospital[0] - hospital[1];
    return hospital[0] >= 100 && hospital[1] <= hospital[0] / 2 && clinic[1] - clinic[0] >= drop / 2 ? [{ facility, hospital, clinic }] : [];
  }).sort((a, b) => (b.clinic[1] - b.clinic[0]) - (a.clinic[1] - a.clinic[0]));
}

/** Placówka po krótkiej nazwie (kontrola albo krótka seria); brak = błąd budowania. */
export function facilityByLabel(data: H55ArticleData, label: string): H55Facility {
  const facility = [...data.controls, ...data.shortSeries].find((item) => item.label === label);
  if (!facility) throw new Error(`Brak placówki w danych artykułu: ${label}`);
  return facility;
}

/** Hospitalizacje placówki w miesiącu „RRRR-MM”. */
export const monthValue = (data: H55ArticleData, facility: H55Facility, month: string) => facility.values[data.months.indexOf(month)] ?? 0;

/** Suma hospitalizacji placówki w miesiącach od–do („RRRR-MM”, włącznie). */
export function rangeValue(data: H55ArticleData, facility: H55Facility, from: string, to: string): number {
  return facility.values.reduce((total, value, i) => data.months[i] >= from && data.months[i] <= to ? total + value : total, 0);
}

/** Seria wykresu miesięcy (`GroupLineChart`): placówka w kolorze serii porównań, tylko okres aktywności. */
export interface FacilityChartLine { key: string; name: string; detail?: string; values: number[]; color: string; activeOnly: true }

/**
 * Wycinek miesięcy od–do i serie placówek dla wykresu miesięcy. Kolory z palety porównań (DESIGN.md 2.3), do 6 serii.
 */
export function facilityChart(data: H55ArticleData, labels: string[], from: string, to: string): { months: string[]; lines: FacilityChartLine[] } {
  if (labels.length > REGION_PICK_COLORS.length) throw new Error(`Za dużo serii na wykresie: ${labels.length}`);
  // Oś może wychodzić poza dane (np. do startu kontroli w 2026 r.): miesiące bez danych mają 0, a linia (`activeOnly`)
  // kończy się na ostatnim miesiącu z H55.
  const months: string[] = [];
  for (let [y, m] = from.split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= to; m === 12 ? (y += 1, m = 1) : (m += 1)) months.push(`${y}-${String(m).padStart(2, "0")}`);
  if (!months.length || data.months.indexOf(from) < 0) throw new Error(`Zły zakres miesięcy: ${from}–${to}`);
  return {
    months,
    lines: labels.map((label, i) => {
      const facility = facilityByLabel(data, label);
      const values = months.map((month) => { const at = data.months.indexOf(month); return at < 0 ? 0 : facility.values[at]; });
      return { key: facility.key, name: facility.label, detail: facility.control?.name ?? facility.detail, values, color: REGION_PICK_COLORS[i], activeOnly: true };
    }),
  };
}

/**
 * Koszt H55 dla NFZ: kwoty rozliczone (zestawienie świadczeń, od pierwszego roku z kwotami) plus szacunek dla wcześniejszych lat
 * z API (hospitalizacje × przeciętna kwota na hospitalizację w pierwszym roku z kwotami; wycena H55 w punktach była wtedy ta sama).
 */
export interface TotalCost {
  from: number;
  to: number;
  total: number;
  settled: number;
  estimated: { year: number; pln: number }[];
}

export function totalCost(api: { year: number; hospitalizations: number }[], plnByYear: Record<string, number>): TotalCost | null {
  const plnYears = Object.keys(plnByYear).map(Number).sort((a, b) => a - b);
  if (!plnYears.length) return null;
  const first = plnYears[0];
  const firstApi = api.find((row) => row.year === first);
  if (!firstApi) return null;
  const perStay = plnByYear[String(first)] / firstApi.hospitalizations;
  const estimated = api.filter((row) => row.year < first).map((row) => ({ year: row.year, pln: row.hospitalizations * perStay }));
  const settled = plnYears.reduce((total, year) => total + plnByYear[String(year)], 0);
  return { from: estimated[0]?.year ?? first, to: plnYears.at(-1)!, total: settled + estimated.reduce((total, row) => total + row.pln, 0), settled, estimated };
}

/** Co stało się z H55 w szpitalu wokół kontroli (pierwsza kontrola serii). */
export type Aftermath = "before" | "stopped" | "continued" | "returned" | "unknown";

export interface AftermathRow {
  facility: H55Facility;
  control: H55Control;
  /** H55 w 6 miesiącach przed startem kontroli, w czasie kontroli, w 6 miesiącach po jej końcu, po końcu do końca danych. */
  before: number;
  during: number;
  after6: number;
  afterAll: number;
  outcome: Aftermath;
}

/** Próg „praktycznie zero”: tyle hospitalizacji w okresie to jeszcze brak aktywności. */
const NEGLIGIBLE = 10;

/**
 * Klasyfikacja: „before” — ostatni miesiąc z H55 przed startem kontroli; „unknown” — po kontroli mniej niż 3 miesiące danych; „continued” — w pół roku po kontroli więcej niż `NEGLIGIBLE`;
 * „returned” — pół roku przerwy, potem powrót (po kontroli łącznie co najmniej 50); „stopped” — przestał w czasie kontroli lub zaraz po niej.
 */
export function aftermath(facility: H55Facility, months: string[]): AftermathRow {
  const control = facility.controls?.[0] ?? facility.control!;
  const start = months.indexOf(control.start.slice(0, 7));
  const endMonth = control.end.slice(0, 7);
  const end = months.indexOf(endMonth);
  const v = facility.values;
  const startIndex = start < 0 ? v.length : start;
  const endIndex = end < 0 ? (endMonth > months.at(-1)! ? v.length : -1) : end;
  const sumRange = (from: number, to: number) => v.slice(Math.max(0, from), Math.max(0, to)).reduce((a, b) => a + b, 0);
  const before = sumRange(startIndex - 6, startIndex);
  const during = sumRange(startIndex, endIndex + 1);
  const after6 = sumRange(endIndex + 1, endIndex + 7);
  const afterAll = sumRange(endIndex + 1, v.length);
  const monthsAfter = Math.max(0, v.length - (endIndex + 1));
  const lastActive = v.reduce((last, value, i) => value > 0 ? i : last, -1);
  const outcome: Aftermath =
    lastActive < startIndex ? "before"
      : monthsAfter < 3 ? "unknown"
        : after6 > NEGLIGIBLE ? "continued"
          : afterAll >= 50 ? "returned"
            : "stopped";
  return { facility, control, before, during, after6, afterAll, outcome };
}
