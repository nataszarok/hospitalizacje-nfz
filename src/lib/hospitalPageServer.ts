import { LUMP_BASE_YEAR, lumpSumByYear, lumpSumIndex, lumpSumReference, type LumpIndex } from "@/lib/hospitalFinance";
import { buildHospitalCards, buildHospitalPageData, type HospitalCards, type HospitalPageData } from "@/lib/hospitalPage";
import { HOSPITAL_PAGE_KEYS, hospitalPageKey } from "@/lib/hospitalPages";
import { hospitalPreviewCard, hospitalPreviewInput } from "@/lib/hospitalPreview";
import type { PreviewCard } from "@/lib/socialPreview";
import {
  readAllStaticDatasetsFromDisk, readFacilityYearsFromDisk, readFinancialResultsFromDisk, readAllHospitalContractsFromDisk, readHospitalContractsFromDisk, readHospitalPaymentFromDisk, readHospitalProfileRecordFromDisk, readRpwdlSnapshotDateFromDisk, readJgpGroupFileFromDisk, readWardNamesFromDisk,
  readJgpPagesIndexFromDisk, readPszLevelsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk,
} from "@/lib/staticDataServer";

// Dane karty szpitala podczas budowania: strona, jej metadane i obraz podglądu (`/og/szpital/<NIP>-<OW>.png`).

// Części wszystkich kart liczone raz na proces buildu (jedno przejście po plikach grup i plikach lat).
let cardsPromise: Promise<HospitalCards> | null = null;
function allCards() {
  cardsPromise ??= (async () => {
    const [trends, { groups }, datasets, psz] = await Promise.all([readTrendsFromDisk(), readJgpPagesIndexFromDisk(), readAllStaticDatasetsFromDisk(), readPszLevelsFromDisk()]);
    const groupFiles = (await Promise.all(groups.map((code) => readJgpGroupFileFromDisk(code)))).filter((file) => file !== null);
    return buildHospitalCards(HOSPITAL_PAGE_KEYS, trends, groupFiles, datasets, new Set(psz.byNip.keys()));
  })();
  return cardsPromise;
}

// Ryczałt PSZ jako indeks (2018 = 100) dla wszystkich szpitali sieci i średnie poziomów sieci: raz na proces buildu.
let lumpPromise: Promise<{
  values: Map<string, number[]>; index: Map<string, (number | null)[]>; level: Map<string, string>; reference: ReturnType<typeof lumpSumReference>;
}> | null = null;
function lumpIndexes() {
  lumpPromise ??= (async () => {
    const [all, psz, trends] = await Promise.all([readAllHospitalContractsFromDisk(), readPszLevelsFromDisk(), readTrendsFromDisk()]);
    const values = new Map<string, number[]>();
    const index = new Map<string, (number | null)[]>();
    const baseIndex = trends.years.indexOf(LUMP_BASE_YEAR);
    const level = new Map<string, string>();
    for (const [key, contracts] of Object.entries(all)) {
      const name = psz.levels[psz.byNip.get(key.split("|")[1]) ?? -1];
      const amounts = lumpSumByYear(contracts, trends.years);
      const own = name ? lumpSumIndex(amounts, baseIndex) : null;
      if (!name || !own) continue;
      values.set(key, amounts);
      index.set(key, own);
      level.set(key, name);
    }
    const reference = lumpSumReference([...index].map(([key, own]) => ({ level: level.get(key)!, index: own })), trends.years.length);
    return { values, index, level, reference };
  })();
  return lumpPromise;
}

/** Indeks ryczałtu szpitala wobec średnich sieci; `null` poza siecią albo bez ryczałtu w roku bazowym. */
async function hospitalLumpIndex(key: string): Promise<LumpIndex | null> {
  const { values, index, level, reference } = await lumpIndexes();
  const own = index.get(key);
  const name = level.get(key);
  const group = name ? reference.levels.get(name) : undefined;
  if (!own || !name || !group) return null;
  return { baseYear: LUMP_BASE_YEAR, ownValues: values.get(key)!, own, level: name, levelMean: group.mean, levelCount: group.count, allMean: reference.all.mean, allCount: reference.all.count };
}

/**
 * Dane karty szpitala z fragmentu adresu „<NIP>-<OW>” albo `null`, gdy szpital nie ma karty.
 * Bez pamięci podręcznej: pełne dane (grupy JGP, finanse) ok. 600 kart nie mieszczą się w pamięci workera buildu.
 */
export function readHospitalPageDataFromDisk(id: string): Promise<HospitalPageData | null> {
  return buildFromDisk(id);
}

// Obraz podglądu potrzebuje tylko nazwy, miejsca i hospitalizacji w latach: z plików placówek, bez części kart i umów.
const previews = new Map<string, Promise<PreviewCard | null>>();

/** Treść obrazu podglądu karty szpitala (`/og/szpital/<NIP>-<OW>.png` i metadane strony) albo `null` bez karty. */
export function readHospitalPreviewFromDisk(id: string): Promise<PreviewCard | null> {
  let promise = previews.get(id);
  if (!promise) {
    promise = previewFromDisk(id);
    previews.set(id, promise);
    promise.catch(() => previews.delete(id));
  }
  return promise;
}

async function previewFromDisk(id: string) {
  const key = hospitalPageKey(id);
  if (!key) return null;
  const [{ index, sections }, map] = await Promise.all([readFacilityYearsFromDisk(), readRegionsMapFromDisk()]);
  const input = hospitalPreviewInput(key, index, sections, map?.regions.find(([ow]) => ow === key.split("|")[0])?.[1] ?? "");
  return input ? hospitalPreviewCard(input) : null;
}

async function buildFromDisk(id: string) {
  const key = hospitalPageKey(id);
  if (!key) return null;
  const [owNfz, nip] = key.split("|");
  const [cards, trends, facilities, psz, profile, financial, map, payment, rpwdlDate, wardNames, contracts] = await Promise.all([
    allCards(), readTrendsFromDisk(), readFacilityYearsFromDisk(), readPszLevelsFromDisk(), readHospitalProfileRecordFromDisk(key), readFinancialResultsFromDisk(),
    readRegionsMapFromDisk(), readHospitalPaymentFromDisk(key), readRpwdlSnapshotDateFromDisk(), readWardNamesFromDisk(),
    readHospitalContractsFromDisk(key),
  ]);
  const level = psz.byNip.get(nip);
  // Zakładka „Finanse”: szpitale sieci PSZ.
  const lumpIndex = level === undefined ? null : await hospitalLumpIndex(key);
  return buildHospitalPageData({
    key, trends, groupFiles: [], datasets: [], facilities, profile, payment, contracts: level === undefined ? null : contracts, lumpIndex, rpwdlDate, wardNames,
    pszLevel: level === undefined ? null : psz.levels[level] ?? null,
    financial: financial.find((record) => record.nip === nip),
    regionName: map?.regions.find(([ow]) => ow === owNfz)?.[1] ?? "",
  }, cards);
}
