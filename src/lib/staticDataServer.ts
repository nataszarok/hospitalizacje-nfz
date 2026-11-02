import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { RegionsMap } from "@/lib/jgpCard";
import type { JgpGroupFile, JgpPagesIndex, JgpPeerPair } from "@/lib/jgpPage";
import { decodeValuations, type JgpValuation, type ValuationsFile } from "@/lib/valuations";
import type { HospitalizationIndex, StaticDataset, TrendsDataset } from "@/lib/staticData";

// Odczyt danych podczas budowania strony (statyczny eksport). Tylko dla komponentów serwerowych.
const DATA_DIR = join(process.cwd(), "public", "data");
const DEFAULT_DIR = join(DATA_DIR, "hospitalizations");

export async function readHospitalizationIndexFromDisk(dir = DEFAULT_DIR): Promise<HospitalizationIndex> {
  return JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as HospitalizationIndex;
}

export async function readStaticDatasetFromDisk(year: string, dir = DEFAULT_DIR): Promise<StaticDataset> {
  return readGzipJson<StaticDataset>(join(dir, `${year}.json.gz`));
}

/** Zbiory za wszystkie lata z `index.json`, od najstarszego. */
export async function readAllStaticDatasetsFromDisk(dir = DEFAULT_DIR): Promise<StaticDataset[]> {
  const { years } = await readHospitalizationIndexFromDisk(dir);
  return Promise.all(years.map((year) => readStaticDatasetFromDisk(year, dir)));
}

export async function readTrendsFromDisk(dir = DEFAULT_DIR): Promise<TrendsDataset> {
  return readGzipJson<TrendsDataset>(join(dir, "trends.json.gz"));
}

// Podczas budowania ~700 stron grup czyta te same duże pliki; każdy plik parsujemy raz na proces.
const gzipCache = new Map<string, Promise<unknown>>();
async function readGzipJson<T>(file: string): Promise<T> {
  let promise = gzipCache.get(file);
  if (!promise) {
    promise = readFile(file).then((buffer) => JSON.parse(gunzipSync(buffer).toString("utf8")) as unknown);
    gzipCache.set(file, promise);
    promise.catch(() => gzipCache.delete(file));
  }
  return promise as Promise<T>;
}

/** Tylko dla testów: czyści pamięć podręczną odczytów. */
export function clearDiskCache() {
  gzipCache.clear();
  peerPairsCache.clear();
}

/** Grupy JGP ze stroną (`scripts/build_jgp_pages.py`). */
export async function readJgpPagesIndexFromDisk(file = join(DATA_DIR, "jgp", "index.json")): Promise<JgpPagesIndex> {
  return JSON.parse(await readFile(file, "utf8")) as JgpPagesIndex;
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
  const data = await readGzipJson<ValuationsFile>(file);
  return { year: data.year, rows: decodeValuations(data) };
}

/** Pary szpitali z modelu podobieństwa (tylko pola potrzebne stronie grupy). */
const peerPairsCache = new Map<string, Promise<JgpPeerPair[]>>();
export async function readPeerPairsFromDisk(file = join(DATA_DIR, "peer_pairs_ab.json.gz")): Promise<JgpPeerPair[]> {
  let promise = peerPairsCache.get(file);
  if (!promise) {
    promise = readGzipJson<{ rows: JgpPeerPair[] }>(file)
      .then((data) => data.rows.map(({ a, b, peer_grade_pred, distance_score }) => ({ a, b, peer_grade_pred, distance_score })));
    peerPairsCache.set(file, promise);
  }
  return promise;
}

/** Mapa województw (`scripts/build_regions_map.py`) albo `null`, gdy pliku nie ma. */
export async function readRegionsMapFromDisk(file = join(DATA_DIR, "regions-map.json.gz")): Promise<RegionsMap | null> {
  try {
    await access(file);
  } catch {
    return null;
  }
  return readGzipJson<RegionsMap>(file);
}
