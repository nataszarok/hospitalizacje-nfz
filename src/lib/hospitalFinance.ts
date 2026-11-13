import type { FinancialRecordSummary } from "@/lib/hospitalHomeStats";
import type { HospitalPaymentFile, HospitalWard } from "@/lib/hospitalPage";

/**
 * Zakładka „Finanse” karty szpitala: plan umów z NFZ (API NFZ „Umowy”, `build_nfz_contracts.py`), rozliczenia grup JGP
 * według zakresu i sposobu zapłaty (`build_hospital_payment.py`) i sprawozdanie finansowe (`financial_results`).
 * Reguły podziału pozycji umowy są tutaj, obok widoku (plik umów jest surowy).
 */

/** Zakładkę „Finanse” ma każda karta szpitala z sieci PSZ z umowami NFZ (ryczałt, porównanie z poziomem sieci). */

/** Umowy szpitala z NFZ w latach (`build-data/hospitals/contracts.json.gz`, jeden szpital). */
export interface HospitalContractsFile {
  years: string[];
  /** [indeks roku, typ świadczeń (np. 03), nazwa typu, kwota umowy zł, kod umowy] */
  agreements: [number, string, string, number, string][];
  /** [kod produktu, nazwa produktu] */
  products: [string, string][];
  /** [indeks umowy, indeks produktu, liczba jednostek, kwota pozycji zł] */
  plans: [number, number, number, number][];
}

/** Cztery drogi pieniędzy (grupy pozycji umowy), od ryczałtu do świadczeń poza leczeniem szpitalnym (poradnie, dializy, opieka paliatywna, psychiatria, opieka długoterminowa…). */
export const FINANCE_GROUPS = [
  "Ryczałt sieci szpitali i dopłaty",
  "Szpital za wykonanie: grupy JGP",
  "Szpital za wykonanie: bez grup JGP",
  "Poza leczeniem szpitalnym",
] as const;
export type FinanceGroup = 0 | 1 | 2 | 3;

/** Limit pozycji: stała kwota, bez limitu, część bez limitu, w kwocie umowy (gwiazdka = brak informacji o zniesieniu). */
export type LimitKind = "fix" | "free" | "part" | "contract";

export interface FinanceBucket { key: string; name: string; description: string; group: FinanceGroup; limit: [LimitKind, string] }

/** Pozycje umowy w grupach (kolejność = kolejność w tabeli „Za co płaci NFZ?”). */
export const FINANCE_BUCKETS: readonly FinanceBucket[] = [
  { key: "ryczalt", name: "Ryczałt sieci szpitali (PSZ)", description: "stała kwota za oddziały sieci; grupy JGP z tych oddziałów to wartość sprawozdana", group: 0, limit: ["fix", "stała kwota"] },
  { key: "owu", name: "Dopłaty do wynagrodzeń", description: "środki z rozporządzeń o podwyżkach", group: 0, limit: ["fix", "dopłata"] },
  { key: "kidsward", name: "Oddziały dziecięce", description: "pediatria i oddziały dziecięce, wyjęte z ryczałtu w 2021 r.", group: 1, limit: ["free", "bez limitu od 2021 r."] },
  { key: "birth", name: "Porody i noworodki", description: "położnictwo i neonatologia, np. ciąża wysokiego ryzyka, wcześniaki", group: 1, limit: ["contract", "w kwocie umowy*"] },
  { key: "onko", name: "Onkologia: hospitalizacje", description: "pakiet onkologiczny i leczenie poza pakietem (karta DiLO)", group: 1, limit: ["free", "bez limitu z kartą DiLO"] },
  { key: "eye", name: "Zaćma i zabiegi oka", description: "okulistyka, m.in. B16–B19G", group: 1, limit: ["free", "bez limitu od IV 2019 r."] },
  { key: "endo", name: "Endoprotezoplastyka", description: "zakres endoprotezoplastyki w ortopedii", group: 1, limit: ["free", "bez limitu od 2019 r."] },
  { key: "cardio", name: "Kardiologia inwazyjna i KOS-zawał", description: "zawał i koronarografia: E10, E11, E12G, E15", group: 1, limit: ["contract", "w kwocie umowy*"] },
  { key: "kids18", name: "Dzieci w oddziałach dla dorosłych", description: "pacjenci poniżej 18 lat, np. laryngologia", group: 1, limit: ["free", "bez limitu od 2021 r."] },
  { key: "vascular", name: "Chirurgia naczyniowa", description: "np. Q01, Q52", group: 1, limit: ["contract", "w kwocie umowy*"] },
  { key: "otherjgp", name: "Inne zakresy z grupami JGP", description: "zakresy oddziałów z osobną kwotą w umowie", group: 1, limit: ["contract", "w kwocie umowy*"] },
  { key: "lekowe", name: "Programy lekowe", description: "drogie leki podawane w programach NFZ", group: 2, limit: ["contract", "w kwocie umowy*"] },
  { key: "sor", name: "SOR", description: "szpitalny oddział ratunkowy", group: 2, limit: ["contract", "ryczałt dobowy*"] },
  { key: "chemio", name: "Chemioterapia", description: "podanie i substancje czynne", group: 2, limit: ["contract", "w kwocie umowy*"] },
  { key: "oit", name: "Intensywna terapia", description: "anestezjologia i intensywna terapia z osobną kwotą", group: 2, limit: ["contract", "w kwocie umowy*"] },
  { key: "othernonjgp", name: "Inne świadczenia szpitalne", description: "np. leczenie pęcherzowego oddzielania naskórka", group: 2, limit: ["contract", "w kwocie umowy*"] },
  { key: "aos", name: "Poradnie i badania", description: "poradnie specjalistyczne, TK, diagnostyka onkologiczna", group: 3, limit: ["part", "TK i MR bez limitu od IV 2019 r."] },
  { key: "dializy", name: "Dializy", description: "hemodializa i dializa otrzewnowa (świadczenia kontraktowane odrębnie)", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "paliatywna", name: "Opieka paliatywna", description: "oddział medycyny paliatywnej, hospicjum, poradnia", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "psychiatria", name: "Psychiatria i uzależnienia", description: "centrum zdrowia psychicznego, oddziały i poradnie psychiatryczne, terapia uzależnień", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "dlugoterminowa", name: "Opieka długoterminowa", description: "zakład opiekuńczo-leczniczy i pielęgnacyjno-opiekuńczy, opieka domowa", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "nisoz", name: "Nocna i świąteczna opieka", description: "lekarz i pielęgniarka po godzinach", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "rehab", name: "Rehabilitacja", description: "fizjoterapia, rehabilitacja dzienna", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "transport", name: "Transport sanitarny", description: "np. transport noworodków", group: 3, limit: ["contract", "w kwocie umowy*"] },
  { key: "inne", name: "Pozostałe", description: "stomatologia, profilaktyka, programy pilotażowe (np. „Dobry posiłek”)", group: 3, limit: ["contract", "w kwocie umowy*"] },
];
const BUCKET_INDEX = new Map(FINANCE_BUCKETS.map((bucket, i) => [bucket.key, i]));
export const bucketIndex = (key: string) => BUCKET_INDEX.get(key)!;

/**
 * Produkt ryczałtu sieci szpitali (PSZ) w planie umowy: kod 03.0000.0XX.17 zależy od poziomu sieci
 * (010 I stopnia, 020 II, 030 III, 041 onkologiczny, 042 pulmonologiczny, 050 pediatryczny, 060 ogólnopolski).
 */
export const isLumpSumProduct = (code: string) => /^03\.0000\.0\d\d\.17$/.test(code);
/**
 * Rok bazowy indeksu ryczałtu (= 100): pierwszy pełny rok sieci szpitali. W 2017 r. sieć działała od 1 października,
 * więc plan 2017 obejmuje 3 miesiące i nie nadaje się na bazę.
 */
export const LUMP_BASE_YEAR = "2018";

/**
 * Grupa pozycji planu umowy z kodu produktu (rodzaj.kod resortowy.produkt.wersja) i nazwy. Rodzaj umowy (typ świadczeń) nie wystarcza:
 * umowa „Leczenie szpitalne” sieci szpitali zawiera też poradnie (02.*), nocną opiekę (01.*) i transport (17.*).
 */
export function classifyProduct(code: string, name: string): string {
  const [kind = "", ward = ""] = code.split(".");
  const upper = name.toLocaleUpperCase("pl-PL");
  if (isLumpSumProduct(code)) return "ryczalt";
  if (ward.startsWith("999")) return "owu";
  if (kind === "03") {
    if (ward === "3300" || upper.includes("RATUNKOW")) return "sor";
    if (upper.includes("PROGRAM LEKOW") || upper.includes("PROGRAMIE LEKOW") || upper.includes("TECHNOLOGII LEKOW")) return "lekowe";
    if (upper.includes("CHEMIOTERAPI")) return "chemio";
    if (ward.startsWith("426")) return "oit";
    if (upper.includes("PĘCHERZOW")) return "othernonjgp";
    if (/^4\d{3}$/.test(ward)) return hospitalScopeBucket(ward, upper);
    return "othernonjgp";
  }
  if (kind === "02") return "aos";
  if (kind === "01") return "nisoz";
  if (kind === "05") return "rehab";
  if (kind === "17") return "transport";
  if (kind === "11" && upper.includes("DIALIZ")) return "dializy";
  if (kind === "15") return "paliatywna";
  if (kind === "04" || upper.includes("ZDROWIA PSYCHICZNEGO") || upper.includes("PSYCHIATR")) return "psychiatria";
  if (kind === "14") return "dlugoterminowa";
  return "inne";
}

/** Zakres hospitalizacji (03.4xxx) z osobną kwotą: kolejność reguł od najbardziej szczegółowej (wiek, rozpoznanie, zabieg, oddział). */
function hospitalScopeBucket(ward: string, upper: string): string {
  if (upper.includes("18. ROKU")) return "kids18";
  if (upper.includes("ONKOLOG")) return "onko";
  if (upper.includes("ENDOPROTEZ")) return "endo";
  if (ward.startsWith("460")) return "eye";
  if (ward === "4100" || upper.includes("KOS-ZAWAŁ")) return "cardio";
  if (ward.startsWith("442") || ward.startsWith("445")) return "birth";
  // Oddziały dziecięce: kod resortowy kończy się na 1 (4401 pediatria, 4501 chirurgia dziecięca, 4221 neurologia dziecięca…).
  if (/^4\d{2}1$/.test(ward) || upper.includes("DZIECI")) return "kidsward";
  if (ward.startsWith("453")) return "vascular";
  return "otherjgp";
}

/** Pozycje planu pokazane w rozwinięciu wiersza tabeli (reszta zsumowana). */
export const FINANCE_ITEMS_SHOWN = 8;
/** Kody JGP przy pozycji umowy i przy zakresie oddziału (reszta jako liczba „+n”); 6 największych — najwięcej danych karty to te kody. */
export const FINANCE_CHIPS_SHOWN = 6;

/** Kod JGP z kwotą rozliczenia w tys. zł (do podpowiedzi); trzeci element 1 = grupa w obu częściach oddziału (ryczałt i za wykonanie). */
export type FinanceChip = [code: string, thousands: number] | [code: string, thousands: number, both: 1];

/**
 * Oddział w rozliczeniach roku, krotka (zagregowana podczas budowania): indeks w `wards` (kod, nazwa, łóżka), ryczałt i za wykonanie (zł),
 * liczba grup JGP tylko w ryczałcie, tylko za wykonanie i w obu częściach, zakresy: [indeks w `scopes`, za wykonanie 0/1, zł, kody JGP, liczba grup].
 */
export type FinanceWard = [
  ward: number, lump: number, paid: number, onlyLump: number, onlyPaid: number, both: number,
  scopes: [scope: number, paid: 0 | 1, value: number, chips: FinanceChip[], groups: number][],
];

/** Rozliczenia grup JGP jednego roku, zagregowane podczas budowania (do przeglądarki idą gotowe tabele, nie wiersze grup JGP). */
export interface FinanceYear {
  /** Grupy JGP w zakresach ryczałtowych i za wykonanie (zł). */
  lump: number;
  paid: number;
  /** „Jak NFZ płaci za oddziały?”: od największej kwoty. */
  wards: FinanceWard[];
  /** „Gdzie są pieniądze?”: [litera sekcji, ryczałt zł, za wykonanie zł]. */
  sections: [letter: string, lump: number, paid: number][];
  /** Największe grupy JGP pozycji umowy: [indeks pozycji z `FINANCE_BUCKETS`, kody, liczba grup]. */
  groups: [bucket: number, chips: FinanceChip[], count: number][];
}

/** Dane zakładki „Finanse” jednego szpitala (liczone podczas budowania; tablice lat mają długość `years` karty). */
export interface HospitalFinance {
  /** Plan umów z NFZ: [indeks grupy pozycji z `FINANCE_BUCKETS`][rok] zł. */
  plan: number[][];
  /** Rozliczone grupy JGP: [indeks grupy pozycji][rok] zł (ryczałt = wartość sprawozdana w zakresach bez osobnej kwoty). */
  settled: number[][];
  /** Nazwy produktów planu (słownik dla `items`). */
  names: string[];
  /** Pozycje planu: [indeks grupy pozycji, rok, indeks nazwy, zł]; w grupie i roku największe, reszta jako „pozostałe pozycje (n)”. */
  items: [number, number, number, number][];
  /** Sprawozdanie finansowe: przychody i wynik netto w latach karty (`null` = brak). */
  revenue: (number | null)[];
  net: (number | null)[];
  /** Ryczałt PSZ w latach jako indeks wobec średniej szpitali tego samego poziomu sieci; `null` poza siecią. */
  lumpIndex: LumpIndex | null;
  /** Zakresy umowy [kod, nazwa] (słownik dla oddziałów). */
  scopes: [string, string][];
  /** Oddziały z rozliczeń [kod resortowy, nazwa, łóżka RPWDL albo `null`] (słownik dla `FinanceWard`). */
  wards: [string, string, number | null][];
  /** Rozliczenia grup JGP w latach karty; `null` = rok bez rozliczeń (zestawienie świadczeń jest od 2019 r.). */
  years: (FinanceYear | null)[];
}

/** Zakładka „Finanse” dla szpitala; `null` bez umów. `wards`: oddziały RPWDL (nazwa i łóżka w tabeli oddziałów). */
export function buildHospitalFinance(
  contracts: HospitalContractsFile | null, payment: HospitalPaymentFile | null, financial: FinancialRecordSummary | undefined, years: string[],
  lumpIndex: LumpIndex | null = null, wards: readonly HospitalWard[] = [],
): HospitalFinance | null {
  if (!contracts) return null;
  const zeros = () => years.map(() => 0);
  const plan = FINANCE_BUCKETS.map(zeros);
  const settled = FINANCE_BUCKETS.map(zeros);
  const positions = new Map<string, { bucket: number; year: number; name: string; value: number }>();
  for (const [agreement, product, , price] of contracts.plans) {
    const y = years.indexOf(contracts.years[contracts.agreements[agreement][0]]);
    if (y < 0 || !price) continue;
    const [code, name] = contracts.products[product];
    const bucket = bucketIndex(classifyProduct(code, name));
    plan[bucket][y] += price;
    const id = `${bucket}|${y}|${code}`;
    const item = positions.get(id) ?? { bucket, year: y, name, value: 0 };
    item.value += price;
    positions.set(id, item);
  }
  const names: string[] = [];
  const nameIndex = new Map<string, number>();
  const nameOf = (name: string) => {
    if (!nameIndex.has(name)) { nameIndex.set(name, names.length); names.push(name); }
    return nameIndex.get(name)!;
  };
  const items: HospitalFinance["items"] = [];
  const byGroup = new Map<string, { bucket: number; year: number; name: string; value: number }[]>();
  for (const item of positions.values()) {
    const id = `${item.bucket}|${item.year}`;
    byGroup.set(id, [...(byGroup.get(id) ?? []), item]);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => b.value - a.value);
    for (const item of list.slice(0, FINANCE_ITEMS_SHOWN)) items.push([item.bucket, item.year, nameOf(item.name), Math.round(item.value)]);
    const rest = list.slice(FINANCE_ITEMS_SHOWN);
    if (rest.length) items.push([rest[0].bucket, rest[0].year, nameOf(`pozostałe pozycje (${rest.length})`), Math.round(rest.reduce((sum, item) => sum + item.value, 0))]);
  }
  // Wiersze grup JGP (rok, zakres, za wykonanie, kod, zł) tylko podczas budowania: do przeglądarki idą tabele roku.
  const rows: JgpRow[] = [];
  if (payment) {
    for (const [yearIndex, scopeIndex, paid, value] of payment.value) {
      const y = years.indexOf(payment.years[yearIndex]);
      if (y < 0) continue;
      const [code, name] = payment.scopes[scopeIndex];
      settled[settledBucket(code, name, paid)][y] += value;
    }
    for (const [yearIndex, scopeIndex, paid, codeIndex, value] of payment.jgp ?? []) {
      const y = years.indexOf(payment.years[yearIndex]);
      if (y >= 0) rows.push({ y, scope: scopeIndex, paid, code: payment.codes?.[codeIndex] ?? "", value });
    }
  }
  const scopes = payment?.scopes ?? [];
  const wardList: HospitalFinance["wards"] = [];
  const record = (year: string) => financial?.years.find((item) => String(item.year) === year);
  return {
    plan: plan.map((values) => values.map(Math.round)), settled: settled.map((values) => values.map(Math.round)), names, items, lumpIndex,
    revenue: years.map((year) => record(year)?.revenue ?? null),
    net: years.map((year) => record(year)?.net_result ?? null),
    scopes, wards: wardList,
    years: years.map((_, y) => financeYear(rows.filter((row) => row.y === y), scopes, wards, wardList)),
  };
}

/** Wiersz rozliczenia grupy JGP (tylko podczas budowania). */
interface JgpRow { y: number; scope: number; paid: 0 | 1; code: string; value: number }

/** Kody JGP od największej kwoty: najwyżej `FINANCE_CHIPS_SHOWN`, kwoty w tys. zł. */
const chipsOf = (sums: Map<string, number>, both: ReadonlySet<string> = new Set()): FinanceChip[] => [...sums].sort((a, b) => b[1] - a[1]).slice(0, FINANCE_CHIPS_SHOWN)
  .map(([code, value]): FinanceChip => both.has(code) ? [code, Math.round(value / 1000), 1] : [code, Math.round(value / 1000)]);
const addTo = <K,>(map: Map<K, number>, key: K, value: number) => map.set(key, (map.get(key) ?? 0) + value);

/** Tabele jednego roku z wierszy grup JGP: podział ryczałt / za wykonanie, oddziały, sekcje JGP i grupy pozycji umowy; `null` bez rozliczeń. */
function financeYear(rows: readonly JgpRow[], scopes: readonly [string, string][], wards: readonly HospitalWard[], wardList: HospitalFinance["wards"]): FinanceYear | null {
  if (!rows.length) return null;
  let lump = 0;
  let paid = 0;
  const sections = new Map<string, [number, number]>();
  const buckets = new Map<number, Map<string, number>>();
  const byScope = new Map<string, { scope: number; paid: 0 | 1; groups: Map<string, number> }>();
  for (const row of rows) {
    if (row.paid) paid += row.value; else lump += row.value;
    const section = sections.get(row.code[0]) ?? [0, 0];
    section[row.paid] += row.value;
    sections.set(row.code[0], section);
    const [scopeCode, scopeName] = scopes[row.scope];
    const bucket = settledBucket(scopeCode, scopeName, row.paid);
    addTo(buckets.get(bucket) ?? buckets.set(bucket, new Map()).get(bucket)!, row.code, row.value);
    const id = `${row.scope}|${row.paid}`;
    const entry = byScope.get(id) ?? byScope.set(id, { scope: row.scope, paid: row.paid, groups: new Map() }).get(id)!;
    addTo(entry.groups, row.code, row.value);
  }
  return {
    lump, paid,
    wards: financeWards([...byScope.values()], scopes, wards, wardList),
    sections: [...sections].map(([letter, [sectionLump, sectionPaid]]) => [letter, sectionLump, sectionPaid]),
    groups: [...buckets].map(([bucket, sums]) => [bucket, chipsOf(sums), sums.size]),
  };
}

/**
 * „Jak NFZ płaci za oddziały?”: wiersz = kod oddziału z kodu zakresu (03.<4450>.260.02 → 4450). Nazwa i łóżka z oddziałów RPWDL
 * o tym samym kodzie; bez nich nazwa z zakresu. Od największej kwoty grup JGP.
 */
function financeWards(
  entries: { scope: number; paid: 0 | 1; groups: Map<string, number> }[], scopes: readonly [string, string][], wards: readonly HospitalWard[],
  wardList: HospitalFinance["wards"],
): FinanceWard[] {
  const rows = new Map<string, { lump: number; paid: number; entries: typeof entries; lumpCodes: Set<string>; paidCodes: Set<string> }>();
  for (const entry of entries) {
    const ward = scopes[entry.scope][0].split(".")[1] ?? "";
    const row = rows.get(ward) ?? rows.set(ward, { lump: 0, paid: 0, entries: [], lumpCodes: new Set(), paidCodes: new Set() }).get(ward)!;
    const value = [...entry.groups.values()].reduce((sum, amount) => sum + amount, 0);
    if (entry.paid) row.paid += value; else row.lump += value;
    row.entries.push(entry);
    for (const code of entry.groups.keys()) (entry.paid ? row.paidCodes : row.lumpCodes).add(code);
  }
  return [...rows].map(([ward, row]): FinanceWard => {
    let index = wardList.findIndex(([code]) => code === ward);
    if (index < 0) {
      const own = wards.filter(([wardCode]) => wardCode === ward);
      const scopeName = scopes[row.entries[0].scope][1];
      index = wardList.push([ward, own[0]?.[1] ?? sentenceCase(scopeName.split(/\s+-\s+/)[0]), own.length ? own.reduce((sum, [, , beds]) => sum + beds, 0) : null]) - 1;
    }
    const both = new Set([...row.lumpCodes].filter((code) => row.paidCodes.has(code)));
    const scopeRows = row.entries.map((entry): FinanceWard[6][number] => [
      entry.scope, entry.paid, [...entry.groups.values()].reduce((sum, amount) => sum + amount, 0), chipsOf(entry.groups, both), entry.groups.size,
    ]).sort((a, b) => b[2] - a[2]);
    return [index, row.lump, row.paid, row.lumpCodes.size - both.size, row.paidCodes.size - both.size, both.size, scopeRows];
  }).sort((a, b) => b[1] + b[2] - (a[1] + a[2]));
}

/** Oddział roku do widoku: kod, nazwa, łóżka, kwoty, liczby grup JGP i zakresy z kodem i nazwą (z krotek `FinanceWard`). */
export interface WardRow {
  code: string; name: string; beds: number | null; lump: number; paid: number; onlyLump: number; onlyPaid: number; both: number;
  scopes: { code: string; name: string; paid: boolean; value: number; chips: FinanceChip[]; groups: number }[];
}

/** „Jak NFZ płaci za oddziały?”: oddziały roku od największej kwoty grup JGP; rok bez rozliczeń — pusta lista. */
export function wardRows(finance: HospitalFinance, y: number): WardRow[] {
  return (finance.years[y]?.wards ?? []).map(([ward, lump, paid, onlyLump, onlyPaid, both, scopes]) => {
    const [code, name, beds] = finance.wards[ward];
    return {
      code, name, beds, lump, paid, onlyLump, onlyPaid, both,
      scopes: scopes.map(([scope, scopePaid, value, chips, groups]) => ({ code: finance.scopes[scope][0], name: finance.scopes[scope][1], paid: scopePaid === 1, value, chips, groups })),
    };
  });
}

/** Grupa pozycji rozliczenia grup JGP: zakres bez osobnej kwoty = ryczałt; za wykonanie według zakresu (poza grupą JGP → „inne zakresy”). */
export function settledBucket(code: string, name: string, paid: 0 | 1): number {
  if (!paid) return bucketIndex("ryczalt");
  const bucket = FINANCE_BUCKETS[bucketIndex(classifyProduct(code, name))];
  return bucketIndex(bucket.group === 1 ? bucket.key : "otherjgp");
}

/** Sumy czterech grup (drogi pieniędzy) w roku: [ryczałt, za wykonanie z JGP, bez JGP, poza leczeniem szpitalnym]. */
export function groupSums(values: number[][], y: number): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0];
  FINANCE_BUCKETS.forEach((bucket, i) => { out[bucket.group] += values[i][y] ?? 0; });
  return out;
}

/** Suma planu wszystkich pozycji w każdym roku. */
export const planTotals = (finance: HospitalFinance) => finance.plan[0].map((_, y) => finance.plan.reduce((sum, values) => sum + values[y], 0));

/** Rozliczenia grup JGP w roku: [w zakresach ryczałtowych, za wykonanie]. */
export function lumpSplit(finance: HospitalFinance, y: number): { lump: number; paid: number } {
  const year = finance.years[y];
  return { lump: year?.lump ?? 0, paid: year?.paid ?? 0 };
}

/** Lata z rozliczeniami grup JGP (zestawienie świadczeń jest od 2019 r.). */
export const settledYears = (finance: HospitalFinance) => finance.years.flatMap((year, y) => year && year.lump + year.paid > 0 ? [y] : []);

/** Podział kwoty na ryczałt i za wykonanie słowami: zawsze obie części, nigdy samo „13% za wykonanie”. */
export function payShareText(paidPct: number): string {
  const paid = Math.round(paidPct);
  if (paid <= 0) return "100% ryczałt";
  if (paid >= 100) return "100% za wykonanie";
  return `${100 - paid}% ryczałt · ${paid}% za wykonanie`;
}

/** Słowa zostawiane wielkimi literami w nazwach NFZ: kody grup i rozpoznań (N01, E12G), liczby rzymskie i skróty. */
const KEEP_UPPER = /^[,(]*(?:[A-ZĄĆĘŁŃÓŚŹŻ]{1,4}\d[\w.]*(?:,[A-ZĄĆĘŁŃÓŚŹŻ]{1,4}\d\w*)*|II|III|IV|VI{0,3}|SOR|PSZ|OWU|KOS|TK|MR|UE|AOS|OIT|NFZ|RS|HPV|LBC|TLI|DILO)[,.)]*$/u;

/** Nazwa NFZ wielkimi literami jako zdanie: „PROGRAM LEKOWY - LECZENIE … E10, E11” → „Program lekowy - leczenie … E10, E11”. */
export function sentenceCase(name: string): string {
  const words = name.trim().split(/(\s+)/).map((word) => KEEP_UPPER.test(word) ? word : word.toLocaleLowerCase("pl-PL"));
  const text = words.join("");
  return text.charAt(0).toLocaleUpperCase("pl-PL") + text.slice(1);
}

/** Nazwa zakresu bez nazwy oddziału: „POŁOŻNICTWO I GINEKOLOGIA - HOSPITALIZACJA III POZIOM … - N01” → „III poziom … – N01”. */
export function scopeLabel(name: string): string {
  const rest = name.split(/\s+-\s+/).slice(1).join(" – ").replace(/^HOSPITALIZACJA\s*-?\s*/i, "").trim();
  return rest ? sentenceCase(rest) : "zakres podstawowy oddziału";
}

/** Sekcja JGP w rozliczeniach roku: kwota, udziały w kwocie i w hospitalizacjach, ryczałt / za wykonanie, kwota za pobyt wobec średniej. */
export interface SectionPayRow { letter: string; value: number; lump: number; paid: number; hospitalizations: number; valueShare: number; hospShare: number; index: number }

/** „Gdzie są pieniądze?”: sekcje JGP (pierwsza litera kodu) od największej kwoty; `hospitalizations` — hospitalizacje sekcji w roku. */
export function sectionPayRows(finance: HospitalFinance, y: number, hospitalizations: ReadonlyMap<string, number>): SectionPayRow[] {
  const sums = new Map((finance.years[y]?.sections ?? []).map(([letter, lump, paid]) => [letter, { lump, paid }]));
  const totalValue = [...sums.values()].reduce((sum, entry) => sum + entry.lump + entry.paid, 0) || 1;
  const totalHosp = [...hospitalizations.values()].reduce((sum, value) => sum + value, 0) || 1;
  return [...sums].flatMap(([letter, { lump, paid }]) => {
    const hosp = hospitalizations.get(letter) ?? 0;
    if (!hosp) return [];
    const valueShare = ((lump + paid) / totalValue) * 100;
    const hospShare = (hosp / totalHosp) * 100;
    return [{ letter, value: lump + paid, lump, paid, hospitalizations: hosp, valueShare, hospShare, index: valueShare / hospShare }];
  }).sort((a, b) => b.value - a.value);
}

/** Ryczałt PSZ szpitala jako indeks w latach i średnie indeksów: szpitale tego samego poziomu sieci i cała sieć. */
export interface LumpIndex {
  /** Rok bazowy (= 100), `LUMP_BASE_YEAR`. */
  baseYear: string;
  /** Ryczałt szpitala w latach (zł, plan umowy). */
  ownValues: number[];
  /** Indeks szpitala (rok bazowy = 100); `null` = brak ryczałtu w roku albo rok przed bazą. */
  own: (number | null)[];
  /** Poziom sieci szpitala (np. „III stopnia”), średnia indeksów szpitali tego poziomu i ich liczba w każdym roku. */
  level: string;
  levelMean: (number | null)[];
  levelCount: number[];
  /** Średnia indeksów wszystkich szpitali sieci. */
  allMean: (number | null)[];
  allCount: number[];
}

/** Poziom sieci po „szpitali”: „III stopnia” → „PSZ III stopnia”, „pediatryczny” → „pediatrycznych PSZ”. */
const LEVEL_GENITIVE: Record<string, string> = {
  pediatryczny: "pediatrycznych PSZ",
  ogólnopolski: "ogólnopolskich PSZ",
  "onkologiczny / pulmonologiczny": "onkologicznych i pulmonologicznych PSZ",
};
export const levelGenitive = (level: string) => LEVEL_GENITIVE[level] ?? `PSZ ${level}`;

/** Ryczałt PSZ w latach (zł, plan umowy; suma pozycji ryczałtu wszystkich umów roku). */
export function lumpSumByYear(contracts: HospitalContractsFile, years: readonly string[]): number[] {
  const out = years.map(() => 0);
  for (const [agreement, product, , price] of contracts.plans) {
    if (!price || !isLumpSumProduct(contracts.products[product][0])) continue;
    const y = years.indexOf(contracts.years[contracts.agreements[agreement][0]]);
    if (y >= 0) out[y] += price;
  }
  return out;
}

/** Indeks: rok `baseIndex` = 100, lata przed bazą `null`; bez ryczałtu w roku bazowym — `null` (szpitala nie da się porównać od bazy). */
export function lumpSumIndex(values: readonly number[], baseIndex: number): (number | null)[] | null {
  const base = values[baseIndex];
  if (baseIndex < 0 || !base) return null;
  return values.map((value, y) => y >= baseIndex && value > 0 ? (value / base) * 100 : null);
}

/** Zmiana r/r (%): rok do poprzedniego; `null`, gdy brak jednej z wartości. Dla indeksu i dla kwot daje ten sam wynik. */
export function yearOverYear(values: readonly (number | null)[]): (number | null)[] {
  return values.map((value, y) => {
    const previous = y > 0 ? values[y - 1] : null;
    return value !== null && previous ? ((value - previous) / previous) * 100 : null;
  });
}

/**
 * Średnie indeksów ryczałtu: dla każdego poziomu sieci i dla całej sieci, w każdym roku — średnia arytmetyczna indeksów szpitali
 * z ryczałtem w roku bazowym i w danym roku (każdy szpital waży tyle samo). Poziom szpitala: wykaz PSZ (stan bieżący).
 */
export function lumpSumReference(hospitals: readonly { level: string; index: (number | null)[] }[], yearCount: number) {
  const mean = (list: readonly { index: (number | null)[] }[]) => {
    const sums = Array.from({ length: yearCount }, () => ({ sum: 0, count: 0 }));
    for (const { index } of list) index.forEach((value, y) => { if (value !== null) { sums[y].sum += value; sums[y].count += 1; } });
    return { mean: sums.map(({ sum, count }) => count ? sum / count : null), count: sums.map(({ count }) => count) };
  };
  const levels = new Map<string, ReturnType<typeof mean>>();
  for (const level of new Set(hospitals.map((hospital) => hospital.level))) levels.set(level, mean(hospitals.filter((hospital) => hospital.level === level)));
  return { levels, all: mean(hospitals) };
}
