import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { readAllStaticDatasetsFromDisk, readHospitalizationIndexFromDisk, readStaticDatasetFromDisk } from "@/lib/staticDataServer";

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
