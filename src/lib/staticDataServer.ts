import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { JgpGroupFile, JgpPeerPair, JgpValuation } from "@/lib/jgpPage";
import type { HospitalizationIndex, StaticDataset, TrendsDataset } from "@/lib/staticData";

// Odczyt danych podczas budowania strony (statyczny eksport). Tylko dla komponentów serwerowych.
const DATA_DIR = join(process.cwd(), "public", "data");
const DEFAULT_DIR = join(DATA_DIR, "hospitalizations");

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

async function readGzipJson<T>(file: string): Promise<T> {
  return JSON.parse(gunzipSync(await readFile(file)).toString("utf8")) as T;
}

/** Plik strony grupy (`scripts/build_jgp_pages.py`) albo `null`, gdy go jeszcze nie zbudowano. */
export async function readJgpGroupFileFromDisk(jgpCode: string, dir = join(DATA_DIR, "jgp")): Promise<JgpGroupFile | null> {
  const file = join(dir, `${jgpCode}.json.gz`);
  try {
    await access(file);
  } catch {
    return null;
  }
  return readGzipJson<JgpGroupFile>(file);
}

/** Katalog wycen JGP (punkty) z rokiem katalogu. */
export async function readValuationsFromDisk(file = join(DATA_DIR, "wyceny_jgp_2025.json.gz")): Promise<{ year: string; rows: JgpValuation[] }> {
  const data = await readGzipJson<{ rok: number | string; jgp: JgpValuation[] }>(file);
  return { year: String(data.rok), rows: data.jgp };
}

/** Pary szpitali z modelu podobieństwa (tylko pola potrzebne stronie grupy). */
export async function readPeerPairsFromDisk(file = join(DATA_DIR, "peer_pairs_ab.json.gz")): Promise<JgpPeerPair[]> {
  const data = await readGzipJson<{ rows: JgpPeerPair[] }>(file);
  return data.rows.map(({ a, b, peer_grade_pred, distance_score }) => ({ a, b, peer_grade_pred, distance_score }));
}
