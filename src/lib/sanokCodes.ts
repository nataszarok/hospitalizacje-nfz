export const SANOK_DATA_URL = "/data/sanok_kody_e.json.gz";
export const ALL_CODES = "ALL";
const LONG_STAY_INDEX = 3;

export type SanokFacility = {
  key: string;
  nip: string;
  name: string;
  description: string;
};

/** [kwartał, indeks placówki, kod JGP, indeks długości pobytu, liczba hospitalizacji] */
export type SanokFact = [string, number, string, number, number];

export type SanokDataset = {
  facilities: SanokFacility[];
  lengthsOfStay: string[];
  codes: Record<string, string>;
  facts: SanokFact[];
};

export type SanokCodeRow = {
  code: string;
  name: string;
  counts: number[];
  longStayShares: (number | null)[];
};

export type SanokQuarterPoint = {
  quarter: string;
  count: number;
  longStayShare: number | null;
};

const UPPERCASE_TOKENS = /(^|[^\p{L}])(ozw|pw|crt-d|crt|deb|oink)(?=$|[^\p{L}])/gu;

/** Nazwy JGP są pisane wielkimi literami. Zostawiamy wielkie litery tylko w skrótach. */
export function formatJgpName(name: string): string {
  const lower = name.trim().toLocaleLowerCase("pl-PL")
    .replace(UPPERCASE_TOKENS, (_, separator: string, token: string) =>
      `${separator}${token.toLocaleUpperCase("pl-PL")}`);
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}

function summarize(dataset: SanokDataset, facts: SanokFact[], code: string, name: string): SanokCodeRow {
  const facilityCount = dataset.facilities.length;
  const counts = new Array<number>(facilityCount).fill(0);
  const longStay = new Array<number>(facilityCount).fill(0);
  for (const [, facility, , los, count] of facts) {
    counts[facility] += count;
    if (los === LONG_STAY_INDEX) longStay[facility] += count;
  }
  return {
    code,
    name,
    counts,
    longStayShares: counts.map((total, index) => (total > 0 ? longStay[index] / total : null)),
  };
}

export function buildTotalRow(dataset: SanokDataset): SanokCodeRow {
  return summarize(dataset, dataset.facts, ALL_CODES, "Wszystkie kody E");
}

/** Jeden wiersz na kod E, od najliczniejszego. */
export function buildCodeRows(dataset: SanokDataset): SanokCodeRow[] {
  const byCode = new Map<string, SanokFact[]>();
  for (const fact of dataset.facts) {
    const list = byCode.get(fact[2]);
    if (list) list.push(fact);
    else byCode.set(fact[2], [fact]);
  }
  return [...byCode.entries()]
    .map(([code, facts]) => summarize(dataset, facts, code, formatJgpName(dataset.codes[code] ?? code)))
    .sort((left, right) => sumCounts(right) - sumCounts(left) || left.code.localeCompare(right.code));
}

export function sumCounts(row: SanokCodeRow): number {
  return row.counts.reduce((sum, count) => sum + count, 0);
}

export function listQuarters(dataset: SanokDataset): string[] {
  return [...new Set(dataset.facts.map((fact) => fact[0]))].sort();
}

/** Seria kwartalna dla każdej placówki: liczba hospitalizacji i udział pobytów 6+ dni. */
export function buildQuarterSeries(dataset: SanokDataset, code: string): SanokQuarterPoint[][] {
  const quarters = listQuarters(dataset);
  const position = new Map(quarters.map((quarter, index) => [quarter, index]));
  return dataset.facilities.map((_, facilityIndex) => {
    const counts = new Array<number>(quarters.length).fill(0);
    const longStay = new Array<number>(quarters.length).fill(0);
    for (const [quarter, facility, factCode, los, count] of dataset.facts) {
      if (facility !== facilityIndex || (code !== ALL_CODES && factCode !== code)) continue;
      const index = position.get(quarter)!;
      counts[index] += count;
      if (los === LONG_STAY_INDEX) longStay[index] += count;
    }
    return quarters.map((quarter, index) => ({
      quarter,
      count: counts[index],
      longStayShare: counts[index] > 0 ? longStay[index] / counts[index] : null,
    }));
  });
}

const ROMAN_QUARTERS = ["I", "II", "III", "IV"];

export function formatQuarter(quarter: string): string {
  const [year, part] = quarter.split("-Q");
  return `${ROMAN_QUARTERS[Number(part) - 1]} kw. ${year}`;
}

const countFormat = new Intl.NumberFormat("pl-PL");
const shareFormat = new Intl.NumberFormat("pl-PL", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return value > 0 ? countFormat.format(value) : "–";
}

export function formatShare(value: number | null): string {
  return value == null ? "–" : shareFormat.format(value);
}

export async function loadSanokDataset(): Promise<SanokDataset> {
  const response = await fetch(SANOK_DATA_URL);
  if (!response.ok || !response.body) throw new Error(`Nie udało się pobrać danych (${response.status}).`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ta przeglądarka nie obsługuje dekompresji danych gzip.");
  }
  const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(decompressed).text()) as SanokDataset;
}
