/**
 * Zakładka „Struktura” karty szpitala (docs/karta-szpitala-struktura.md): części szpitala, rzut budynków, listy oddziałów
 * i poradni, sposób zapłaty NFZ. Funkcje bez Reacta: dane liczy build (`buildHospitalStructure`), układ i wyszukiwanie —
 * przeglądarka (te same funkcje, testy w `__tests__/hospitalStructure.test.ts`).
 */
import { CHART_COLORS } from "@/lib/chartPalette";
import { isLumpSumProduct, type HospitalContractsFile } from "@/lib/hospitalFinance";

// ── Dane z buildu ────────────────────────────────────────────────────────────────────────────────────────────────

/** Plik `build-data/hospitals/structure.json.gz` (`scripts/build_hospital_structure.py`). */
export interface HospitalStructureFile {
  version: number;
  names: Record<string, string>;
  fields: string[];
  sites: string[];
  nfzCodes: Record<string, [code: string, variant: string]>;
  hospitals: Record<string, {
    addr: [street: string, city: string][];
    beds: [addr: number, site: number, category: string, code: string, name: string, beds: number, icu: number, fields: number[]][];
    clinics: [addr: number, code: string, fields: number[]][];
    other: StructureOther[];
    /** Budynek (indeks adresu) → placówki (najwyżej 2, od najczęstszej), także budynków bez łóżek. */
    sites: Record<string, number[]>;
  }>;
}

/** Rodzaje miejsc bez łóżek spoza poradni: POZ, nocna i świąteczna opieka, ratownictwo, dializy, leczenie jednego dnia, sala porodowa, inne. */
export type OtherKind = "poz" | "npl" | "zrm" | "dialysis" | "day" | "delivery" | "misc";
/** Miejsce bez łóżek: adres, rodzaj, nazwa w rejestrze, stanowiska dializ albo miejsca dzienne (inaczej 0). */
export type StructureOther = [addr: number, kind: OtherKind, name: string, units: number];

/** Nazwa rodzaju na liście „Inne miejsca” i w dymku; liczebnik jednostek (komórka rejestru = gabinet, punkt, zespół…). */
/** Rodzaje miejsc bez łóżek; `short` — podpis kwadratów w budynku; `search` — inne nazwy dla wyszukiwarki („nocna pomoc”, „lekarz rodzinny”). */
export const OTHER_KINDS: Record<OtherKind, { label: string; short: string; unit: [string, string, string]; capacity?: [string, string, string]; search?: string[] }> = {
  poz: { label: "Podstawowa opieka zdrowotna (POZ)", short: "POZ", unit: ["gabinet", "gabinety", "gabinetów"], search: ["lekarz rodzinny", "przychodnia"] },
  npl: { label: "Nocna i świąteczna opieka", short: "Nocna pomoc", unit: ["punkt", "punkty", "punktów"], search: ["nocna pomoc lekarska", "NPL"] },
  zrm: { label: "Zespoły ratownictwa medycznego", short: "Ratownictwo", unit: ["zespół", "zespoły", "zespołów"], search: ["karetka", "ratownictwo", "ZRM"] },
  dialysis: { label: "Stacja dializ", short: "Dializy", unit: ["stacja", "stacje", "stacji"], search: ["dializa", "hemodializa"], capacity: ["stanowisko", "stanowiska", "stanowisk"] },
  day: { label: "Leczenie jednego dnia", short: "Leczenie 1 dnia", unit: ["miejsce", "miejsca", "miejsc"], capacity: ["miejsce dzienne", "miejsca dzienne", "miejsc dziennych"] },
  delivery: { label: "Sala porodowa", short: "Sala porodowa", unit: ["sala", "sale", "sal"] },
  misc: { label: "Inne", short: "Inne", unit: ["miejsce", "miejsca", "miejsc"] },
};

/** Miejsce z łóżkami na karcie: adres, placówka, kategoria, kod, nazwa w rejestrze, łóżka, łóżka OIT, dziedziny. */
export type StructureBed = [addr: number, site: number, category: string, code: string, name: string, beds: number, icu: number, fields: number[]];
/** Poradnia: adres, kod, dziedziny. */
export type StructureClinic = [addr: number, code: string, fields: number[]];

/**
 * Sposób zapłaty z umów NFZ (kod oddziału albo poradni w roku): rodzaj i najwyżej 3 pozycje
 * [nazwa rodzaju umowy, w umowie sieci 0/1, kwota zł]. Rodzaje: plakietki z `CONTRACT_BADGES`.
 */
export type ContractPayKind = "lump" | "mixed" | "daily" | "separate" | "czp" | "advice" | "nokwota" | "none";
export type ContractPay = [kind: ContractPayKind, items: [type: string, psz: 0 | 1, amount: number][]];

/** Dane zakładki w danych karty (krotki, indeksy do słowników). */
export interface HospitalStructure {
  addresses: [street: string, city: string][];
  sites: string[];
  fields: string[];
  /** Kod → nazwa urzędowa (oddziały i poradnie). */
  names: Record<string, string>;
  beds: StructureBed[];
  clinics: StructureClinic[];
  other: StructureOther[];
  /** Budynek (indeks adresu) → placówki (indeksy `sites`). */
  buildingSites: Record<string, number[]>;
  /** Kod → sposób zapłaty w latach karty (`null` = brak umów w roku). */
  pay: Record<string, (ContractPay | null)[]>;
  /** Poradnie AOS z profilu RPWDL (dziedziny, lokalizacje). */
  outpatient: { cells: number; fields: number; locations: number } | null;
  /** Lokalizacje i miasta podmiotu (z profilu). */
  registry: { locations: number; cities: number } | null;
}

// ── Części szpitala i grupy ──────────────────────────────────────────────────────────────────────────────────────

export type StructurePart = "acute" | "psych" | "rehab" | "care";
export type StructureGroup = "internal" | "surgery" | "mother" | "onco" | "icu" | "support" | "psych" | "rehab" | "care";

/** Części w kolejności boksów i listy: nazwa i kolor próbki. */
export const STRUCTURE_PARTS: { key: StructurePart; label: string }[] = [
  { key: "acute", label: "Leczenie szpitalne" },
  { key: "psych", label: "Psychiatria" },
  { key: "rehab", label: "Rehabilitacja" },
  { key: "care", label: "Opieka długoterminowa i paliatywna" },
];

/** Grupy: pełny opis (dymek), krótka etykieta (legenda), kolor, część. Kolejność = kolejność skrzydeł w budynku. */
export const STRUCTURE_GROUPS: Record<StructureGroup, { label: string; short: string; color: string; part: StructurePart }> = {
  internal: { label: "Zachowawcze (interna, kardiologia, neurologia…)", short: "Zachowawcze", color: CHART_COLORS.dataStrong, part: "acute" },
  surgery: { label: "Zabiegowe (chirurgia, ortopedia, laryngologia…)", short: "Zabiegowe", color: CHART_COLORS.dataSoft, part: "acute" },
  mother: { label: "Pediatria, neonatologia, położnictwo", short: "Matka i dziecko", color: CHART_COLORS.data, part: "acute" },
  icu: { label: "Intensywna terapia i nadzór", short: "Intensywna terapia", color: CHART_COLORS.dataMuted, part: "acute" },
  onco: { label: "Onkologia i hematologia", short: "Onkologia, hematologia", color: CHART_COLORS.dataMid, part: "acute" },
  support: { label: "SOR, izba przyjęć, blok operacyjny (nie oddziały)", short: "SOR, izba, blok", color: "hatch", part: "acute" },
  psych: { label: "Psychiatria i leczenie uzależnień", short: "Psychiatria", color: CHART_COLORS.dataNeutralStrong, part: "psych" },
  rehab: { label: "Rehabilitacja i uzdrowisko", short: "Rehabilitacja", color: CHART_COLORS.dataNeutral, part: "rehab" },
  care: { label: "ZOL, hospicjum, opieka paliatywna", short: "ZOL, hospicjum", color: CHART_COLORS.dataNeutralFaint, part: "care" },
};
export const GROUP_ORDER = Object.keys(STRUCTURE_GROUPS) as StructureGroup[];

const SUPPORT_CATEGORIES = new Set(["emergency_department", "operating_block", "admission_room"]);
const CARE_CATEGORIES = new Set(["long_term_care", "hospice_palliative", "palliative"]);
const REHAB_CATEGORIES = new Set(["rehabilitation", "spa_sanatorium_or_rehabilitation", "spa_hospital_or_rehabilitation"]);

/** Grupa miejsca z łóżkami (kolejność warunków ma znaczenie: kategoria rejestru, potem kod). */
export function groupOf(code: string, category: string): StructureGroup {
  const n = Number(code);
  if (SUPPORT_CATEGORIES.has(category) || (n >= 4900 && n < 5000)) return "support";
  if (CARE_CATEGORIES.has(category) || n === 4180 || n === 5170 || n === 2184) return "care";
  if (REHAB_CATEGORIES.has(category) || (n >= 4300 && n < 4400) || n === 6500) return "rehab";
  if (category === "psychiatry_addiction" || (n >= 4700 && n < 4800)) return "psych";
  if ((n >= 4260 && n < 4270) || n === 4106 || n === 4107) return "icu";
  if ((n >= 4240 && n < 4250) || n === 4070) return "onco";
  if (n >= 4400 && n < 4470) return "mother";
  if (n >= 4500 && n < 4700) return "surgery";
  return "internal";
}

/** Oddział dla dzieci (tryb „Dzieci / dorośli”): kod 4000–4899 kończący się na 1 albo pediatria i neonatologia (4400–4429). */
export const isKidsWard = (code: string) => { const n = Number(code); return (n >= 4000 && n < 4900 && n % 10 === 1) || (n >= 4400 && n < 4430); };

/** Nazwy miejsc spoza oddziałów (SOR, izba, blok, ZOL, hospicjum): stała krótka nazwa zamiast nazwy kodu. */
const SPECIAL_NAMES: Record<string, string> = {
  emergency_department: "SOR", operating_block: "Blok operacyjny", admission_room: "Izba przyjęć", long_term_care: "ZOL", hospice_palliative: "Hospicjum",
};

/** Nazwa na liście: urzędowa nazwa kodu (bez nazw własnych z rejestru), a bez niej nazwa z rejestru. */
export function officialName(structure: Pick<HospitalStructure, "names">, row: StructureBed) {
  return SPECIAL_NAMES[row[2]] ?? structure.names[row[3]] ?? row[4];
}

/** Krótka nazwa na rzucie: bez „Oddział ” / „Pododdział ” na początku, z wielkiej litery. */
export function planName(structure: Pick<HospitalStructure, "names">, row: StructureBed) {
  const name = SPECIAL_NAMES[row[2]] ?? (structure.names[row[3]] ?? row[4]).replace(/^(Oddział|Pododdział|Zakład\/Oddział) /, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Leczenie szpitalne: łóżka części (z SOR, izbą i blokiem) i liczba oddziałów (kody bez SOR, izby i bloku).
 * Te same liczby w nagłówku karty (KPI) i w boksie zakładki „Struktura”.
 */
export function acuteSummary(structure: Pick<HospitalStructure, "beds">): { beds: number; wards: number } {
  const rows = structure.beds.filter((row) => STRUCTURE_GROUPS[groupOf(row[3], row[2])].part === "acute");
  return {
    beds: rows.reduce((sum, row) => sum + row[5], 0),
    wards: new Set(rows.filter((row) => groupOf(row[3], row[2]) !== "support").map((row) => row[3])).size,
  };
}

// ── Nazwy placówek (budynków) ────────────────────────────────────────────────────────────────────────────────────

/** Odmiana miasta: pierwsze 3 litery każdego słowa (Kłodzku/Kłodzko, Kudowie-Zdroju/Kudowa-Zdrój). */
const sameCity = (located: string, city: string) => {
  const a = located.split(/[\s-]+/), b = city.split(/[\s-]+/);
  return a.length === b.length && a.every((word, i) => word.slice(0, 3).toLowerCase() === b[i].slice(0, 3).toLowerCase());
};

/**
 * Nazwa budynku z nazw placówek (od największej liczby łóżek). Końcówkę „ w <miasto>” pomijamy, gdy miasto jest w adresie
 * pod nazwą („Szpital w Kłodzku” → „Szpital”); wspólny człon przed „ – ” piszemy raz („UCK – Szpital, ZOL”).
 */
export function placeName(names: string[], city: string): string {
  const list = [...new Set(names.filter(Boolean).map((name) => {
    const match = name.match(/^(.+) w (.+)$/);
    return match && sameCity(match[2], city) ? match[1] : name;
  }))];
  const split = list.map((name) => name.split(" – "));
  if (list.length > 1 && split.every((parts) => parts.length === 2 && parts[0] === split[0][0])) return `${split[0][0]} – ${split.map((parts) => parts[1]).join(", ")}`;
  return list.join(" · ");
}

/** Słownik skrótów nazw placówek (telefon, DESIGN.md 7.1b). */
export const PLACE_ABBREVIATIONS: [long: string, short: string][] = [
  ["Zakład Opiekuńczo-Leczniczy", "ZOL"], ["Zakład Pielęgnacyjno-Opiekuńczy", "ZPO"], ["Szpitalny Oddział Ratunkowy", "SOR"],
];

/** Krótka nazwa (telefon): bez nazwy szpitala z tytułu karty i ze skrótami ze słownika. */
export function shortPlaceName(name: string, hospitalName: string): string {
  const own = hospitalName.split(",")[0].trim().toLowerCase();
  let out = name.split(" · ").map((part) => part.toLowerCase().startsWith(`${own} – `) ? part.slice(own.length + 3) : part).join(" · ");
  for (const [long, short] of PLACE_ABBREVIATIONS) out = out.replaceAll(long, short);
  return out;
}

// ── Sposób zapłaty z umów NFZ ────────────────────────────────────────────────────────────────────────────────────

/** Plakietki pozycji umów (oddziały bez hospitalizacji JGP, SOR, ZOL…, poradnie). `tone` = klasa plakietki. */
export const CONTRACT_BADGES: Record<ContractPayKind, { label: string; tone: "lump" | "mixed" | "other" | "none" }> = {
  lump: { label: "ryczałt sieci", tone: "lump" },
  mixed: { label: "ryczałt + osobna kwota", tone: "mixed" },
  daily: { label: "stawka dobowa", tone: "other" },
  separate: { label: "osobna kwota", tone: "other" },
  czp: { label: "program pilotażowy CZP", tone: "other" },
  advice: { label: "za porady, do limitu", tone: "other" },
  nokwota: { label: "w umowie, bez kwoty", tone: "none" },
  none: { label: "brak w umowach NFZ", tone: "none" },
};

interface PlanItem { code: string; name: string; units: number; amount: number; psz: boolean; type: string }

/** Pozycje planu umów w roku (suma miesięcy na produkt i umowę); `psz` = umowa sieci szpitali (z produktem ryczałtu). */
export function contractItems(contracts: HospitalContractsFile, yearIndex: number): PlanItem[] {
  const psz = new Set<number>();
  contracts.plans.forEach(([agreement, product]) => { if (isLumpSumProduct(contracts.products[product][0])) psz.add(agreement); });
  const items = new Map<string, PlanItem>();
  contracts.plans.forEach(([agreement, product, units, price]) => {
    const [year, type, typeName] = contracts.agreements[agreement];
    if (year !== yearIndex || type === "00") return;
    const [code, name] = contracts.products[product];
    if (code.startsWith("00.")) return;
    const key = `${agreement}|${code}`;
    const item = items.get(key) ?? items.set(key, { code, name, units: 0, amount: 0, psz: psz.has(agreement), type: typeName }).get(key)!;
    item.units += units;
    item.amount += price;
  });
  return [...items.values()];
}

/**
 * Sposób zapłaty kodu z pozycji umów roku. Kod umowy = kod rejestru albo kod ze słownika `nfzCodes` (NFZ łączy rodzaje
 * miejsc w jeden zakres, np. ZOL 5170 → 5160); oddział bez własnego zakresu — zakres o tych samych 3 cyfrach.
 * Zakres w umowie sieci bez kwoty = ryczałt; z kwotą = osobna kwota; plan na 365 jednostek (dni) albo „dobowy” w nazwie =
 * stawka dobowa; umowa typu 18 z „CZP” = program pilotażowy.
 */
export function contractPay(code: string, items: PlanItem[], nfzCodes: HospitalStructureFile["nfzCodes"], clinic = false): ContractPay {
  const [target, variant] = nfzCodes[code] ?? [code, ""];
  let hits = items.filter((item) => item.code.slice(3, 7) === target && (!variant || item.code.slice(8, 11) === variant));
  if (!hits.length && !clinic && Number(target) >= 4000 && Number(target) < 4900) hits = items.filter((item) => item.code.slice(3, 6) === target.slice(0, 3));
  if (!hits.length) return ["none", []];
  const top = [...hits].sort((a, b) => b.amount - a.amount).slice(0, 3).map((item): [string, 0 | 1, number] => [item.type, item.psz ? 1 : 0, Math.round(item.amount)]);
  const paid = hits.filter((item) => item.amount > 0);
  const lump = hits.filter((item) => item.psz && !item.amount);
  if (paid.length && lump.length && !clinic) return ["mixed", top];
  if (!paid.length) return [clinic || !hits.every((item) => item.psz) ? "nokwota" : "lump", top];
  if (paid.some((item) => Math.round(item.units) === 365 || /DOBOW/i.test(item.name))) return ["daily", top];
  if (paid.some((item) => item.type.startsWith("Program") && /CZP/i.test(item.name))) return ["czp", top];
  return [clinic ? "advice" : "separate", top];
}

/** Dane zakładki z pliku buildu i umów (build karty). `null`, gdy szpital nie ma miejsc z łóżkami ani poradni. */
export function buildHospitalStructure(
  key: string, file: HospitalStructureFile | null, contracts: HospitalContractsFile | null, years: string[],
  profile: { outpatient?: { cell_count?: number; field_count?: number; location_count?: number } | null; registry?: { location_count?: number; city_count?: number } | null } | null,
): HospitalStructure | null {
  const raw = file?.hospitals[key];
  if (!file || !raw) return null;
  // Słowniki tylko z wartościami tego szpitala (mniej danych na stronie).
  const remap = (table: string[]) => { const used = new Map<number, number>(); return { used, at: (i: number) => used.get(i) ?? used.set(i, used.size).get(i)! , list: () => [...used.keys()].map((i) => table[i]) }; };
  const sites = remap(file.sites), fields = remap(file.fields);
  const beds = raw.beds.map(([a, s, category, code, name, n, icu, f]): StructureBed => [a, sites.at(s), category, code, name, n, icu, f.map(fields.at)]);
  const clinics = raw.clinics.map(([a, code, f]): StructureClinic => [a, code, f.map(fields.at)]);
  const buildingSites = Object.fromEntries(Object.entries(raw.sites ?? {}).map(([a, s]) => [a, s.map(sites.at)]));
  const codes = new Set([...beds.map((row) => row[3]), ...clinics.map((row) => row[1])]);
  const names = Object.fromEntries([...codes].filter((code) => file.names[code]).map((code) => [code, file.names[code]]));
  const clinicCodes = new Set(clinics.map((row) => row[1]));
  const pay: Record<string, (ContractPay | null)[]> = {};
  if (contracts) {
    const byYear = years.map((year) => { const y = contracts.years.indexOf(year); return y < 0 ? null : contractItems(contracts, y); });
    const operating = new Set(beds.filter((row) => row[2] === "operating_block").map((row) => row[3]));
    for (const code of codes) {
      if (operating.has(code)) continue;
      pay[code] = byYear.map((items) => items && items.length ? contractPay(code, items, file.nfzCodes, clinicCodes.has(code) && !beds.some((row) => row[3] === code)) : null);
    }
  }
  const out = profile?.outpatient, reg = profile?.registry;
  return {
    addresses: raw.addr, sites: sites.list(), fields: fields.list(), names, beds, clinics, other: raw.other ?? [], buildingSites, pay,
    outpatient: out?.cell_count ? { cells: out.cell_count, fields: out.field_count ?? 0, locations: out.location_count ?? 0 } : null,
    registry: reg?.location_count ? { locations: reg.location_count, cities: reg.city_count ?? 0 } : null,
  };
}

// ── Rzut: układ budynków i oddziałów ─────────────────────────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }

/** Squarify: prostokąty o polu proporcjonalnym do `value`, bliskie kwadratom. */
export function squarify<T extends { value: number }>(items: T[], x: number, y: number, w: number, h: number): (T & Rect)[] {
  const out: (T & Rect)[] = [];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total || w <= 0 || h <= 0) return items.map((item) => ({ ...item, x, y, w: 0, h: 0 }));
  const scale = (w * h) / total;
  let rest = items.map((item) => ({ item, area: item.value * scale }));
  while (rest.length) {
    const short = Math.min(w, h);
    const worst = (row: typeof rest) => {
      const sum = row.reduce((s, r) => s + r.area, 0), max = Math.max(...row.map((r) => r.area)), min = Math.min(...row.map((r) => r.area));
      return Math.max((short * short * max) / (sum * sum), (sum * sum) / (short * short * min));
    };
    let row = [rest[0]], i = 1;
    while (i < rest.length && worst([...row, rest[i]]) <= worst(row)) { row = [...row, rest[i]]; i++; }
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      const cw = sum / h; let cy = y;
      for (const r of row) { const ch = r.area / cw; out.push({ ...r.item, x, y: cy, w: cw, h: ch }); cy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = sum / w; let cx = x;
      for (const r of row) { const cw = r.area / rh; out.push({ ...r.item, x: cx, y, w: cw, h: rh }); cx += cw; }
      y += rh; h -= rh;
    }
    rest = rest.slice(i);
  }
  return out;
}

/** Squarify z docelową proporcją szerokość/wysokość: układ w przestrzeni ściśniętej poziomo, potem rozciągnięty. */
export const squarifyRatio = <T extends { value: number }>(items: T[], x: number, y: number, w: number, h: number, ratio: number) =>
  squarify(items, 0, 0, w / ratio, h).map((r) => ({ ...r, x: x + r.x * ratio, y: y + r.y, w: r.w * ratio }));

/** Stałe rzutu (px): pole łóżka przy szerokości ≥ 1000 px, odstępy, wysokości wierszy, proporcje skrzydeł i oddziałów. */
/**
 * Zestaw boksów (DESIGN.md 7.1a): jedna linia, dopóki każdy boks ma co najmniej `BOX_MIN` px; węższy — zwarta lista.
 * `width` — szerokość kontenera; 0 (przed pomiarem) = jedna linia.
 */
export const BOX_MIN = 150;
export const BOX_GAP = 10;
export const isCompactBoxSet = (width: number, count: number) => width > 0 && count > 1 && width < count * BOX_MIN + (count - 1) * BOX_GAP;

export const PLAN = { bedArea: 520, pad: 6, wingGap: 5, roomGap: 1.5, buildingGap: 12, minRow: 110, minLast: 64, roomRatio: 2.6, wingRatio: 1.6 } as const;

export interface PlanBuilding<B> { building: B; width: number; height: number }

/**
 * Wiersze budynków w jednej skali: pole łóżka jest takie samo w każdym budynku (maleje tylko z szerokością kontenera).
 * Budynki w wierszu mają tę samą wysokość, szerokość według łóżek; mały budynek dołącza do wiersza, dopóki wiersz nie ma
 * `minRow` — pełny wiersz zajmuje całą szerokość. Ten sam układ na telefonie (nazwy krótkie). Wymiary z ramką 1 px.
 */
export function layoutBuildings<B extends { beds: number }>(buildings: B[], width: number): PlanBuilding<B>[][] {
  const area = PLAN.bedArea * Math.min(1, width / 1000);
  const inner = (count: number) => width - 1 - PLAN.buildingGap * (count - 1) - (2 * PLAN.pad + 2) * count;
  const rowHeight = (row: B[]) => row.reduce((sum, b) => sum + b.beds, 0) * area / inner(row.length);
  const rows: B[][] = [];
  let current: B[] = [];
  for (const building of [...buildings].sort((a, b) => b.beds - a.beds)) {
    current.push(building);
    if (rowHeight(current) >= PLAN.minRow) { rows.push(current); current = []; }
  }
  if (current.length) rows.push(current);
  return rows.map((row) => {
    // Jedna skala w całym rzucie: szerokość budynku = łóżka × pole łóżka / wysokość wiersza. Pełny wiersz zajmuje całą
    // szerokość. Resztka (za niska na `minLast`) dostaje wysokość `minLast` i węższe budynki, więc może być krótsza niż kontener:
    // skala łóżek ma pierwszeństwo przed pełną szerokością.
    const h = Math.max(PLAN.minLast, rowHeight(row));
    return row.map((building) => ({ building, height: h + 2 * PLAN.pad, width: building.beds * area / h + 2 * PLAN.pad + 2 }));
  });
}

/** Odstęp maleje w wąskim prostokącie: oddział zawsze ma dodatnie pole (i dymek). */
export const inset = <T extends Rect>(rect: T, gap: number): T => {
  const d = Math.min(gap, rect.w / 3, rect.h / 3);
  return { ...rect, x: rect.x + d / 2, y: rect.y + d / 2, w: rect.w - d, h: rect.h - d };
};

/** Podpis oddziału: dwie linie, jedna linia albo brak (gdy pełna nazwa się nie mieści; nazw nie skracamy). */
export function roomLabel(rect: Rect, name: string, beds: number, measure: (text: string, bold: boolean) => number): "two" | "one" | null {
  if (rect.h >= 36 && rect.w >= Math.max(measure(name, true), measure(`${beds} łóżek`, false)) + 12) return "two";
  if (rect.h >= 19 && rect.w >= measure(name, true) + measure(` ${beds}`, false) + 12) return "one";
  return null;
}

/** Jasny kolor (luminancja > 150): podpis grafitem zamiast bieli. */
export const isLightColor = (hex: string) => {
  if (!hex.startsWith("#")) return true;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
};

// ── Wyszukiwarka ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Bez wielkości liter i polskich znaków; znak po znaku (ta sama długość — indeksy trafień wskazują oryginał). */
export const normalizeSearch = (text: string) => [...text].map((ch) => ch === "ł" || ch === "Ł" ? "l" : ch.normalize("NFD")[0]).join("").toLowerCase();

/** Słowa zapytania: od 2 znaków; dłuższe skrócone do rdzenia („diabetologiczna” → „diabetologi”, trafia „Diabetologia”). */
export const searchWords = (query: string) => normalizeSearch(query).split(/\s+/).filter((word) => word.length > 1)
  .map((word) => word.length >= 7 ? word.slice(0, Math.max(6, word.length - 4)) : word);

/** Wszystkie słowa w jednym tekście (nazwa albo jedna dziedzina): „kardiologia dzieci” trafia „Kardiologia dziecięca”. */
export const matchesSearch = (texts: string[], words: string[]) => !words.length || texts.some((text) => { const n = normalizeSearch(text); return words.every((word) => n.includes(word)); });

/** Fragmenty tekstu: [tekst, trafienie] do podświetlenia. */
export function highlightParts(text: string, words: string[]): [string, boolean][] {
  if (!words.length) return [[text, false]];
  const n = normalizeSearch(text);
  const marks = new Array<boolean>(text.length).fill(false);
  for (const word of words) for (let i = n.indexOf(word); i >= 0; i = n.indexOf(word, i + 1)) for (let j = i; j < i + word.length; j++) marks[j] = true;
  const out: [string, boolean][] = [];
  [...text].forEach((ch, i) => { if (out.length && out.at(-1)![1] === marks[i]) out.at(-1)![0] += ch; else out.push([ch, marks[i]]); });
  return out;
}

// ── Listy ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WardEntry { part: StructurePart; code: string; category: string; name: string; beds: number; support: boolean; fields: string[]; addresses: [string, number][] }

/** Wiersze listy oddziałów: na kod (SOR, izba, blok — na rodzaj), w częściach, od największego; miejsca spoza oddziałów na końcu części. */
export function wardEntries(structure: HospitalStructure): WardEntry[] {
  const out: WardEntry[] = [];
  for (const { key: part } of STRUCTURE_PARTS) {
    const byKey = new Map<string, WardEntry & { fieldSet: Set<string> }>();
    for (const row of structure.beds) {
      const group = groupOf(row[3], row[2]);
      if (STRUCTURE_GROUPS[group].part !== part) continue;
      const support = group === "support";
      const id = support ? row[2] || row[3] : row[3];
      let entry = byKey.get(id);
      if (!entry) byKey.set(id, entry = { part, code: row[3], category: row[2], name: officialName(structure, row), beds: 0, support, fields: [], fieldSet: new Set(), addresses: [] });
      entry.beds += row[5];
      row[7].forEach((f) => entry.fieldSet.add(structure.fields[f]));
      const address = structure.addresses[row[0]].join(", ");
      const known = entry.addresses.find(([a]) => a === address);
      if (known) known[1] += row[5]; else entry.addresses.push([address, row[5]]);
    }
    out.push(...[...byKey.values()].map(({ fieldSet, ...entry }) => ({ ...entry, fields: [...fieldSet].sort((a, b) => a.localeCompare(b, "pl")) }))
      .sort((a, b) => Number(a.support) - Number(b.support) || b.beds - a.beds));
  }
  return out;
}

export interface ClinicEntry { code: string; name: string; count: number; fields: string[]; addresses: [string, number][] }

/** Wiersze listy poradni: na kod, nazwa urzędowa kodu, liczba poradni, suma dziedzin i adresy; alfabetycznie. */
export function clinicEntries(structure: HospitalStructure): ClinicEntry[] {
  const byCode = new Map<string, ClinicEntry & { fieldSet: Set<string> }>();
  for (const [a, code, f] of structure.clinics) {
    let entry = byCode.get(code);
    if (!entry) byCode.set(code, entry = { code, name: structure.names[code] ?? `Poradnia (kod ${code})`, count: 0, fields: [], fieldSet: new Set(), addresses: [] });
    entry.count += 1;
    f.forEach((i) => entry.fieldSet.add(structure.fields[i]));
    const address = structure.addresses[a].join(", ");
    const known = entry.addresses.find(([x]) => x === address);
    if (known) known[1] += 1; else entry.addresses.push([address, 1]);
  }
  return [...byCode.values()].map(({ fieldSet, ...entry }) => ({ ...entry, fields: [...fieldSet].sort((a, b) => a.localeCompare(b, "pl")) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export interface OtherEntry { kind: OtherKind; name: string; count: number; units: number; addresses: [string, number][] }

/** Lista „Inne miejsca”: na rodzaj (rodzaj „misc” — na nazwę), liczba miejsc, suma stanowisk lub miejsc dziennych, adresy. */
export function otherEntries(structure: Pick<HospitalStructure, "other" | "addresses">): OtherEntry[] {
  const byKey = new Map<string, OtherEntry>();
  for (const [a, kind, name, units] of structure.other) {
    const key = kind === "misc" ? `misc|${name}` : kind;
    let entry = byKey.get(key);
    if (!entry) byKey.set(key, entry = { kind, name: kind === "misc" ? name : OTHER_KINDS[kind].label, count: 0, units: 0, addresses: [] });
    entry.count += 1;
    entry.units += units;
    const address = structure.addresses[a].join(", ");
    const known = entry.addresses.find(([x]) => x === address);
    if (known) known[1] += 1; else entry.addresses.push([address, 1]);
  }
  const order = Object.keys(OTHER_KINDS);
  return [...byKey.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name, "pl"));
}

/** Dziedziny do pokazania: trafienia wyszukiwarki na początku, najwyżej `limit`, reszta jako liczba. */
export function fieldsShown(fields: string[], words: string[], limit = 6): { shown: string[]; rest: string[] } {
  const hit = (field: string) => words.length > 0 && matchesSearch([field], words);
  const ordered = [...fields.filter(hit), ...fields.filter((field) => !hit(field))];
  return { shown: ordered.slice(0, limit), rest: ordered.slice(limit) };
}
