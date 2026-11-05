import { buildHomeStats, type HomeStats } from "@/lib/homeStats";
import type { JgpSettlements } from "@/lib/jgpCatalog";
import type { RegionsMap } from "@/lib/jgpCard";
import { regionalBreakdown } from "@/lib/regions";
import type { StaticDataset, TrendsDataset } from "@/lib/staticData";

/**
 * Karta „Hospitalizacje w Polsce” (/hospitalizacje): podsumowanie wszystkich grup JGP.
 * Kwoty NFZ pochodzą z plików grup (`build-data/jgp`, `valuePln.national`).
 * Projekt i analiza: docs/karta-hospitalizacje-podsumowanie.html. Metoda konserwatywna (wartości „<5” = 1).
 */

/** Opisowe nazwy sekcji katalogu JGP (pierwsza litera kodu), ułożone z nazw grup w sekcji. */
export const JGP_SECTION_LABELS: Record<string, string> = {
  A: "Układ nerwowy",
  B: "Oko",
  C: "Jama ustna, gardło, krtań, nos i ucho",
  D: "Układ oddechowy",
  E: "Układ krążenia",
  F: "Układ pokarmowy",
  G: "Wątroba, drogi żółciowe i trzustka",
  H: "Układ mięśniowo-szkieletowy",
  J: "Skóra, tkanka podskórna i pierś",
  K: "Układ hormonalny i metabolizm",
  L: "Nerki i drogi moczowe",
  M: "Narząd rodny kobiety",
  N: "Ciąża, poród i noworodki",
  P: "Pediatria",
  Q: "Naczynia",
  S: "Krew i układ krwiotwórczy",
  T: "Urazy wielonarządowe",
};

/**
 * Rodziny grup: kody, między którymi przesuwa się kodowanie tego samego problemu (np. B19 → B19G).
 * Porównanie wielu lat ma sens dla rodziny, a nie dla jednej grupy. Lista ręczna, do rozbudowy.
 */
export interface SummaryFamily { id: string; name: string; codes: string[]; note: string }

export const SUMMARY_FAMILIES: SummaryFamily[] = [
  { id: "zacma", name: "Usunięcie zaćmy", codes: ["B18", "B18G", "B19", "B19G"], note: "Od 2019 r. operacje zaćmy rozlicza głównie grupa B19G." },
  { id: "witreoretinalne", name: "Zabiegi witreoretinalne", codes: ["B82", "B83", "B84"], note: "Zabiegi na ciele szklistym i siatkówce." },
  { id: "kregoslup", name: "Zabiegi na kręgosłupie", codes: ["H51", "H52", "H53", "H55"], note: "Od korekcji złożonych (H51) po zabiegi przezskórne (H55)." },
  { id: "ozw", name: "Ostry zespół wieńcowy (OZW)", codes: ["E10", "E11", "E12G", "E15", "E16", "E17G"], note: "Leczenie zachowawcze, diagnostyka i leczenie inwazyjne." },
  { id: "porod", name: "Poród", codes: ["N01", "N02"], note: "Poród pojedynczy, mnogi lub przedwczesny." },
  { id: "noworodki", name: "Noworodki", codes: ["N20", "N21", "N21A", "N22", "N22A", "N23", "N24", "N25", "N26"], note: "Opieka nad noworodkiem, od normalnej po intensywną." },
];

export interface SummaryYear {
  year: string;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  /** Świadczeniodawcy z co najmniej jedną hospitalizacją w roku. */
  providers: number;
  /** Udział 10% największych świadczeniodawców w hospitalizacjach roku (%). */
  top10Pct: number;
}

export interface SummarySection { letter: string; label: string; series: number[]; changePct: number | null; sharePct: number }

/** Wiersz zmiany wieloletniej: rodzina grup albo pojedyncza grupa JGP. */
export interface SummaryTrendRow {
  id: string;
  name: string;
  codes: string[];
  series: number[];
  changePct: number | null;
  /** Kod z największą liczbą hospitalizacji w ostatnim roku: link do karty grupy. */
  mainCode: string;
  family: boolean;
}

/** Przedziały długości pobytu w danych NFZ (NFZ nie podaje dokładnej liczby dni). */
export const STAY_BUCKETS = ["0 dni", "1-2 dni", "3-5 dni", "6 i więcej dni"] as const;

/** Hospitalizacje w przedziałach długości pobytu (kolejność jak `STAY_BUCKETS`). */
export interface SummaryStayYear { year: string; buckets: number[] }

/** Rozliczenia NFZ (zł) jednej sekcji albo grupy w roku `settlements.year`. */
export interface SummaryValueRow {
  code: string;
  label: string;
  valuePln: number;
  hospitalizations: number;
  /** Średnia kwota na hospitalizację (zł); `null`, gdy brak hospitalizacji. */
  perStayPln: number | null;
  sharePct: number;
  /** Zmiana kwoty od pierwszego roku z rozliczeniami (%); `null`, gdy wtedy kwoty nie było. */
  changePct: number | null;
}

/** Hospitalizacje na 100 tys. mieszkańców w województwach, rok po roku (wartości w kolejności `regions`). */
export interface SummaryRegionTimeline {
  map: RegionsMap;
  regions: [string, string][];
  years: { year: string; national: number; per100k: number[] }[];
}

export type { JgpSettlements };

export interface HospitalizationSummary extends HomeStats {
  firstYear: string;
  summaryYears: SummaryYear[];
  /** Miesiące pierwszego, poprzedniego i ostatniego roku (12 wartości; brak danych = `null`). */
  months: { year: string; values: (number | null)[] }[];
  sections: SummarySection[];
  /** Największe wzrosty i spadki od pierwszego roku (rodziny liczone razem). */
  trendChanges: { up: SummaryTrendRow[]; down: SummaryTrendRow[] };
  stays: SummaryStayYear[];
  /** Rozliczenia NFZ: suma w latach, sekcje i grupy w ostatnim roku z kwotami; `null` bez plików grup. */
  settlements: { year: string; firstYear: string; totals: { year: string; valuePln: number }[]; sections: SummaryValueRow[]; groups: SummaryValueRow[] } | null;
  regionTimeline: SummaryRegionTimeline | null;
}

/** Najmniejsza liczba hospitalizacji w pierwszym i ostatnim roku, od której pokazujemy zmianę wieloletnią. */
export const TREND_MIN_HOSPITALIZATIONS = 1000;
const TREND_LIMIT = 7;
const VALUE_GROUPS_LIMIT = 10;

const change = (first: number, last: number) => (first ? ((last - first) / first) * 100 : null);

function yearMetrics(dataset: StaticDataset, deaths: number): Pick<SummaryYear, "deaths" | "providers" | "top10Pct"> {
  const byProvider = new Map<string, number>();
  for (const [ow, nip, , , , , hMin] of dataset.facts) {
    if (hMin > 0) byProvider.set(`${ow}|${nip}`, (byProvider.get(`${ow}|${nip}`) ?? 0) + hMin);
  }
  const totals = [...byProvider.values()].sort((a, b) => b - a);
  const total = totals.reduce((sum, value) => sum + value, 0);
  const top = totals.slice(0, Math.max(1, Math.ceil(totals.length * 0.1))).reduce((sum, value) => sum + value, 0);
  return { deaths, providers: totals.length, top10Pct: total ? (top / total) * 100 : 0 };
}

function stayYears(datasets: StaticDataset[]): SummaryStayYear[] {
  const index = new Map<string, number>(STAY_BUCKETS.map((bucket, i) => [bucket, i]));
  return datasets.map((dataset) => {
    const buckets = STAY_BUCKETS.map(() => 0);
    for (const [, , , duration, , , hMin] of dataset.facts) {
      const i = index.get(duration);
      if (i !== undefined) buckets[i] += hMin;
    }
    return { year: dataset.analysisYear, buckets };
  });
}

/** Mapa w latach: ludność i słownik województw z pliku roku (brak pliku → najnowszy). */
function regionTimeline(trends: TrendsDataset, datasets: StaticDataset[], map: RegionsMap | null): SummaryRegionTimeline | null {
  const latest = datasets.at(-1);
  if (!map || !latest || !latest.populations.some(([, people]) => people > 0)) return null;
  const byYear = new Map(datasets.map((dataset) => [dataset.analysisYear, dataset]));
  const products = trends.products.map(([code]) => code);
  const regions = latest.regions;
  const years = trends.years.map((year) => {
    const dataset = byYear.get(year) ?? latest;
    const rows = new Map(regionalBreakdown(trends, products, year, "min", dataset.regions, dataset.populations).map((row) => [row.owNfz, row]));
    const all = [...rows.values()];
    const people = all.reduce((sum, row) => sum + row.population, 0);
    const national = people ? (all.reduce((sum, row) => sum + row.hospitalizations, 0) / people) * 100_000 : 0;
    return { year, national, per100k: regions.map(([owNfz]) => rows.get(owNfz)?.per100k ?? 0) };
  });
  return { map, regions, years };
}

function valueRow(code: string, label: string, valuePln: number, firstValuePln: number, hospitalizations: number, total: number): SummaryValueRow {
  return {
    code, label, valuePln, hospitalizations,
    perStayPln: hospitalizations ? valuePln / hospitalizations : null,
    sharePct: total ? (valuePln / total) * 100 : 0,
    changePct: change(firstValuePln, valuePln),
  };
}

/** Podsumowanie hospitalizacji: lata, miesiące, długość pobytu, sekcje, zmiany, kwoty NFZ, zgony i świadczeniodawcy. `datasets`: pliki roku, od najstarszego. */
export function buildHospitalizationSummary(trends: TrendsDataset, datasets: StaticDataset[], map: RegionsMap | null, settlements: JgpSettlements | null = null): HospitalizationSummary {
  const home = buildHomeStats(trends, datasets.at(-1)!, map, 10);
  const years = trends.years;
  const yearIndex = new Map(years.map((year, i) => [year, i]));
  const deaths = years.map(() => 0);
  const monthly = years.map(() => Array<number>(12).fill(0));
  const sections = new Map<string, number[]>();
  const groups = new Map<string, number[]>();
  const names = new Map<string, string>();
  for (const [, code, name] of trends.products) if (code && name) names.set(code, name);
  for (const [year, month, product, , , hMin, , dMin] of trends.monthly) {
    const i = yearIndex.get(year);
    if (i === undefined) continue;
    deaths[i] += dMin;
    monthly[i][month - 1] += hMin;
    const code = trends.products[product]?.[1];
    if (!code) continue;
    const letter = code[0];
    if (JGP_SECTION_LABELS[letter]) {
      const series = sections.get(letter) ?? years.map(() => 0);
      series[i] += hMin;
      sections.set(letter, series);
    }
    const series = groups.get(code) ?? years.map(() => 0);
    series[i] += hMin;
    groups.set(code, series);
  }

  const datasetByYear = new Map(datasets.map((dataset) => [dataset.analysisYear, dataset]));
  const summaryYears = home.years.map((y, i): SummaryYear => {
    const dataset = datasetByYear.get(y.year);
    const metrics = dataset ? yearMetrics(dataset, deaths[i]) : { deaths: deaths[i], providers: 0, top10Pct: 0 };
    return { year: y.year, hospitalizations: y.hospitalizations, mortalityPct: y.hospitalizations ? (deaths[i] / y.hospitalizations) * 100 : 0, ...metrics };
  });

  const last = years.length - 1;
  const latestTotal = home.years.at(-1)?.hospitalizations ?? 0;
  const sectionRows = [...sections.entries()]
    .map(([letter, series]): SummarySection => ({
      letter,
      label: JGP_SECTION_LABELS[letter],
      series,
      changePct: change(series[0], series[last]),
      sharePct: latestTotal ? (series[last] / latestTotal) * 100 : 0,
    }))
    .sort((a, b) => b.series[last] - a.series[last]);

  // Jednostki porównania: rodziny (suma kodów) i grupy spoza rodzin.
  const familyCodes = new Set(SUMMARY_FAMILIES.flatMap((family) => family.codes));
  const units: SummaryTrendRow[] = [
    ...SUMMARY_FAMILIES.flatMap((family): SummaryTrendRow[] => {
      const present = family.codes.filter((code) => groups.has(code));
      if (!present.length) return [];
      const series = years.map((_, i) => present.reduce((sum, code) => sum + groups.get(code)![i], 0));
      const mainCode = [...present].sort((a, b) => groups.get(b)![last] - groups.get(a)![last])[0];
      return [{ id: family.id, name: family.name, codes: present, series, changePct: change(series[0], series[last]), mainCode, family: true }];
    }),
    ...[...groups.entries()].filter(([code]) => !familyCodes.has(code)).map(([code, series]): SummaryTrendRow => ({
      id: code, name: names.get(code) ?? code, codes: [code], series, changePct: change(series[0], series[last]), mainCode: code, family: false,
    })),
  ].filter((unit) => unit.series[0] >= TREND_MIN_HOSPITALIZATIONS && unit.series[last] >= TREND_MIN_HOSPITALIZATIONS && last > 0);
  const byChange = [...units].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const trendChanges = {
    up: byChange.filter((unit) => (unit.changePct ?? 0) > 0).slice(0, TREND_LIMIT),
    down: byChange.filter((unit) => (unit.changePct ?? 0) < 0).reverse().slice(0, TREND_LIMIT),
  };

  const months = [...new Set([years[0], years[last - 1], years[last]].filter(Boolean))].map((year) => {
    const values = monthly[yearIndex.get(year)!];
    return { year, values: values.map((value) => (value > 0 ? value : null)) };
  });

  return {
    ...home,
    firstYear: years[0] ?? "",
    summaryYears,
    months,
    sections: sectionRows,
    trendChanges,
    stays: stayYears(datasets),
    settlements: settlementSummary(settlements, years, groups, names),
    regionTimeline: regionTimeline(trends, datasets, map),
  };
}

/** Kwoty NFZ: suma w latach oraz sekcje i grupy w ostatnim roku z rozliczeniami (od największej kwoty). */
function settlementSummary(settlements: JgpSettlements | null, years: string[], groups: Map<string, number[]>, names: Map<string, string>): HospitalizationSummary["settlements"] {
  if (!settlements) return null;
  const totals = new Map<string, number>();
  for (const values of Object.values(settlements)) {
    for (const [year, value] of Object.entries(values)) totals.set(year, (totals.get(year) ?? 0) + value);
  }
  const settledYears = [...totals.keys()].filter((y) => years.includes(y)).sort();
  const year = settledYears.at(-1);
  const firstYear = settledYears[0];
  if (!year) return null;
  const yearIndex = years.indexOf(year);
  const total = totals.get(year)!;
  const hospitalizationsOf = (code: string) => groups.get(code)?.[yearIndex] ?? 0;
  const sections = new Map<string, { value: number; first: number; hospitalizations: number }>();
  const groupRows: SummaryValueRow[] = [];
  for (const [code, values] of Object.entries(settlements)) {
    const value = values[year] ?? 0;
    const first = values[firstYear] ?? 0;
    if (JGP_SECTION_LABELS[code[0]]) {
      // Sekcja liczy też grupy, które zniknęły przed ostatnim rokiem (zmiany kodów w sekcji się znoszą).
      const section = sections.get(code[0]) ?? { value: 0, first: 0, hospitalizations: 0 };
      section.value += value;
      section.first += first;
      section.hospitalizations += hospitalizationsOf(code);
      sections.set(code[0], section);
    }
    if (value) groupRows.push(valueRow(code, names.get(code) ?? code, value, first, hospitalizationsOf(code), total));
  }
  return {
    year,
    firstYear,
    totals: [...totals.entries()].filter(([y]) => years.includes(y)).sort(([a], [b]) => a.localeCompare(b)).map(([y, valuePln]) => ({ year: y, valuePln })),
    sections: [...sections.entries()].filter(([, { value }]) => value > 0).map(([letter, { value, first, hospitalizations }]) => valueRow(letter, JGP_SECTION_LABELS[letter], value, first, hospitalizations, total)).sort((a, b) => b.valuePln - a.valuePln),
    groups: groupRows.sort((a, b) => b.valuePln - a.valuePln).slice(0, VALUE_GROUPS_LIMIT),
  };
}
