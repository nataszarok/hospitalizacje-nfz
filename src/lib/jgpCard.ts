import type { JgpPageData, JgpProviderRow } from "@/lib/jgpPage";
import type { RegionRow } from "@/lib/regions";

/** Mapa województw z `scripts/build_regions_map.py`: ścieżki SVG gotowe do narysowania. */
export interface RegionsMap {
  version: 1;
  source: string;
  viewBox: [number, number];
  /** [kod OW NFZ, nazwa, ścieżka SVG, [x, y] podpisu] */
  regions: [string, string, string, [number, number]][];
}

/** Zakres porównania na karcie grupy: wszyscy świadczeniodawcy albo szpitale podobne do wybranego. */
export type CompareScope = "all" | "peers";

export interface CardFilter {
  selectedKey: string | null;
  scope: CompareScope;
  /** Kody OW NFZ wybrane na mapie (pusta lista = cała Polska). */
  regions: string[];
}

/** Najwięcej województw zaznaczonych naraz (tyle kolorów linii na wykresie). */
export const MAX_REGIONS = 6;

/** Indeks wybranego świadczeniodawcy w rankingu albo -1. */
export function selectedIndex(data: JgpPageData, key: string | null): number {
  return key ? data.providers.findIndex((row) => row.key === key) : -1;
}

/**
 * Świadczeniodawcy widoczni po filtrach karty, w kolejności rankingu.
 * „Podobne szpitale” = wybrany + jego pary z modelu; województwo = OW NFZ rozliczenia.
 */
export function providerPool(data: JgpPageData, filter: CardFilter): JgpProviderRow[] {
  const selected = selectedIndex(data, filter.selectedKey);
  let rows = data.providers;
  if (filter.scope === "peers" && selected >= 0) {
    const allowed = new Set([selected, ...data.providers[selected].peers]);
    rows = rows.filter((_, i) => allowed.has(i));
  }
  if (filter.regions.length) {
    const allowed = new Set(filter.regions);
    rows = rows.filter((row) => allowed.has(row.owNfz));
  }
  return rows;
}

/**
 * Średnia krocząca z `window` ostatnich miesięcy. Na początku serii średnia z dostępnych miesięcy,
 * jeśli jest ich co najmniej `minPeriods` (domyślnie 1: pierwszy miesiąc = jego wartość).
 */
export function movingAverage(values: number[], window = 3, minPeriods = 1): (number | null)[] {
  return values.map((_, i) => {
    const part = values.slice(Math.max(0, i + 1 - window), i + 1);
    return part.length < minPeriods ? null : part.reduce((sum, value) => sum + value, 0) / part.length;
  });
}

/** Okres na wykresach „w czasie”: miesiące (domyślnie) albo lata. */
export type ChartPeriod = "month" | "year";

/** Lata z listy miesięcy „RRRR-MM” (w kolejności) i liczba miesięcy danych w każdym roku. */
export function monthYears(months: string[]): { years: string[]; monthCounts: number[] } {
  const years: string[] = [];
  const monthCounts: number[] = [];
  for (const month of months) {
    const year = month.slice(0, 4);
    if (years.at(-1) !== year) { years.push(year); monthCounts.push(0); }
    monthCounts[monthCounts.length - 1] += 1;
  }
  return { years, monthCounts };
}

/** Suma wartości miesięcznych w latach (kolejność jak w `monthYears`). */
export function sumByYear(months: string[], values: number[]): number[] {
  const out: number[] = [];
  let year = "";
  months.forEach((month, i) => {
    if (month.slice(0, 4) !== year) { year = month.slice(0, 4); out.push(0); }
    out[out.length - 1] += values[i] ?? 0;
  });
  return out;
}

/** Udział w procentach w każdym miesiącu (np. zgony / hospitalizacje); `null`, gdy mianownik to 0. */
export function ratioSeries(numerator: number[], denominator: number[]): (number | null)[] {
  return numerator.map((value, i) => denominator[i] ? (value / denominator[i]) * 100 : null);
}

/**
 * Udział w procentach z `window` ostatnich miesięcy: suma licznika / suma mianownika (nie średnia udziałów,
 * żeby miesiąc z kilkoma hospitalizacjami nie ważył tyle co duży). `null`, gdy w oknie nie ma hospitalizacji.
 */
export function movingRatio(numerator: number[], denominator: number[], window = 3): (number | null)[] {
  return numerator.map((_, i) => {
    const from = Math.max(0, i + 1 - window);
    const top = numerator.slice(from, i + 1).reduce((sum, value) => sum + value, 0);
    const bottom = denominator.slice(from, i + 1).reduce((sum, value) => sum + value, 0);
    return bottom ? (top / bottom) * 100 : null;
  });
}

/** Suma hospitalizacji miesięcznie dla grupy świadczeniodawców. */
export function sumSeries(rows: JgpProviderRow[], length: number): number[] {
  const out = Array.from({ length }, () => 0);
  for (const row of rows) row.series.forEach((value, i) => { out[i] += value; });
  return out;
}

/**
 * Ośrodki na wykresie „w czasie”: `perYear` największych w każdym roku wykresu, razem i bez powtórzeń
 * (roczne sumy z serii miesięcznej `months`). Wykres pokazuje wszystkie lata, więc ośrodek duży tylko przez
 * rok-dwa (lokalny wzrost) też ma linię, np. H52: Koszalin jest 1. w latach 2021–2023 i 37. w 2025 r.
 * Liczba linii zależy od grupy. Kolejność: suma hospitalizacji w całym okresie.
 */
export function topProvidersOfPeriod(rows: JgpProviderRow[], months: string[], perYear: number): JgpProviderRow[] {
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];
  const yearly = new Map(rows.map((row) => [row, years.map((year) => row.series.reduce((sum, value, i) => months[i]?.startsWith(year) ? sum + value : sum, 0))]));
  const total = (row: JgpProviderRow) => (yearly.get(row) ?? []).reduce((sum, value) => sum + value, 0);
  const picked = new Set<JgpProviderRow>();
  years.forEach((_, y) => {
    rows.filter((row) => (yearly.get(row)?.[y] ?? 0) > 0)
      .sort((a, b) => (yearly.get(b)?.[y] ?? 0) - (yearly.get(a)?.[y] ?? 0) || a.name.localeCompare(b.name, "pl"))
      .slice(0, perYear)
      .forEach((row) => picked.add(row));
  });
  return [...picked].sort((a, b) => total(b) - total(a) || a.name.localeCompare(b.name, "pl"));
}

/** Wskaźniki grupy świadczeniodawców (do porównania wybranego szpitala). */
export function poolStats(rows: JgpProviderRow[]) {
  const hospitalizations = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const urgent = rows.reduce((sum, row) => sum + (row.urgentPct / 100) * row.hospitalizations, 0);
  return {
    providers: rows.length,
    hospitalizations,
    deaths,
    mortalityPct: hospitalizations ? (deaths / hospitalizations) * 100 : 0,
    urgentPct: hospitalizations ? (urgent / hospitalizations) * 100 : 0,
  };
}

/** Zmiana rok do roku (%) albo `null`, gdy brak poprzedniego roku. */
export function yearChangePct(current: number, previous: number | null): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

// Kafelki kartogramu: przybliżone położenie województw na siatce 5 × 4 (kolumna, wiersz, skrót).
const CARTOGRAM_LAYOUT: Record<string, [number, number, string]> = {
  "16": [2, 1, "Zach.-pom."], "11": [3, 1, "Pomorskie"], "14": [4, 1, "Warm.-maz."],
  "08": [2, 3, "Opolskie"], "04": [1, 2, "Lubuskie"], "15": [2, 2, "Wielkopol."], "02": [3, 2, "Kuj.-pom."],
  "07": [4, 2, "Mazowieckie"], "10": [5, 2, "Podlaskie"], "01": [1, 3, "Dolnośl."], "05": [3, 3, "Łódzkie"],
  "13": [4, 3, "Świętokrz."], "03": [5, 3, "Lubelskie"], "12": [3, 4, "Śląskie"], "06": [4, 4, "Małopolskie"], "09": [5, 4, "Podkarpackie"],
};

export interface CartogramCell extends RegionRow {
  column: number;
  row: number;
  shortName: string;
  /** Wskaźnik województwa jako wielokrotność średniej Polski (1 = średnia). */
  ratio: number;
  /** Położenie na skali koloru od −1 (½ średniej i mniej) przez 0 (średnia) do 1 (2 × średnia i więcej). */
  position: number;
}

export interface CartogramScale {
  /** Hospitalizacje na 100 tys. mieszkańców w całej Polsce — środek skali. */
  national: number;
  /** Wielokrotność średniej na końcach skali (2 → od ½ × do 2 ×). */
  limit: number;
}

/** Końce skali kolorów: połowa i dwukrotność średniej Polski. */
export const RATIO_LIMIT = 2;

/**
 * Komórki mapy województw. Kolor pokazuje odchylenie od średniej Polski w skali logarytmicznej:
 * ½ × i 2 × średniej są równo oddalone od środka, a skala jest taka sama dla każdej grupy JGP —
 * niezależnie od tego, czy wskaźniki wynoszą 20 czy 150 na 100 tys. Wartości od 2 × wzwyż
 * (i od ½ × w dół) mają kolor końca skali; dokładną wartość pokazuje podpis.
 */
export function cartogramCells(regions: RegionRow[]): { cells: CartogramCell[]; scale: CartogramScale } {
  const people = regions.reduce((sum, row) => sum + row.population, 0);
  const national = people ? (regions.reduce((sum, row) => sum + row.hospitalizations, 0) / people) * 100_000 : 0;
  const limit = Math.log2(RATIO_LIMIT);
  const cells = regions.flatMap((row) => {
    const layout = CARTOGRAM_LAYOUT[row.owNfz];
    if (!layout) return [];
    const ratio = national ? row.per100k / national : 1;
    const position = ratio > 0 ? Math.max(-1, Math.min(1, Math.log2(ratio) / limit)) : -1;
    return [{ ...row, column: layout[0], row: layout[1], shortName: layout[2], ratio, position }];
  });
  return { cells, scale: { national, limit: RATIO_LIMIT } };
}

// Jedna barwa jak wcześniej: od jasnoniebieskiego (½ × średniej i mniej) przez średni niebieski
// (średnia Polski) do granatowego (2 × średniej i więcej).
const STOPS: [number, number[]][] = [[-1, [225, 233, 245]], [0, [110, 145, 204]], [1, [16, 42, 92]]];

function rgbAt(position: number): number[] {
  const t = Math.min(1, Math.max(-1, position));
  const [[p0, c0], [p1, c1]] = t <= 0 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const k = (t - p0) / (p1 - p0);
  return c0.map((value, i) => Math.round(value + (c1[i] - value) * k));
}

/** Kolor dla położenia na skali −1…1. */
export function scaleColor(position: number): string {
  const [r, g, b] = rgbAt(position);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Kolor komórki mapy. */
export function cellColor(cell: Pick<CartogramCell, "position">): string {
  return scaleColor(cell.position);
}

/** Czy podpis na komórce ma być ciemny (jasne tło). */
export function darkLabel(cell: Pick<CartogramCell, "position">): boolean {
  const [r, g, b] = rgbAt(cell.position);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

/** Świadczeniodawca w postaci krotki (dane strony wysyłane do przeglądarki są wtedy ok. 2 × mniejsze). */
export type PackedProvider = [
  key: string, name: string, city: string, hospitalizations: number, deaths: number, mortalityPct: number, urgentPct: number,
  series: number[], previousHospitalizations: number | null, valuePln: number | null, peers: number[], yearly: [number, number, number][], yearlyDeaths: number[],
];

/** Dane strony z rankingiem w krotkach; `topProviders` odtwarzamy z pełnej listy. */
export type PackedJgpPageData = Omit<JgpPageData, "providers" | "topProviders"> & { providerRows: PackedProvider[]; topCount: number };

export function packPageData(data: JgpPageData): PackedJgpPageData {
  const { providers, topProviders, ...rest } = data;
  return {
    ...rest,
    topCount: topProviders.length,
    providerRows: providers.map((row): PackedProvider => [
      row.key, row.name, row.city, row.hospitalizations, row.deaths, row.mortalityPct, row.urgentPct,
      row.series, row.previousHospitalizations, row.valuePln, row.peers, row.yearly, row.yearlyDeaths,
    ]),
  };
}

export function unpackPageData(packed: PackedJgpPageData): JgpPageData {
  const { providerRows, topCount, ...rest } = packed;
  const regionNames = new Map(packed.regions.map((row) => [row.owNfz, row.name]));
  const providers = providerRows.map(([key, name, city, hospitalizations, deaths, mortalityPct, urgentPct, series, previousHospitalizations, valuePln, peers, yearly, yearlyDeaths]): JgpProviderRow => {
    const [owNfz, nip] = key.split("|");
    return {
      key, owNfz, nip, name, city, voivodeship: regionNames.get(owNfz) ?? owNfz,
      hospitalizations, deaths, mortalityPct, urgentPct, series, previousHospitalizations, valuePln, peers, yearly, yearlyDeaths,
    };
  });
  return { ...rest, providers, topProviders: providers.slice(0, topCount) };
}

/** Struktura ośrodków nad rankingiem: udział 3 największych, miejsc 4–10 i pozostałych (%). */
export function structureShares(rows: JgpProviderRow[]): { label: string; count: number; share: number }[] {
  const total = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const part = (from: number, to: number) => rows.slice(from, to).reduce((sum, row) => sum + row.hospitalizations, 0);
  const parts = [
    { label: "3 największe", count: Math.min(3, rows.length), value: part(0, 3) },
    { label: "miejsca 4–10", count: Math.max(0, Math.min(10, rows.length) - 3), value: part(3, 10) },
    { label: `pozostałe ${Math.max(0, rows.length - 10)}`, count: Math.max(0, rows.length - 10), value: part(10, rows.length) },
  ];
  return parts.filter((item) => item.count > 0).map(({ label, count, value }) => ({ label, count, share: total ? (value / total) * 100 : 0 }));
}

/** Hospitalizacje ośrodka w kolejnych latach pliku grupy (suma krotek trybu przyjęcia). */
export function providerYearTotals(row: JgpProviderRow): number[] {
  return row.yearly.map(([planned, urgent, other]) => planned + urgent + other);
}

/** Ośrodki z mniejszą liczbą hospitalizacji nie wyznaczają skali osi Y wykresu punktowego (`outlierCap`). */
export const OUTLIER_MIN_HOSPITALIZATIONS = 10;

/**
 * Koniec skali osi Y wykresu punktowego, gdy mały ośrodek ma skrajną wartość (np. 1 hospitalizacja i 1 zgon = 100%).
 * Skala sięga 15% ponad największą wartość ośrodków z co najmniej `minN` hospitalizacjami (zaokrąglone w górę do 5).
 * `null`: żaden punkt nie wychodzi ponad skalę albo nie ma ośrodków z `minN` hospitalizacjami.
 */
export function outlierCap(points: { x: number; y: number }[], minN = OUTLIER_MIN_HOSPITALIZATIONS): number | null {
  const stable = points.filter((p) => p.x >= minN).map((p) => p.y);
  if (!stable.length) return null;
  const cap = Math.max(5, Math.ceil((Math.max(...stable) * 1.15) / 5) * 5);
  return points.some((p) => p.y > cap) ? cap : null;
}

/**
 * Linię średniej śmiertelności na wykresie punktowym ośrodków rysujemy od tej wartości (%).
 * Niższa średnia (np. B19G, ułamek procenta) leży prawie na podstawie i tylko zasłania punkty.
 */
export const MIN_MORTALITY_REFERENCE_PCT = 0.5;

/** Czy wykres śmiertelności ośrodków ma linię średniej grupy (`MIN_MORTALITY_REFERENCE_PCT`). */
export const showsMortalityReference = (mortalityPct: number) => mortalityPct >= MIN_MORTALITY_REFERENCE_PCT;

/** Lejek śmiertelności pokazujemy tylko, gdy grupa ma co najmniej tyle zgonów w roku. */
export const MIN_FUNNEL_DEATHS = 30;
/** Granice lejka: 95% (z = 1,96) i 99,8% (z = 3,09). */
export const FUNNEL_Z = { inner: 1.96, outer: 3.09 };

export type FunnelStatus = "w granicach" | "powyżej 95%" | "powyżej 99,8%" | "poniżej 95%" | "poniżej 99,8%";

/** Odchylenie, przy którym ośrodek z `n` hospitalizacjami wychodzi poza granicę (w punktach procentowych). */
export function funnelHalfWidth(mortalityPct: number, n: number, z: number): number {
  const p = mortalityPct / 100;
  return n > 0 ? z * Math.sqrt((p * (1 - p)) / n) * 100 : Infinity;
}

/** Położenie ośrodka na lejku względem śmiertelności grupy (`groupPct`). */
export function funnelStatus(ratePct: number, groupPct: number, n: number): FunnelStatus {
  const diff = ratePct - groupPct;
  if (Math.abs(diff) > funnelHalfWidth(groupPct, n, FUNNEL_Z.outer)) return diff > 0 ? "powyżej 99,8%" : "poniżej 99,8%";
  if (Math.abs(diff) > funnelHalfWidth(groupPct, n, FUNNEL_Z.inner)) return diff > 0 ? "powyżej 95%" : "poniżej 95%";
  return "w granicach";
}

/** Linie granic lejka od `nMin` do `nMax` hospitalizacji (do wykresu). */
export function funnelCurves(groupPct: number, nMin: number, nMax: number, steps = 60) {
  const xs = Array.from({ length: steps + 1 }, (_, i) => Math.round(nMin + ((nMax - nMin) * i) / steps));
  const at = (z: number, sign: 1 | -1) => xs.map((n) => Math.max(0, groupPct + sign * funnelHalfWidth(groupPct, Math.max(n, 1), z)));
  return { x: xs, inner: [at(FUNNEL_Z.inner, 1), at(FUNNEL_Z.inner, -1)], outer: [at(FUNNEL_Z.outer, 1), at(FUNNEL_Z.outer, -1)] };
}

const sumTuple = (tuple?: [number, number, number]) => tuple ? tuple[0] + tuple[1] + tuple[2] : 0;

/**
 * Karta pokazuje tylko lata, w których grupa jest w katalogu (od pierwszego do ostatniego): grupa wycofana
 * (np. E03 w latach 2017–2018) albo nowa (HK11 od 2025 r.) nie ma pustych lat na pasku i zer na wykresach.
 * `year` (najnowszy rok danych) zostaje bez zmian; rok domyślny karty daje `defaultCardYear`.
 */
export function limitToCatalogYears(data: JgpPageData): JgpPageData {
  const kept = data.admissionYears.filter((year) => data.catalogYears.includes(year));
  if (!kept.length || kept.length === data.admissionYears.length) return data;
  const from = data.admissionYears.indexOf(kept[0]);
  const to = data.admissionYears.indexOf(kept.at(-1) as string) + 1;
  const months = (values: number[]) => values.slice(from * 12, to * 12);
  const providers = data.providers.map((row) => ({ ...row, series: months(row.series), yearly: row.yearly.slice(from, to), yearlyDeaths: row.yearlyDeaths.slice(from, to) }));
  const byKey = new Map(providers.map((row) => [row.key, row]));
  return {
    ...data,
    admissionYears: data.admissionYears.slice(from, to),
    months: data.months.slice(from * 12, to * 12),
    national: { hospitalizations: months(data.national.hospitalizations), deaths: months(data.national.deaths), urgent: months(data.national.urgent) },
    providers,
    topProviders: data.topProviders.map((row) => byKey.get(row.key) ?? row),
  };
}

/** Rok domyślny karty: najnowszy rok danych albo, gdy grupy już nie ma w katalogu, ostatni rok grupy. */
export function defaultCardYear(data: JgpPageData): string {
  return data.admissionYears.length && !data.admissionYears.includes(data.year) ? data.admissionYears.at(-1) as string : data.year;
}

/**
 * Dane karty dla wybranego roku pliku grupy (indeks w `admissionYears`): ranking, liczby i województwa z tego roku.
 * Najnowszy rok: liczby ze szczegółów roku, bez ośrodków z zerem (są w danych tylko dla wcześniejszych lat). Wcześniejszy rok liczymy z krotek pliku grupy
 * (metoda konserwatywna); rozliczeń NFZ ośrodków nie ma, a pary podobnych szpitali przenumerowujemy po nowym rankingu.
 */
export function dataForYear(data: JgpPageData, yearIndex: number): JgpPageData {
  const year = data.admissionYears[yearIndex];
  const latestYear = !year || year === data.year;
  if (latestYear && data.providers.every((row) => row.hospitalizations > 0)) return data;
  const rows = latestYear ? data.providers : data.providers.map((row): JgpProviderRow => {
    const tuple = row.yearly[yearIndex];
    const hospitalizations = sumTuple(tuple);
    const deaths = row.yearlyDeaths[yearIndex] ?? 0;
    return {
      ...row,
      hospitalizations,
      deaths,
      mortalityPct: hospitalizations ? (deaths / hospitalizations) * 100 : 0,
      urgentPct: hospitalizations && tuple ? (tuple[1] / hospitalizations) * 100 : 0,
      previousHospitalizations: yearIndex > 0 ? sumTuple(row.yearly[yearIndex - 1]) : null,
      valuePln: null,
    };
  });
  const order = rows.map((_, i) => i).filter((i) => rows[i].hospitalizations > 0)
    .sort((a, b) => rows[b].hospitalizations - rows[a].hospitalizations || rows[a].name.localeCompare(rows[b].name, "pl"));
  const position = new Map(order.map((old, i) => [old, i]));
  const providers = order.map((old) => ({ ...rows[old], peers: rows[old].peers.flatMap((peer) => position.has(peer) ? [position.get(peer) as number] : []).sort((x, y) => x - y) }));
  if (latestYear) return { ...data, providers, topProviders: providers.slice(0, data.topProviders.length) };
  const regionYear = data.regionYears.find((item) => item.year === year);
  const people = new Map(data.regions.map((row) => [row.owNfz, row]));
  const regions = regionYear ? regionYear.rows.map(([owNfz, per100k, hospitalizations]) => ({
    owNfz, name: people.get(owNfz)?.name ?? owNfz, population: people.get(owNfz)?.population ?? 0, hospitalizations, per100k, deaths: 0, mortalityPct: 0, urgentPct: 0,
  })).sort((a, b) => b.per100k - a.per100k || a.name.localeCompare(b.name, "pl")) : data.regions;
  const previous = yearIndex > 0 ? rows.reduce((sum, row) => sum + (row.previousHospitalizations ?? 0), 0) : null;
  return {
    ...data,
    year,
    providers,
    topProviders: providers.slice(0, data.topProviders.length),
    providerCount: providers.length,
    hospitalizations: providers.reduce((sum, row) => sum + row.hospitalizations, 0),
    previousHospitalizations: previous,
    regions,
  };
}
