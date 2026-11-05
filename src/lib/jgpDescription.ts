import type { JgpFamilyDefinition } from "@/lib/jgpGroupInfo";

/**
 * Plik `build-data/jgp_profiles.json.gz` ze `scripts/build_jgp_profiles.py` (API statystyk JGP NFZ, czyta tylko build).
 * Grupa: [rok, pacjenci, hospitalizacje, mediana dni, [[ICD-10, %]...], [[ICD-9 z listy kierunkowej, %]...], lista kierunkowa ICD-10].
 * Ostatnie pole = 1, gdy API podaje dla grupy tylko rozpoznania z listy kierunkowej (kwalifikujące do grupy), a nie wszystkie rozpoznania główne.
 */
export interface JgpProfilesFile {
  version: 1;
  source: string;
  icd10: Record<string, string>;
  icd9: Record<string, string>;
  groups: Record<string, [string, number | null, number | null, number | null, [string, number][], [string, number][], (0 | 1)?]>;
}

/** Opis grupy na karcie: zdania z danych i wiersz źródła. */
export interface JgpDescription {
  sentences: string[];
  source: string;
}

/** Kod pokazujemy w opisie od tego udziału w pobytach grupy (%). */
export const DESCRIPTION_MIN_PCT = 5;
/** Najwyżej tyle kodów w jednym zdaniu. */
const MAX_CODES = 3;

const percent = (value: number) => `${value >= 10 ? Math.round(value) : value.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

/** Nazwa ze słownika NFZ w środku zdania: mała pierwsza litera, chyba że to skrót (np. „OZW”, „HIV”). */
export function inSentence(name: string): string {
  const trimmed = name.trim().replace(/\.$/, "");
  if (trimmed.length > 1 && trimmed[1] === trimmed[1].toLocaleUpperCase("pl-PL") && /\p{L}/u.test(trimmed[1])) return trimmed;
  return trimmed.charAt(0).toLocaleLowerCase("pl-PL") + trimmed.slice(1);
}

/** „a, b i c” */
function list(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} i ${items.at(-1)}`;
}

/** Polska odmiana po liczebniku: 1 hospitalizacja, 2–4 hospitalizacje (bez 12–14), 5+ hospitalizacji. */
export function plural(value: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.round(value));
  if (n === 1) return one;
  return n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
}

function days(value: number): string {
  if (value === 1) return "1 dzień";
  return `${integer(value)} dni`;
}

/**
 * Opis grupy z danych NFZ (etap 4c): każde zdanie ma pokrycie w źródle — tabele API statystyk JGP
 * (rozpoznania, procedury z listy kierunkowej, dane ogólne) i lista rodzin portalu. Bez wiedzy spoza tych źródeł.
 * `null`, gdy API nie ma danych grupy.
 */
export function buildJgpDescription(jgpCode: string, profiles: JgpProfilesFile | null | undefined, family?: JgpFamilyDefinition | null): JgpDescription | null {
  const profile = profiles?.groups[jgpCode];
  if (!profile) return null;
  const [year, patients, hospitalizations, median, diseases, procedures, directional] = profile;
  const sentences: string[] = [];
  // Tabele API, z których powstały zdania (wiersz źródła wymienia tylko je).
  const used: string[] = [];
  const named = (rows: [string, number][], names: Record<string, string>) => rows.map(([code, share]) => `${inSentence(names[code] ?? code)} (${code}, ${percent(share)})`);

  const mainDiseases = diseases.filter(([, share]) => share >= DESCRIPTION_MIN_PCT).slice(0, MAX_CODES);
  if (diseases.length) used.push(directional ? "rozpoznania ICD-10 z listy kierunkowej" : "rozpoznania ICD-10");
  if (mainDiseases.length) {
    sentences.push(`${directional ? "Rozpoznania z listy kierunkowej grupy" : "Najczęstsze rozpoznania główne"}: ${list(named(mainDiseases, profiles.icd10))}.`);
  } else if (diseases.length) {
    sentences.push(`Rozpoznania są rozproszone: żadne nie przekracza ${DESCRIPTION_MIN_PCT}% pobytów; najczęstsze to ${named(diseases.slice(0, 1), profiles.icd10)[0]}.`);
  }

  const mainProcedures = procedures.filter(([, share]) => share >= DESCRIPTION_MIN_PCT).slice(0, MAX_CODES);
  if (mainProcedures.length) {
    // Pobyt może mieć kilka procedur z listy, więc udziały mogą sumować się powyżej 100%.
    const shares = mainProcedures.map(([code, share]) => `${inSentence(profiles.icd9[code] ?? code)} (${code}) w ${percent(share)} pobytów`);
    sentences.push(`Procedury z listy kierunkowej grupy: ${list(shares)}.`);
    used.push("procedury ICD-9 z listy kierunkowej");
  }

  const counts = hospitalizations
    ? `${integer(hospitalizations)} ${plural(hospitalizations, "hospitalizacja", "hospitalizacje", "hospitalizacji")}${patients ? ` u ${integer(patients)} ${patients === 1 ? "pacjenta" : "pacjentów"}` : ""} w ${year} r.`
    : "";
  if (counts || (median !== null && median !== undefined)) used.push("dane ogólne");
  if (median !== null && median !== undefined) {
    sentences.push(`Mediana pobytu: ${days(median)}${median === 0 ? " (wypis w dniu przyjęcia)" : ""}${counts ? `; ${counts}` : "."}`);
  } else if (counts) {
    sentences.push(`${counts.charAt(0).toLocaleUpperCase("pl-PL")}${counts.slice(1)}`);
  }

  if (family) {
    const others = family.codes.filter((code) => code !== jgpCode);
    if (others.length) sentences.push(`Należy do rodziny „${family.name}”; pozostałe warianty: ${list(others)}.`);
  }
  if (!sentences.length) return null;
  return {
    sentences,
    source: `Źródło: NFZ, statystyki JGP ${year} (${used.join(", ")})${family ? "; rodzina: lista portalu" : ""}.`,
  };
}
