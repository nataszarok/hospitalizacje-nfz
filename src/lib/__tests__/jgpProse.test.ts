import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readJgpProse } from "@/lib/jgpProse";
import type { JgpProfilesFile } from "@/lib/jgpDescription";

// Opisy grup (scripts/jgp_opisy/*.tsv) muszą mieć pokrycie w danych NFZ grupy (build-data/jgp_profiles.json.gz):
// każdy kod ICD, procent i liczba dni z tekstu musi wystąpić w tabelach tej grupy.
const ROOT = join(__dirname, "..", "..", "..");
const profiles = JSON.parse(gunzipSync(readFileSync(join(ROOT, "build-data", "jgp_profiles.json.gz"))).toString("utf8")) as JgpProfilesFile;
const jgpCodes = new Set<string>(JSON.parse(readFileSync(join(ROOT, "build-data", "jgp", "index.json"), "utf8")).groups);
const dir = join(ROOT, "scripts", "jgp_opisy");
const prose = readJgpProse(readdirSync(dir).filter((name) => name.endsWith(".tsv")).map((name) => readFileSync(join(dir, name), "utf8")));

/** Niezgodności opisu z danymi grupy (pusta lista = opis zgodny). */
function mismatches(code: string, text: string): string[] {
  const profile = profiles.groups[code];
  if (!profile) return ["grupa bez danych API"];
  const [, , , median, diseases, procedures] = profile;
  const problems: string[] = [];
  const icd10 = diseases.map(([c]) => c);
  // Kody ICD-10 (np. I21.4) i kategorie (np. I21) z tabel grupy; kody JGP (np. E11) też mają taki kształt.
  for (const [match] of text.matchAll(/\b[A-Z]\d{2}[A-Z]?(?:\.\d{1,2})?\b/g)) {
    if (jgpCodes.has(match)) continue;
    if (!icd10.some((c) => c === match || c.startsWith(`${match}.`) || c === match.replace(/\.\d+$/, ""))) problems.push(`kod ${match} spoza rozpoznań grupy`);
  }
  for (const [match] of text.matchAll(/\b\d{2}\.\d{1,4}\b/g)) {
    if (!procedures.some(([c]) => c === match)) problems.push(`procedura ${match} spoza listy grupy`);
  }
  const shares = [...diseases, ...procedures].map(([, share]) => share);
  for (const [, value] of text.matchAll(/(\d+(?:,\d)?)\s?%/g)) {
    const number = Number(value.replace(",", "."));
    if (!shares.some((share) => Math.abs(share - number) <= 1)) problems.push(`${value}% nie ma w tabelach grupy`);
  }
  // Mediana pobytu: „N dni (mediana)” albo „mediana N dni”; inne liczby dni to progi z nazwy grupy (np. „> 3 dni”).
  for (const [, a, b] of text.matchAll(/\b(\d+) (?:dni|dzień) \(mediana\)|mediana (\d+) dni/g)) {
    const value = a ?? b;
    if (Number(value) !== median) problems.push(`${value} dni ≠ mediana ${median}`);
  }
  return problems;
}

describe("opisy grup JGP (proza) a dane NFZ", () => {
  it("plik opisów ma tylko znane kody grup i niepuste teksty", () => {
    for (const [code, text] of Object.entries(prose)) {
      expect(jgpCodes.has(code), code).toBe(true);
      expect(text.length, code).toBeGreaterThan(40);
    }
  });

  it("każdy kod ICD, procent i liczba dni w opisie zgadza się z danymi grupy", () => {
    const wrong = Object.entries(prose).flatMap(([code, text]) => mismatches(code, text).map((problem) => `${code}: ${problem}`));
    expect(wrong).toEqual([]);
  });

  it("test wykrywa niezgodność", () => {
    expect(mismatches("E10", "Zawał serca (I21.4), koronarografia (88.56) w 91% pobytów, pobyt ponad 3 dni, zwykle 4 dni (mediana).")).toEqual([]);
    expect(mismatches("E10", "Udar mózgu (I63.3) w 40% pobytów, zwykle 9 dni (mediana), angioplastyka (36.06).")).toEqual([
      "kod I63.3 spoza rozpoznań grupy", "procedura 36.06 spoza listy grupy", "40% nie ma w tabelach grupy", "9 dni ≠ mediana 4",
    ]);
  });

  it("każda grupa z danymi NFZ ma opis", () => {
    expect(Object.keys(profiles.groups).filter((code) => !prose[code])).toEqual([]);
  });
});
