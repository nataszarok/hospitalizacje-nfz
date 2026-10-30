import { formatCityName } from "@/lib/formatters";
import { JGP_PAGE_CODES } from "@/lib/jgpPage";
import { hospitalHref, jgpHref } from "@/lib/portalLinks";
import type { StaticDataset } from "@/lib/staticData";

/** Adres indeksu wyszukiwarki (plik budowany statycznie przez `src/app/szukaj.json/route.ts`). */
export const SEARCH_INDEX_PATH = "/szukaj.json";

/**
 * Indeks wyszukiwarki portalu z najnowszego roku danych.
 * Krotki zamiast obiektów: plik pobiera przeglądarka przy pierwszym kliknięciu w pole wyszukiwania.
 */
export interface SearchIndex {
  version: 1;
  year: string;
  /** [kod JGP, nazwa, hospitalizacje w roku] — od największej liczby. */
  groups: [string, string, number][];
  /** [klucz OW|NIP, nazwa, miasto, kod OW NFZ, hospitalizacje w roku] — od największej liczby. */
  hospitals: [string, string, string, string, number][];
  /** [kod OW NFZ, nazwa województwa] */
  regions: [string, string][];
}

/** Indeks z danych jednego roku (metoda konserwatywna, jak na stronach grup). */
export function buildSearchIndex(d: StaticDataset): SearchIndex {
  const jgpByProduct = new Map(d.products.map(([code, jgp]) => [code, jgp]));
  const groupNames = new Map<string, string>();
  for (const [, jgp, name] of d.products) if (jgp && !groupNames.has(jgp)) groupNames.set(jgp, (name ?? jgp).replace(/\s*\*\s*$/, "").trim());
  const groupTotals = new Map<string, number>();
  const hospitalTotals = new Map<string, number>();
  for (const [ow, nip, product, , , , hMin] of d.facts) {
    const jgp = jgpByProduct.get(product);
    if (jgp) groupTotals.set(jgp, (groupTotals.get(jgp) ?? 0) + hMin);
    const key = `${ow}|${nip}`;
    hospitalTotals.set(key, (hospitalTotals.get(key) ?? 0) + hMin);
  }
  const groups = [...groupNames].map(([jgp, name]): [string, string, number] => [jgp, name, Math.round(groupTotals.get(jgp) ?? 0)])
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
  const hospitals = d.facilities.map(([ow, nip, name, city]): [string, string, string, string, number] =>
    [`${ow}|${nip}`, name.trim(), city.trim(), ow, Math.round(hospitalTotals.get(`${ow}|${nip}`) ?? 0)])
    .filter((row) => row[4] > 0)
    .sort((a, b) => b[4] - a[4] || a[1].localeCompare(b[1], "pl"));
  return { version: 1, year: d.analysisYear, groups, hospitals, regions: d.regions.map(([ow, name]) => [ow, name]) };
}

// --- Tekst ---------------------------------------------------------------

/** Małe litery, bez polskich znaków i znaków przestankowych. */
export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase("pl-PL")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

// Prosty rdzeń słowa: polskie końcówki fleksyjne mają zwykle 1–2 litery („Nowej Soli” → now, sol).
function stem(token: string) {
  if (token.length >= 5) return token.slice(0, -2);
  if (token.length === 4) return token.slice(0, 3);
  return token;
}

/** Czy dwa słowa to ta sama forma (odmiana) — „krakowie” = „krakow”, „nowej” = „nowa”. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  if (stem(a) === stem(b) && stem(a).length >= 3) return true;
  return Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a));
}

// Podczas wpisywania ostatnie słowo może być niedokończone: „szpit” pasuje do „szpital”.
function wordMatches(query: string, word: string, partial: boolean) {
  return sameWord(query, word) || (partial && query.length >= 2 && word.startsWith(query));
}

// Słowa potoczne, których nie ma w nazwach grup JGP. Docelowo słownik z rozpoznań ICD-10.
const SYNONYMS: Record<string, string[]> = {
  zawal: ["ozw"],
  zawaly: ["ozw"],
  zawalow: ["ozw"],
  zawalu: ["ozw"],
};

function expandSynonyms(tokens: string[]) {
  return tokens.flatMap((token) => SYNONYMS[token] ?? [token]);
}

// Słowa bez znaczenia dla wyszukiwania.
const STOPWORDS = new Set([
  "jak", "jakie", "jaka", "ile", "czy", "w", "we", "na", "do", "z", "ze", "i", "o", "od", "dla", "po", "a", "sie",
  "wygladaly", "wygladala", "wygladal", "wyglada", "byly", "bylo", "hospitalizacje", "hospitalizacji", "pokaz",
  "szpital", "szpitalu", "szpitala", "szpitalach", "szpitali", "szpitale", "grupa", "grupy", "jgp", "roku", "rok", "r",
]);

type Perspective = "compare" | "trend" | "where" | "who" | "admission";

const PERSPECTIVE_WORDS: [Perspective, string[]][] = [
  ["compare", ["tle", "porownaniu", "porownanie", "porownaj", "porownac", "innymi", "innych", "inne", "pozostalych"]],
  ["trend", ["trend", "czasie", "zmiana", "zmiany", "zmienialy", "zmienial", "latach"]],
  ["where", ["gdzie", "wojewodztwach", "wojewodztwa", "mapa", "mapie", "regionach"]],
  ["who", ["kto", "najwiecej", "osrodki", "osrodkach", "ranking", "leczy", "smiertelnosc"]],
  ["admission", ["tryb", "nagle", "nagłe", "planowe", "przyjecia", "przyjec"]],
];

function perspectiveOf(token: string): Perspective | null {
  for (const [perspective, words] of PERSPECTIVE_WORDS) if (words.some((word) => sameWord(token, word))) return perspective;
  return null;
}

// --- Wyniki podczas wpisywania -------------------------------------------

export interface GroupHit { code: string; name: string; hospitalizations: number; href: string; hasPage: boolean }
export interface HospitalHit { key: string; name: string; city: string; region: string; hospitalizations: number; href: string }

function groupHref(code: string) {
  return jgpHref(code) ?? `/analizy?jgp=${encodeURIComponent(code)}`;
}

function toGroupHit([code, name, hospitalizations]: SearchIndex["groups"][number]): GroupHit {
  return { code, name, hospitalizations, href: groupHref(code), hasPage: (JGP_PAGE_CODES as readonly string[]).includes(code) };
}

function toHospitalHit(index: SearchIndex, [key, name, city, ow, hospitalizations]: SearchIndex["hospitals"][number]): HospitalHit {
  const [owNfz, nip] = key.split("|");
  return { key, name, city: formatCityName(city), region: regionName(index, ow), hospitalizations, href: hospitalHref(owNfz, nip) };
}

function regionName(index: SearchIndex, ow: string) {
  return index.regions.find(([code]) => code === ow)?.[1] ?? ow;
}

// Każde słowo zapytania musi pasować do któregoś słowa opisu.
function allMatch(queryTokens: string[], words: string[]) {
  return queryTokens.length > 0 && queryTokens.every((token, i) => words.some((word) => wordMatches(token, word, i === queryTokens.length - 1)));
}

export function searchGroups(index: SearchIndex, query: string, limit = 6): GroupHit[] {
  const raw = tokenize(query);
  if (!raw.length) return [];
  const tokens = expandSynonyms(raw).filter((token) => !STOPWORDS.has(token));
  const compact = raw.join("");
  const scored: { row: SearchIndex["groups"][number]; score: number }[] = [];
  for (const row of index.groups) {
    const code = row[0].toLowerCase();
    let score = 0;
    if (code === compact) score = 100;
    else if (/^[a-z]\d/.test(compact) && code.startsWith(compact)) score = 80;
    else if (allMatch(tokens, tokenize(row[1]))) score = 50;
    // Grupy z kartą wyżej: karta odpowiada na więcej pytań niż eksplorator.
    if (score && (JGP_PAGE_CODES as readonly string[]).includes(row[0])) score += 5;
    if (score) scored.push({ row, score });
  }
  // Przy równym dopasowaniu wyżej grupy z większą liczbą hospitalizacji (indeks jest już tak posortowany).
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(({ row }) => toGroupHit(row));
}

export function searchHospitals(index: SearchIndex, query: string, limit = 6): HospitalHit[] {
  const tokens = tokenize(query).filter((token) => !STOPWORDS.has(token));
  if (!tokens.length) return [];
  return index.hospitals
    .filter(([, name, city]) => allMatch(tokens, [...tokenize(name), ...tokenize(city)]))
    .slice(0, limit)
    .map((row) => toHospitalHit(index, row));
}

// --- Parser zdań (bez AI) --------------------------------------------------

export interface ParsedQuery {
  group: GroupHit | null;
  /** Szpitale pasujące do słów, które zostały po rozpoznaniu grupy, roku, województwa i perspektywy. */
  hospitals: HospitalHit[];
  region: { owNfz: string; name: string } | null;
  year: string | null;
  perspective: Perspective | null;
  /** Słowa, których parser nie przypisał. */
  unknown: string[];
}

/**
 * Rozpoznaje w zdaniu: kod grupy JGP, rok, województwo, perspektywę („na tle”, „gdzie”, „trend”…) i szpital.
 * Szpital to słowa, które zostały — dopasowane do nazwy i miasta (z odmianą: „w Nowej Soli”).
 */
export function parseQuery(index: SearchIndex, query: string): ParsedQuery {
  const tokens = tokenize(query);
  const used = new Set<number>();
  const groupCodes = new Map(index.groups.map((row) => [row[0].toLowerCase(), row]));

  let group: GroupHit | null = null;
  let year: string | null = null;
  let perspective: Perspective | null = null;
  tokens.forEach((token, i) => {
    const groupRow = groupCodes.get(token);
    if (groupRow && !group) { group = toGroupHit(groupRow); used.add(i); return; }
    if (/^20\d\d$/.test(token) && !year) { year = token; used.add(i); return; }
    const p = perspectiveOf(token);
    if (p) { perspective ??= p; used.add(i); return; }
    if (STOPWORDS.has(token)) used.add(i);
  });

  // Województwo: wszystkie słowa nazwy (np. „kujawsko pomorskie”) w dowolnej formie.
  let region: ParsedQuery["region"] = null;
  for (const [owNfz, name] of index.regions) {
    const words = tokenize(name);
    const positions = words.map((word) => tokens.findIndex((token, i) => !used.has(i) && sameWord(token, word)));
    if (positions.every((position) => position >= 0)) {
      region = { owNfz, name };
      positions.forEach((position) => used.add(position));
      break;
    }
  }

  const rest = tokens.filter((_, i) => !used.has(i));
  const hospitals = rest.length
    ? index.hospitals
      .filter(([, name, city]) => allMatch(rest, [...tokenize(name), ...tokenize(city)]))
      .slice(0, 6)
      .map((row) => toHospitalHit(index, row))
    : [];
  return { group, hospitals, region, year, perspective, unknown: hospitals.length ? [] : rest };
}

// --- Interpretacja: zdanie → adres ---------------------------------------

export interface Interpretation {
  href: string;
  /** Rozpoznane elementy, w kolejności wyświetlania. */
  parts: string[];
}

const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  compare: "na tle innych ośrodków",
  trend: "w czasie",
  where: "w województwach",
  who: "kto leczy",
  admission: "tryb przyjęcia",
};

const PAGE_SECTION: Record<Perspective, string> = {
  compare: "#jgp-providers",
  trend: "#jgp-trend",
  where: "#jgp-regions",
  who: "#jgp-providers",
  admission: "#jgp-admissions",
};

const EXPLORER_TAB: Record<Perspective, string | null> = {
  compare: "k",
  trend: null,
  where: "g",
  who: "k",
  admission: "a",
};

function explorerHref(code: string, { tab, year, owNfz }: { tab?: string | null; year?: string | null; owNfz?: string }) {
  const params = new URLSearchParams();
  if (tab) params.set("t", tab);
  params.set("jgp", code);
  if (year) params.set("y", year);
  if (owNfz) params.set("ow", owNfz);
  return `/analizy?${params.toString()}`;
}

/**
 * Adresy dla zdania z co najmniej dwoma elementami (np. grupa + szpital, grupa + województwo).
 * Gdy pasuje kilka szpitali, zwraca po jednej interpretacji na szpital (największe najpierw, najwyżej 3).
 * Pojedynczy element obsługują zwykłe wyniki, więc wtedy lista jest pusta.
 */
export function interpretQuery(parsed: ParsedQuery): Interpretation[] {
  const { group, region, year, perspective } = parsed;
  const hospitals = parsed.hospitals.slice(0, 3);

  if (group && hospitals.length) {
    return hospitals.map((hospital) => ({
      href: group.hasPage
        ? `/jgp/${encodeURIComponent(group.code)}?osrodek=${encodeURIComponent(hospital.key)}`
        : explorerHref(group.code, { tab: "k", year }),
      parts: [group.code, `${hospital.name} (${hospital.city})`, PERSPECTIVE_LABEL.compare],
    }));
  }
  if (group && region) {
    return [{ href: explorerHref(group.code, { tab: EXPLORER_TAB[perspective ?? "where"] ?? null, year, owNfz: region.owNfz }), parts: [group.code, `woj. ${region.name.toLocaleLowerCase("pl-PL")}`, ...(perspective && perspective !== "where" ? [PERSPECTIVE_LABEL[perspective]] : [])] }];
  }
  if (group && year) {
    return [{ href: explorerHref(group.code, { tab: perspective ? EXPLORER_TAB[perspective] : null, year }), parts: [group.code, `rok ${year}`, ...(perspective ? [PERSPECTIVE_LABEL[perspective]] : [])] }];
  }
  if (group && perspective) {
    const href = group.hasPage ? `${group.href}${PAGE_SECTION[perspective]}` : explorerHref(group.code, { tab: EXPLORER_TAB[perspective] });
    return [{ href, parts: [group.code, PERSPECTIVE_LABEL[perspective]] }];
  }
  if (hospitals.length && perspective === "compare") {
    return hospitals.map((hospital) => ({ href: `${hospital.href}&hv=c`, parts: [`${hospital.name} (${hospital.city})`, "porównanie z podobnymi szpitalami"] }));
  }
  return [];
}

/** Wszystko, co pokazuje lista podpowiedzi dla jednego zapytania. */
export function searchAll(index: SearchIndex, query: string) {
  const parsed = parseQuery(index, query);
  const interpretations = interpretQuery(parsed);
  const groups = searchGroups(index, query);
  // Gdy zdanie zawiera grupę albo perspektywę, szpitale liczymy z reszty słów (np. „E10 Nowa Sól” → szpitale w Nowej Soli).
  const hospitals = parsed.group || parsed.region || parsed.perspective ? parsed.hospitals : searchHospitals(index, query);
  return { interpretations, groups, hospitals };
}
