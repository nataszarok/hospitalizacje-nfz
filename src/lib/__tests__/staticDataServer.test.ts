import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { readAllStaticDatasetsFromDisk, readHospitalizationIndexFromDisk, readJgpSettlementsFromDisk, readStaticDatasetFromDisk } from "@/lib/staticDataServer";

let dir = "";
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

function payload(year: string) {
  return { version: 1, analysisYear: year, defaultProductCode: "P1", products: [], regions: [], facilities: [], populations: [], facts: [] };
}

async function writeYears(years: string[]) {
  dir = await mkdtemp(join(tmpdir(), "atlas-"));
  await writeFile(join(dir, "index.json"), JSON.stringify({ version: 1, years, latestYear: years[years.length - 1], defaultProductCode: "P1" }));
  for (const year of years) await writeFile(join(dir, `${year}.json.gz`), gzipSync(JSON.stringify(payload(year))));
}

describe("readStaticDatasetFromDisk", () => {
  it("czyta i rozpakowuje zbiór gzip za wybrany rok", async () => {
    await writeYears(["2025"]);
    await expect(readStaticDatasetFromDisk("2025", dir)).resolves.toEqual(payload("2025"));
  });

  it("zgłasza błąd, gdy pliku nie ma", async () => {
    await expect(readStaticDatasetFromDisk("1999", "/nie/ma/takiego/katalogu")).rejects.toThrow();
  });
});

describe("readHospitalizationIndexFromDisk", () => {
  it("czyta listę lat", async () => {
    await writeYears(["2024", "2025"]);
    await expect(readHospitalizationIndexFromDisk(dir)).resolves.toMatchObject({ years: ["2024", "2025"], latestYear: "2025" });
  });
});

describe("readAllStaticDatasetsFromDisk", () => {
  it("czyta zbiory za wszystkie lata w kolejności z index.json", async () => {
    await writeYears(["2024", "2025"]);
    const datasets = await readAllStaticDatasetsFromDisk(dir);
    expect(datasets.map((d) => d.analysisYear)).toEqual(["2024", "2025"]);
  });
});

describe("readJgpSettlementsFromDisk", () => {
  it("zbiera kwoty NFZ kraju z plików grup; grupy bez kwot pomija", async () => {
    dir = await mkdtemp(join(tmpdir(), "atlas-jgp-"));
    await writeFile(join(dir, "index.json"), JSON.stringify({ version: 2, years: ["2025"], groups: ["A01", "B02"] }));
    const group = (jgp: string, valuePln?: object) => gzipSync(JSON.stringify({ version: 3, jgp, years: ["2025"], providers: [], rows: [], ...(valuePln ? { valuePln } : {}) }));
    await writeFile(join(dir, "A01.json.gz"), group("A01", { national: { "2025": 1200 }, year: "2025", providers: [] }));
    await writeFile(join(dir, "B02.json.gz"), group("B02"));
    await expect(readJgpSettlementsFromDisk(dir)).resolves.toEqual({ A01: { "2025": 1200 } });
  });

  it("zwraca null, gdy plików grup nie zbudowano", async () => {
    await expect(readJgpSettlementsFromDisk("/nie/ma/takiego/katalogu")).resolves.toBeNull();
  });
});
