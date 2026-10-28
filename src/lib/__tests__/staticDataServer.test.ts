import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { readStaticDatasetFromDisk } from "@/lib/staticDataServer";

let dir = "";
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

describe("readStaticDatasetFromDisk", () => {
  it("czyta i rozpakowuje zbiór gzip z dysku", async () => {
    dir = await mkdtemp(join(tmpdir(), "atlas-"));
    const file = join(dir, "dashboard.json.gz");
    const payload = { version: 1, analysisYear: "2025", defaultProductCode: "P1", products: [], regions: [], facilities: [], populations: [], facts: [] };
    await writeFile(file, gzipSync(JSON.stringify(payload)));
    await expect(readStaticDatasetFromDisk(file)).resolves.toEqual(payload);
  });

  it("zgłasza błąd, gdy pliku nie ma", async () => {
    await expect(readStaticDatasetFromDisk("/nie/ma/takiego/pliku.json.gz")).rejects.toThrow();
  });
});
