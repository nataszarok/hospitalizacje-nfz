import type { StaticDataset, TrendsDataset } from "@/lib/staticData";
import type { EstimationMethod } from "@/lib/types";

export interface RegionRow {
  owNfz: string;
  name: string;
  population: number;
  hospitalizations: number;
  per100k: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

/**
 * Hospitalizacje wybranych produktów w województwach (OW NFZ świadczeniodawcy) w jednym roku.
 * Wszystkie województwa ze słownika, także te bez hospitalizacji. Kolejność: najwięcej na 100 tys.
 */
export function regionalBreakdown(
  t: TrendsDataset,
  productCodes: string[],
  year: string,
  method: EstimationMethod,
  regions: [string, string][],
  populations: [string, number][],
): RegionRow[] {
  const selected = new Set(productCodes);
  const included = new Set(t.products.flatMap(([code], index) => selected.has(code) ? [index] : []));
  const totals = new Map<string, { h: number; d: number; urgent: number }>();
  for (const [rowYear, ow, product, group, hSim, hMin, dSim, dMin] of t.regional) {
    if (rowYear !== year || !included.has(product)) continue;
    const total = totals.get(ow) ?? { h: 0, d: 0, urgent: 0 };
    const h = method === "sim" ? hSim : hMin;
    total.h += h;
    total.d += method === "sim" ? dSim : dMin;
    if (group === "u") total.urgent += h;
    totals.set(ow, total);
  }
  const population = new Map(populations);
  return regions.map(([owNfz, name]): RegionRow => {
    const total = totals.get(owNfz) ?? { h: 0, d: 0, urgent: 0 };
    const people = population.get(owNfz) ?? 0;
    return {
      owNfz,
      name,
      population: people,
      hospitalizations: total.h,
      per100k: people ? (total.h / people) * 100_000 : 0,
      deaths: total.d,
      mortalityPct: total.h ? (total.d / total.h) * 100 : 0,
      urgentPct: total.h ? (total.urgent / total.h) * 100 : 0,
    };
  }).sort((a, b) => b.per100k - a.per100k || a.name.localeCompare(b.name, "pl"));
}

export interface CityRow {
  city: string;
  /** Województwa (OW NFZ), w których świadczeniodawcy z miasta mają hospitalizacje. */
  regions: string[];
  providers: number;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

/**
 * Hospitalizacje wybranych produktów według miasta siedziby świadczeniodawcy (jeden rok).
 * `owNfz`: tylko hospitalizacje rozliczone w tym OW. Kolejność: najwięcej hospitalizacji.
 * Danych o liczbie mieszkańców miast nie ma, więc nie liczymy wskaźnika na 100 tys.
 */
export function cityBreakdown(d: StaticDataset, productCodes: string[], method: EstimationMethod, owNfz?: string): CityRow[] {
  const selected = new Set(productCodes);
  const cities = new Map(d.facilities.map(([ow, nip, , city]) => [`${ow}|${nip}`, city.trim()]));
  const totals = new Map<string, { h: number; d: number; urgent: number; providers: Set<string>; regions: Set<string> }>();
  for (const [ow, nip, product, , admission, hSim, hMin, dSim, dMin] of d.facts) {
    if (!selected.has(product) || (owNfz && ow !== owNfz)) continue;
    const city = cities.get(`${ow}|${nip}`);
    if (!city) continue;
    const total = totals.get(city) ?? { h: 0, d: 0, urgent: 0, providers: new Set<string>(), regions: new Set<string>() };
    const h = method === "sim" ? hSim : hMin;
    total.h += h;
    total.d += method === "sim" ? dSim : dMin;
    if (admission === "2" || admission === "3") total.urgent += h;
    total.providers.add(`${ow}|${nip}`);
    total.regions.add(ow);
    totals.set(city, total);
  }
  return [...totals.entries()].map(([city, total]): CityRow => ({
    city,
    regions: [...total.regions].sort(),
    providers: total.providers.size,
    hospitalizations: total.h,
    deaths: total.d,
    mortalityPct: total.h ? (total.d / total.h) * 100 : 0,
    urgentPct: total.h ? (total.urgent / total.h) * 100 : 0,
  })).sort((a, b) => b.hospitalizations - a.hospitalizations || a.city.localeCompare(b.city, "pl"));
}

/** Plik `cities-map.json.gz`: miasta w rzucie mapy województw (`RegionsMap.viewBox`). */
export interface CitiesMap {
  version: 1;
  source: string;
  viewBox: [number, number];
  /** [nazwa wielkimi literami jak w danych NFZ, OW NFZ położenia, x, y, ludność, rok ludności] */
  cities: [string, string, number, number, number, string][];
}

/** `facilities/index.json`: lata i placówki (OW NFZ, NIP, nazwa, miasto siedziby wielkimi literami). */
export interface FacilityYearsIndex {
  version: 1;
  years: string[];
  facilities: [string, string, string, string][];
  /** Maska lat: bit i = placówka ma hospitalizacje (dowolne grupy) w roku `years[i]`. */
  active: number[];
}

/** `facilities/<sekcja>.json.gz`: hospitalizacje produktu w placówce w roku (kolumny, indeksy w `products` i indeksie). */
export interface FacilityYearsSection {
  version: 1;
  products: string[];
  rows: { product: number[]; facility: number[]; year: number[]; hMin: number[]; hSim: number[] };
}

/** Sekcja plików placówek i długości pobytu dla grupy JGP: pierwsza litera kodu, „_” bez kodu. */
export const citySection = (jgpCode: string | null | undefined) => jgpCode ? jgpCode[0].toUpperCase() : "_";

/** Hospitalizacje wybranych produktów: indeks placówki → wartości w kolejnych latach indeksu. */
export function facilityYearTotals(index: FacilityYearsIndex, sections: FacilityYearsSection[], productCodes: string[], method: EstimationMethod): Map<number, number[]> {
  const selected = new Set(productCodes);
  const out = new Map<number, number[]>();
  for (const section of sections) {
    const products = section.products.map((code) => selected.has(code));
    const { product, facility, year, hMin, hSim } = section.rows;
    for (let i = 0; i < product.length; i++) {
      if (!products[product[i]]) continue;
      let values = out.get(facility[i]);
      if (!values) { values = index.years.map(() => 0); out.set(facility[i], values); }
      values[year[i]] += method === "sim" ? hSim[i] : hMin[i];
    }
  }
  return out;
}

/** Sumy placówek według miasta siedziby: miasto → wartości w latach. */
export function cityYearTotals(index: FacilityYearsIndex, totals: Map<number, number[]>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const [facility, values] of totals) {
    const city = index.facilities[facility][3];
    const sum = out.get(city) ?? values.map(() => 0);
    values.forEach((value, i) => { sum[i] += value; });
    out.set(city, sum);
  }
  return out;
}

/** Placówka na mapie w jednym roku: położenie (kropka przy kropkach innych placówek tego miasta) i wartość. */
export interface FacilityDot {
  facility: number;
  owNfz: string;
  nip: string;
  name: string;
  city: string;
  x: number;
  y: number;
  r: number;
  hospitalizations: number;
}

/** Najmniej hospitalizacji placówki w roku, żeby miała kropkę (mniejsze to pojedyncze przypadki, nie ośrodki). */
export const MIN_FACILITY_HOSPITALIZATIONS = 10;

/**
 * Ciasne upakowanie kół wokół (0, 0), jak `packSiblings` z d3-hierarchy: największe koło w środku, każde następne
 * styka się z dwoma już położonymi (albo z pierwszym) w miejscu najbliższym środka, bez nakładania. `gap` = odstęp kół.
 */
export function packCircles(radii: number[], gap = 0.8): { x: number; y: number }[] {
  const placed: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) => placed.every((c) => Math.hypot(c.x - x, c.y - y) >= c.r + r + gap - 1e-6);
  for (const r of radii) {
    if (!placed.length) { placed.push({ x: 0, y: 0, r }); continue; }
    if (placed.length === 1) { placed.push({ x: placed[0].r + r + gap, y: 0, r }); continue; }
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const A = placed[a], B = placed[b];
        // Punkty w odległości rA + r + gap od A i rB + r + gap od B: przecięcie dwóch okręgów.
        const ra = A.r + r + gap, rb = B.r + r + gap;
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
        if (d === 0 || d > ra + rb || d < Math.abs(ra - rb)) continue;
        const along = (ra * ra - rb * rb + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, ra * ra - along * along));
        const mx = A.x + (along * dx) / d, my = A.y + (along * dy) / d;
        for (const sign of [1, -1]) {
          const x = mx - (sign * h * dy) / d, y = my + (sign * h * dx) / d;
          const distance = Math.hypot(x, y);
          if (distance < bestDistance && free(x, y, r)) { best = { x, y }; bestDistance = distance; }
        }
      }
    }
    // Zapas (nie powinien być potrzebny): styk z pierwszym kołem po spirali kątów.
    if (!best) {
      for (let step = 0; step < 720 && !best; step++) {
        const angle = step * 0.5, distance = placed[0].r + r + gap + step;
        const x = distance * Math.cos(angle), y = distance * Math.sin(angle);
        if (free(x, y, r)) best = { x, y };
      }
    }
    placed.push({ ...(best ?? { x: 0, y: 0 }), r });
  }
  return placed.map(({ x, y }) => ({ x, y }));
}

/**
 * Kropki placówek w roku `yearIndex`: tylko placówki z co najmniej `MIN_FACILITY_HOSPITALIZATIONS` hospitalizacji
 * wybranych grup w tym roku i z miastem w słowniku miast. Placówki jednego miasta są ciasno upakowane wokół punktu
 * miasta (`packCircles`); promień z `radius(hospitalizacje)`.
 */
export function facilityDots(index: FacilityYearsIndex, totals: Map<number, number[]>, map: CitiesMap, yearIndex: number, radius: (hospitalizations: number) => number): FacilityDot[] {
  const cities = new Map(map.cities.map((city) => [city[0], city]));
  const byCity = new Map<string, { facility: number; hospitalizations: number }[]>();
  for (const [facility, values] of totals) {
    const hospitalizations = values[yearIndex] ?? 0;
    const city = index.facilities[facility][3];
    if (hospitalizations < MIN_FACILITY_HOSPITALIZATIONS || !cities.has(city)) continue;
    const list = byCity.get(city) ?? [];
    list.push({ facility, hospitalizations });
    byCity.set(city, list);
  }
  const dots: FacilityDot[] = [];
  for (const [city, list] of byCity) {
    const [, , cx, cy] = cities.get(city)!;
    // Od największej; przy równej wartości kolejność indeksu (stały układ).
    const ordered = [...list].sort((a, b) => b.hospitalizations - a.hospitalizations || a.facility - b.facility);
    const radii = ordered.map((item) => radius(item.hospitalizations));
    const offsets = packCircles(radii);
    ordered.forEach((item, i) => {
      const [owNfz, nip, name] = index.facilities[item.facility];
      dots.push({ facility: item.facility, owNfz, nip, name, city, x: cx + offsets[i].x, y: cy + offsets[i].y, r: radii[i], hospitalizations: item.hospitalizations });
    });
  }
  return dots;
}

/** `durations/<sekcja>.json.gz`: hospitalizacje w roku według OW NFZ i długości pobytu (bez miesięcy). */
export interface DurationYearsSection {
  version: 1;
  years: string[];
  durations: string[];
  products: string[];
  rows: {
    product: number[]; year: number[]; ow: string[]; duration: number[];
    hMin: number[]; hSim: number[]; dMin: number[]; dSim: number[]; uMin: number[]; uSim: number[];
  };
}

/** Rok z filtrem długości pobytu: hospitalizacje, zgony i przyjęcia nagłe (bez planowych — plik ich nie ma). */
export interface DurationYearPoint { year: string; hospitalizations: number; deaths: number; urgent: number }

/**
 * Wybrane produkty w latach z filtrem długości pobytu, dla całej Polski albo sumy województw (`regions`).
 * `null` = żaden produkt nie ma danych w tym roku. `perProduct`: osobne serie dla każdego produktu.
 */
export function durationYears(
  sections: DurationYearsSection[],
  years: string[],
  productCodes: string[],
  method: EstimationMethod,
  durations: string[],
  regions: string[],
): Map<string, (DurationYearPoint | null)[]> {
  const selected = new Set(productCodes);
  const owFilter = regions.length ? new Set(regions) : null;
  const out = new Map<string, (DurationYearPoint | null)[]>(productCodes.map((code) => [code, years.map(() => null)]));
  for (const section of sections) {
    const durationIndex = new Set(durations.map((label) => section.durations.indexOf(label)));
    const { product, year, ow, duration, hMin, hSim, dMin, dSim, uMin, uSim } = section.rows;
    for (let i = 0; i < product.length; i++) {
      const code = section.products[product[i]];
      if (!selected.has(code)) continue;
      const yearIndex = years.indexOf(section.years[year[i]]);
      if (yearIndex < 0) continue;
      // Produkt jest w katalogu tego roku: rok ma wartość (także zero po filtrze), nie przerwę.
      const series = out.get(code)!;
      const point = series[yearIndex] ?? { year: years[yearIndex], hospitalizations: 0, deaths: 0, urgent: 0 };
      series[yearIndex] = point;
      if ((owFilter && !owFilter.has(ow[i])) || !durationIndex.has(duration[i])) continue;
      point.hospitalizations += method === "sim" ? hSim[i] : hMin[i];
      point.deaths += method === "sim" ? dSim[i] : dMin[i];
      point.urgent += method === "sim" ? uSim[i] : uMin[i];
    }
  }
  return out;
}

/** Miasto na mapie w jednym roku: położenie, ludność i hospitalizacje świadczeniodawców z siedzibą w mieście. */
export interface CityYearPoint {
  city: string;
  /** OW NFZ położenia miasta (z mapy). */
  owNfz: string;
  x: number;
  y: number;
  population: number;
  populationYear: string;
  hospitalizations: number;
  per100k: number;
}

/**
 * Punkty miast w roku `yearIndex` i wspólna skala dla wszystkich lat: `maxHospitalizations` (wielkość kropki)
 * i `medianPer100k` (środek skali koloru) liczone ze wszystkich lat, więc kropka znaczy to samo w każdym roku.
 */
export function cityYearPoints(totals: Map<string, number[]>, map: CitiesMap, yearIndex: number): {
  points: CityYearPoint[];
  missing: { city: string; hospitalizations: number }[];
  maxHospitalizations: number;
  medianPer100k: number;
} {
  const byName = new Map(map.cities.map((city) => [city[0], city]));
  const points: CityYearPoint[] = [];
  const missing: { city: string; hospitalizations: number }[] = [];
  let maxHospitalizations = 0;
  const allRates: number[] = [];
  for (const [name, values] of totals) {
    const city = byName.get(name);
    const hospitalizations = values[yearIndex] ?? 0;
    if (!city) {
      if (hospitalizations > 0) missing.push({ city: name, hospitalizations });
      continue;
    }
    const [, owNfz, x, y, population, populationYear] = city;
    for (const value of values) {
      maxHospitalizations = Math.max(maxHospitalizations, value);
      if (value > 0 && population > 0) allRates.push((value / population) * 100_000);
    }
    if (hospitalizations > 0) points.push({ city: name, owNfz, x, y, population, populationYear, hospitalizations, per100k: population ? (hospitalizations / population) * 100_000 : 0 });
  }
  allRates.sort((a, b) => a - b);
  const middle = Math.floor(allRates.length / 2);
  const medianPer100k = !allRates.length ? 0 : allRates.length % 2 ? allRates[middle] : (allRates[middle - 1] + allRates[middle]) / 2;
  points.sort((a, b) => b.hospitalizations - a.hospitalizations);
  missing.sort((a, b) => b.hospitalizations - a.hospitalizations);
  return { points, missing, maxHospitalizations, medianPer100k };
}

/** Świadczeniodawca z siedzibą w mieście: wybrane produkty w jednym roku. */
export interface CityProviderRow {
  owNfz: string;
  nip: string;
  name: string;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  urgentPct: number;
}

/** Świadczeniodawcy z siedzibą w mieście (nazwa jak w pliku miast, wielkie litery), od największej liczby hospitalizacji. */
export function cityProviders(d: StaticDataset, productCodes: string[], method: EstimationMethod, city: string): CityProviderRow[] {
  const selected = new Set(productCodes);
  const facilities = new Map(d.facilities.filter(([, , , name]) => name.trim().toUpperCase() === city).map(([ow, nip, name]) => [`${ow}|${nip}`, name]));
  const totals = new Map<string, { h: number; d: number; urgent: number }>();
  for (const [ow, nip, product, , admission, hSim, hMin, dSim, dMin] of d.facts) {
    const key = `${ow}|${nip}`;
    if (!selected.has(product) || !facilities.has(key)) continue;
    const total = totals.get(key) ?? { h: 0, d: 0, urgent: 0 };
    const h = method === "sim" ? hSim : hMin;
    total.h += h;
    total.d += method === "sim" ? dSim : dMin;
    if (admission === "2" || admission === "3") total.urgent += h;
    totals.set(key, total);
  }
  return [...totals].map(([key, total]) => {
    const [owNfz, nip] = key.split("|");
    return { owNfz, nip, name: facilities.get(key) ?? nip, hospitalizations: total.h, deaths: total.d, mortalityPct: total.h ? (total.d / total.h) * 100 : 0, urgentPct: total.h ? (total.urgent / total.h) * 100 : 0 };
  }).sort((a, b) => b.hospitalizations - a.hospitalizations);
}
