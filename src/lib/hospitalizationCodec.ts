import type { JgpGroupFile } from "@/lib/jgpPage";
import type { AdmissionGroup, RegionalTrendsDataset, StaticDataset, TrendsDataset } from "@/lib/staticData";

/**
 * Format plików `public/data/hospitalizations/` (skrypt `scripts/build_hospitalizations.py`):
 * powtarzające się teksty (świadczeniodawca, produkt, czas pobytu, tryb, rok, OW, grupa trybu) są raz
 * w słowniku, a wiersze wskazują je indeksem; wiersze są zapisane kolumnami (lista na pole).
 * Taki plik po kompresji gzip jest ok. dwa razy mniejszy niż wiersze-krotki z tekstami.
 * Funkcje poniżej odtwarzają krotki, których używa reszta aplikacji (`StaticDataset`, `TrendsDataset`,
 * `JgpGroupFile` z `public/data/jgp/`).
 * Plik w dawnym formacie (krotki) zwracają bez zmian.
 */

/** Cztery kolumny wartości: hospitalizacje i zgony, metoda `sim` i `min`. */
interface ValueColumns { hSim: number[]; hMin: number[]; dSim: number[]; dMin: number[] }

/** Fakty pliku roku: indeksy w `facilities`, `products`, `durations`, `admissions` i wartości. */
export interface FactColumns extends ValueColumns { facility: number[]; product: number[]; duration: number[]; admission: number[] }

/** Plik roku w formacie v2. */
export interface StaticDatasetFile extends Omit<StaticDataset, "facts"> { durations: string[]; admissions: string[]; facts: FactColumns }

/** Trend miesięczny: indeks roku w `years`, miesiąc 1–12, indeks produktu, indeks grupy trybu w `groups`. */
export interface MonthlyColumns extends ValueColumns { year: number[]; month: number[]; product: number[]; group: number[] }

/** Trend według OW NFZ: indeks roku, indeks OW w `branches`, indeks produktu, indeks grupy trybu. */
export interface RegionalColumns extends ValueColumns { year: number[]; branch: number[]; product: number[]; group: number[] }

/** `trends.json.gz` w formacie v2. */
export interface TrendsFile extends Omit<TrendsDataset, "monthly" | "regional"> { groups: AdmissionGroup[]; branches: string[]; monthly: MonthlyColumns; regional: RegionalColumns }

/** `trends-regions/<OW>.json.gz` w formacie v3. */
export interface RegionalTrendsFile extends Omit<RegionalTrendsDataset, "rows"> { groups: AdmissionGroup[]; rows: MonthlyColumns }

const isColumns = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value);

export function decodeStaticDataset(file: StaticDatasetFile | StaticDataset): StaticDataset {
  if (!isColumns(file.facts)) return file as StaticDataset;
  const { durations, admissions, facts: columns, ...rest } = file as StaticDatasetFile;
  const { facility, product, duration, admission, hSim, hMin, dSim, dMin } = columns;
  const facts: StaticDataset["facts"] = new Array(facility.length);
  for (let i = 0; i < facility.length; i++) {
    const [ow, nip] = rest.facilities[facility[i]];
    facts[i] = [ow, nip, rest.products[product[i]][0], durations[duration[i]], admissions[admission[i]], hSim[i], hMin[i], dSim[i], dMin[i]];
  }
  return { ...rest, facts };
}

function monthlyRows(columns: MonthlyColumns, years: string[], groups: AdmissionGroup[]): TrendsDataset["monthly"] {
  const { year, month, product, group, hSim, hMin, dSim, dMin } = columns;
  const rows: TrendsDataset["monthly"] = new Array(year.length);
  for (let i = 0; i < year.length; i++) rows[i] = [years[year[i]], month[i], product[i], groups[group[i]], hSim[i], hMin[i], dSim[i], dMin[i]];
  return rows;
}

export function decodeTrends(file: TrendsFile | TrendsDataset): TrendsDataset {
  if (!isColumns(file.monthly)) return file as TrendsDataset;
  const { groups, branches, monthly, regional, ...rest } = file as TrendsFile;
  const { year, branch, product, group, hSim, hMin, dSim, dMin } = regional;
  const regionalRows: TrendsDataset["regional"] = new Array(year.length);
  for (let i = 0; i < year.length; i++) regionalRows[i] = [rest.years[year[i]], branches[branch[i]], product[i], groups[group[i]], hSim[i], hMin[i], dSim[i], dMin[i]];
  return { ...rest, monthly: monthlyRows(monthly, rest.years, groups), regional: regionalRows };
}

export function decodeRegionalTrends(file: RegionalTrendsFile | RegionalTrendsDataset): RegionalTrendsDataset {
  if (!isColumns(file.rows)) return file as RegionalTrendsDataset;
  const { groups, rows, ...rest } = file as RegionalTrendsFile;
  return { ...rest, rows: monthlyRows(rows, rest.years, groups) };
}

/** Wiersze pliku grupy JGP (format v3): indeks świadczeniodawcy, indeks miesiąca, tryb 0/1/2, hospitalizacje, zgony. */
export interface JgpRowColumns { provider: number[]; month: number[]; admission: number[]; hospitalizations: number[]; deaths: number[] }

/** Plik grupy JGP w formacie v3. */
export interface JgpGroupFileColumns extends Omit<JgpGroupFile, "rows"> { rows: JgpRowColumns }

export function decodeJgpGroupFile(file: JgpGroupFileColumns | JgpGroupFile): JgpGroupFile {
  if (!isColumns(file.rows)) return file as JgpGroupFile;
  const { rows: columns, ...rest } = file as JgpGroupFileColumns;
  const { provider, month, admission, hospitalizations, deaths } = columns;
  const rows: JgpGroupFile["rows"] = new Array(provider.length);
  for (let i = 0; i < provider.length; i++) rows[i] = [provider[i], month[i], admission[i], hospitalizations[i], deaths[i]];
  return { ...rest, rows };
}
