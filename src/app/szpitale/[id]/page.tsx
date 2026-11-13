import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HospitalPage } from "@/components/hospitals/HospitalPage";
import { LUMP_BASE_YEAR, lumpSumByYear, lumpSumIndex, lumpSumReference, type LumpIndex } from "@/lib/hospitalFinance";
import { buildHospitalCards, buildHospitalPageData, type HospitalCards } from "@/lib/hospitalPage";
import { HOSPITAL_PAGE_KEYS, hospitalPageKey, hospitalSlug } from "@/lib/hospitalPages";
import { pageMetadata } from "@/lib/pageMetadata";
import {
  readAllStaticDatasetsFromDisk, readFacilityYearsFromDisk, readFinancialResultsFromDisk, readAllHospitalContractsFromDisk, readHospitalContractsFromDisk, readHospitalPaymentFromDisk, readHospitalProfileRecordFromDisk, readRpwdlSnapshotDateFromDisk, readJgpGroupFileFromDisk, readWardNamesFromDisk,
  readJgpPagesIndexFromDisk, readPszLevelsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk,
} from "@/lib/staticDataServer";

export const dynamicParams = false;

// Karty szpitali z `build-data/hospitals/index.json` (sieć PSZ i próbka), adres `/szpitale/<NIP>-<OW>`.
export function generateStaticParams() {
  return HOSPITAL_PAGE_KEYS.map((key) => ({ id: hospitalSlug(key) }));
}

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

async function pageData(id: string) {
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await pageData(id);
  // Obraz podglądu: ogólny. Własny obraz karty szpitala dopiszemy w `previewImagePath` (jak karty JGP).
  return pageMetadata({
    title: `${data?.name ?? id} | Szpitale`,
    description: "Hospitalizacje szpitala w kolejnych latach: co leczy, jak długo leżą pacjenci, oddziały i łóżka. Dane NFZ i RPWDL.",
    path: `/szpitale/${id}`,
  });
}

export default async function HospitalCardRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await pageData(id);
  if (!data) notFound();
  return <HospitalPage data={data} />;
}
