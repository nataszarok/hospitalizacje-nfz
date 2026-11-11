import { buildJgpPageData, type JgpPageData } from "@/lib/jgpPage";
import {
  readHospitalizationIndexFromDisk, readJgpGroupFileFromDisk, readJgpProfilesFromDisk, readJgpProseFromDisk, readPeerPairsFromDisk, readStaticDatasetFromDisk, readTrendsFromDisk, readValuationsFromDisk,
} from "@/lib/staticDataServer";

// Dane karty grupy podczas budowania: strona, jej metadane i obraz podglądu (`/og/jgp/<KOD>.png`) czytają je raz na proces.
const cache = new Map<string, Promise<JgpPageData | null>>();

export function readJgpPageDataFromDisk(kod: string): Promise<JgpPageData | null> {
  let promise = cache.get(kod);
  if (!promise) {
    promise = buildFromDisk(kod);
    cache.set(kod, promise);
    promise.catch(() => cache.delete(kod));
  }
  return promise;
}

async function buildFromDisk(kod: string) {
  const [trends, index, groupFile, valuations, peerPairs, profiles, prose] = await Promise.all([
    readTrendsFromDisk(), readHospitalizationIndexFromDisk(), readJgpGroupFileFromDisk(kod), readValuationsFromDisk(), readPeerPairsFromDisk(), readJgpProfilesFromDisk(), readJgpProseFromDisk(),
  ]);
  // Karta ma wybór roku: ośrodki ze wszystkich lat i ich nazwy ze starszych plików roku.
  const older = await Promise.all(index.years.filter((year) => year !== index.latestYear).map((year) => readStaticDatasetFromDisk(year)));
  return buildJgpPageData(trends, await readStaticDatasetFromDisk(index.latestYear), kod, "min", 15, {
    groupFile, valuations: valuations.rows, valuationYear: valuations.year, peerPairs, profiles, prose,
    allYearProviders: true, facilities: older.flatMap((dataset) => dataset.facilities),
  });
}
