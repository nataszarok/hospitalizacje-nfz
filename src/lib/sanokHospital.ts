import { formatJgpName } from "@/lib/sanokCodes";

export const SANOK_HOSPITAL_DATA_URL = "/data/sanok_szpital_jgp.json.gz";

/** [rok, indeks zakresu, kod JGP, pacjenci, wartość zł, hosp. min, hosp. max, pobyty 6+ dni min] */
export type HospitalFact = [number, number, string, number, number, number | null, number | null, number | null];

export type SanokHospitalDataset = {
  facility: { name: string; fullName: string; nip: string; providerCode: string; address: string };
  fields: string[];
  hospitalizationYears: number[];
  partialYears: number[];
  /** Zakresy umowy z NFZ; `ward` wskazuje oddział szpitalny. */
  departments: { code: string; name: string; ward: number | null }[];
  wards: { name: string }[];
  finance: { year: number; revenue: number; netResult: number; source: string } | null;
  /** Kwoty umów z NFZ w grupach finansowania; `years[rok][i]` odpowiada `groups[i]`. */
  agreements: { groups: string[]; years: Record<string, number[]> } | null;
  /** Przychody, koszty i wynik netto z kolejnych sprawozdań finansowych. */
  financeHistory: { year: number; revenue: number; costs: number; netResult: number }[];
  codes: Record<string, string>;
  facts: HospitalFact[];
};

export type ValuePerHospitalization = {
  /** Liczba hospitalizacji przy „<5” = 1. */
  hospCount: number;
  /** Wartość rozliczona podzielona przez `hospCount`. */
  valuePerHosp: number | null;
};

export type WardRow = ValuePerHospitalization & {
  index: number;
  name: string;
  patients: number;
  value: number;
  valueShare: number;
  longStayShare: number | null;
};

export type WardYearPoint = {
  year: number;
  value: number;
  patients: number;
  valuePerHosp: number | null;
  /** Średnia wartość na hospitalizację w całym szpitalu w danym roku. */
  hospitalValuePerHosp: number | null;
};

export type HospitalCodeRow = ValuePerHospitalization & {
  code: string;
  name: string;
  wards: { name: string; share: number }[];
  patients: number;
  value: number;
  valueShare: number;
  longStayShare: number | null;
};

export type YearPoint = {
  year: number;
  patients: number;
  value: number;
  hospMin: number | null;
  partial: boolean;
};

type Totals = { patients: number; value: number; hospValue: number; hospMin: number; longStay: number };

const emptyTotals = (): Totals => ({ patients: 0, value: 0, hospValue: 0, hospMin: 0, longStay: 0 });

function add(totals: Totals, fact: HospitalFact) {
  totals.patients += fact[3];
  totals.value += fact[4];
  if (fact[5] !== null) {
    // Wartość na hospitalizację liczymy tylko z lat, w których znamy hospitalizacje.
    totals.hospValue += fact[4];
    totals.hospMin += fact[5];
    totals.longStay += fact[7] ?? 0;
  }
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function perHospitalization(totals: Totals): ValuePerHospitalization {
  return { hospCount: totals.hospMin, valuePerHosp: ratio(totals.hospValue, totals.hospMin) };
}

/** Pełne lata rozliczeń (bez roku bieżącego). */
export function fullYears(dataset: SanokHospitalDataset): number[] {
  const partial = new Set(dataset.partialYears);
  return [...new Set(dataset.facts.map((fact) => fact[0]))]
    .filter((year) => !partial.has(year))
    .sort((left, right) => left - right);
}

/** Pełne lata z oboma źródłami: rozliczeniem i plikiem hospitalizacji. */
export function summaryYears(dataset: SanokHospitalDataset): number[] {
  const hospYears = new Set(dataset.hospitalizationYears);
  return fullYears(dataset).filter((year) => hospYears.has(year));
}

export function latestSummaryYear(dataset: SanokHospitalDataset): number | null {
  const years = summaryYears(dataset);
  return years.length ? years[years.length - 1] : null;
}

const wardOf = (dataset: SanokHospitalDataset, fact: HospitalFact) => dataset.departments[fact[1]]?.ward ?? null;

export function buildWardRows(dataset: SanokHospitalDataset, years: number[]): WardRow[] {
  const allowed = new Set(years);
  const totals = dataset.wards.map(emptyTotals);
  let total = 0;
  for (const fact of dataset.facts) {
    if (!allowed.has(fact[0])) continue;
    total += fact[4];
    const ward = wardOf(dataset, fact);
    if (ward !== null) add(totals[ward], fact);
  }
  return dataset.wards
    .map((ward, index) => ({
      index,
      name: ward.name,
      patients: totals[index].patients,
      value: totals[index].value,
      valueShare: total > 0 ? totals[index].value / total : 0,
      longStayShare: ratio(totals[index].longStay, totals[index].hospMin),
      ...perHospitalization(totals[index]),
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
}

/** Średnia wartość na hospitalizację całego szpitala. */
export function hospitalValuePerHosp(rows: WardRow[]): number | null {
  const value = rows.reduce((sum, row) => sum + (row.valuePerHosp === null ? 0 : row.valuePerHosp * row.hospCount), 0);
  return ratio(value, rows.reduce((sum, row) => sum + row.hospCount, 0));
}

/** Seria roczna każdego oddziału (pełne lata): wartość, pacjenci i wartość na hospitalizację. */
export function buildWardYearSeries(dataset: SanokHospitalDataset): WardYearPoint[][] {
  const years = fullYears(dataset);
  const position = new Map(years.map((year, index) => [year, index]));
  const totals = dataset.wards.map(() => years.map(emptyTotals));
  const hospital = years.map(emptyTotals);
  for (const fact of dataset.facts) {
    const index = position.get(fact[0]);
    const ward = wardOf(dataset, fact);
    if (index === undefined || ward === null) continue;
    add(totals[ward][index], fact);
    add(hospital[index], fact);
  }
  return dataset.wards.map((_, ward) => years.map((year, index) => ({
    year,
    value: totals[ward][index].value,
    patients: totals[ward][index].patients,
    valuePerHosp: perHospitalization(totals[ward][index]).valuePerHosp,
    hospitalValuePerHosp: perHospitalization(hospital[index]).valuePerHosp,
  })));
}

/**
 * Jeden wiersz na kod JGP. Z filtrem oddziału liczby dotyczą tylko tego oddziału,
 * a lista oddziałów i tak pokazuje cały rozkład kodu.
 */
export function buildHospitalCodeRows(
  dataset: SanokHospitalDataset,
  years: number[],
  ward: number | null = null,
): HospitalCodeRow[] {
  const allowed = new Set(years);
  let total = 0;
  const byCode = new Map<string, Totals>();
  const byCodeWard = new Map<string, Map<number, number>>();
  for (const fact of dataset.facts) {
    if (!allowed.has(fact[0])) continue;
    const factWard = wardOf(dataset, fact);
    if (factWard !== null) {
      const split = byCodeWard.get(fact[2]) ?? new Map<number, number>();
      split.set(factWard, (split.get(factWard) ?? 0) + fact[4]);
      byCodeWard.set(fact[2], split);
    }
    if (ward !== null && factWard !== ward) continue;
    total += fact[4];
    const totals = byCode.get(fact[2]) ?? emptyTotals();
    add(totals, fact);
    byCode.set(fact[2], totals);
  }
  return [...byCode.entries()]
    .map(([code, totals]) => {
      const split = [...(byCodeWard.get(code) ?? new Map<number, number>()).entries()];
      const codeValue = split.reduce((sum, [, value]) => sum + value, 0);
      return {
        code,
        name: formatJgpName(dataset.codes[code] ?? code),
        wards: split
          .map(([index, value]) => ({ name: dataset.wards[index].name, share: codeValue > 0 ? value / codeValue : 0 }))
          .sort((left, right) => right.share - left.share),
        patients: totals.patients,
        value: totals.value,
        valueShare: total > 0 ? totals.value / total : 0,
        longStayShare: ratio(totals.longStay, totals.hospMin),
        ...perHospitalization(totals),
      };
    })
    .sort((left, right) => right.value - left.value || left.code.localeCompare(right.code));
}

/** Kody z najniższą wartością na hospitalizację, z pominięciem rzadkich kodów. */
export function lowestValuePerHosp(rows: HospitalCodeRow[], minHospitalizations: number): HospitalCodeRow[] {
  return rows
    .filter((row) => row.valuePerHosp !== null && row.hospCount >= minHospitalizations)
    .sort((left, right) => left.valuePerHosp! - right.valuePerHosp!);
}

/** Seria roczna (pełne lata) dla kodu lub wszystkich kodów, w oddziale lub całym szpitalu. */
export function buildYearSeries(
  dataset: SanokHospitalDataset,
  code: string | null,
  ward: number | null = null,
): YearPoint[] {
  const hospYears = new Set(dataset.hospitalizationYears);
  return fullYears(dataset).map((year) => {
    const totals = emptyTotals();
    for (const fact of dataset.facts) {
      if (fact[0] !== year || (code !== null && fact[2] !== code) || (ward !== null && wardOf(dataset, fact) !== ward)) continue;
      add(totals, fact);
    }
    return {
      year,
      patients: totals.patients,
      value: totals.value,
      hospMin: hospYears.has(year) ? totals.hospMin : null,
      partial: false,
    };
  });
}

const plnFormat = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const millionFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const thousandFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type IncomePoint = {
  year: number;
  /** Wszystkie umowy z NFZ. */
  agreements: number | null;
  /** Umowy na hospitalizacje JGP (ryczałt i produkty poza ryczałtem). */
  jgpAgreements: number | null;
  /** Wartość JGP wykazana w rozliczeniach. */
  jgpSettled: number;
  /** Przychody i koszty podmiotu ze sprawozdania finansowego. */
  revenue: number | null;
  costs: number | null;
};

const JGP_GROUP_PREFIX = "Hospitalizacje JGP";

/** Przychody w pełnych latach: umowy z NFZ, wykazana wartość JGP oraz przychody i koszty ze sprawozdań. */
export function buildIncomeSeries(dataset: SanokHospitalDataset): IncomePoint[] {
  const settled = new Map<number, number>();
  for (const fact of dataset.facts) settled.set(fact[0], (settled.get(fact[0]) ?? 0) + fact[4]);
  const groups = dataset.agreements?.groups ?? [];
  const reports = new Map((dataset.financeHistory ?? []).map((report) => [report.year, report]));
  return fullYears(dataset).map((year) => {
    const amounts = dataset.agreements?.years[String(year)];
    const report = reports.get(year);
    return {
      year,
      agreements: amounts ? amounts.reduce((sum, value) => sum + value, 0) : null,
      jgpAgreements: amounts
        ? amounts.reduce((sum, value, index) => sum + (groups[index]?.startsWith(JGP_GROUP_PREFIX) ? value : 0), 0)
        : null,
      jgpSettled: settled.get(year) ?? 0,
      revenue: report?.revenue ?? (dataset.finance?.year === year ? dataset.finance.revenue : null),
      costs: report?.costs ?? null,
    };
  });
}

/** Umowy z NFZ w danym roku wg grup, od największej. */
export function agreementComposition(dataset: SanokHospitalDataset, year: number): { group: string; amount: number }[] {
  const amounts = dataset.agreements?.years[String(year)];
  if (!amounts) return [];
  return dataset.agreements!.groups
    .map((group, index) => ({ group, amount: amounts[index] ?? 0 }))
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount);
}

export function formatPln(value: number | null): string {
  return value == null || value === 0 ? "–" : `${plnFormat.format(value)} zł`;
}

export function formatMillions(value: number): string {
  return `${value < 0 ? "−" : ""}${millionFormat.format(Math.abs(value) / 1_000_000)} mln zł`;
}

export function formatThousands(value: number | null): string {
  return value == null ? "–" : `${thousandFormat.format(value / 1000)} tys. zł`;
}

export function formatYearRange(years: number[]): string {
  if (years.length === 0) return "–";
  const first = Math.min(...years), last = Math.max(...years);
  return first === last ? String(first) : `${first}–${last}`;
}

export async function loadSanokHospitalDataset(): Promise<SanokHospitalDataset> {
  const response = await fetch(SANOK_HOSPITAL_DATA_URL);
  if (!response.ok || !response.body) throw new Error(`Nie udało się pobrać danych (${response.status}).`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ta przeglądarka nie obsługuje dekompresji danych gzip.");
  }
  const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(decompressed).text()) as SanokHospitalDataset;
}
