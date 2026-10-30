import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { HospitalizationIndex, StaticDataset, TrendsDataset } from "@/lib/staticData";

// Odczyt danych podczas budowania strony (statyczny eksport). Tylko dla komponentów serwerowych.
const DEFAULT_DIR = join(process.cwd(), "public", "data", "hospitalizations");

export async function readHospitalizationIndexFromDisk(dir = DEFAULT_DIR): Promise<HospitalizationIndex> {
  return JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as HospitalizationIndex;
}

export async function readStaticDatasetFromDisk(year: string, dir = DEFAULT_DIR): Promise<StaticDataset> {
  return JSON.parse(gunzipSync(await readFile(join(dir, `${year}.json.gz`))).toString("utf8")) as StaticDataset;
}

/** Zbiory za wszystkie lata z `index.json`, od najstarszego. */
export async function readAllStaticDatasetsFromDisk(dir = DEFAULT_DIR): Promise<StaticDataset[]> {
  const { years } = await readHospitalizationIndexFromDisk(dir);
  return Promise.all(years.map((year) => readStaticDatasetFromDisk(year, dir)));
}

export async function readTrendsFromDisk(dir = DEFAULT_DIR): Promise<TrendsDataset> {
  return JSON.parse(gunzipSync(await readFile(join(dir, "trends.json.gz"))).toString("utf8")) as TrendsDataset;
}
