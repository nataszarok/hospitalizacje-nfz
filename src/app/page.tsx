import type { Metadata } from "next";
import { HomePage } from "@/components/portal/HomePage";
import { buildHomeStats } from "@/lib/homeStats";
import { buildHospitalHomeStats, buildHospitalMapStats } from "@/lib/hospitalHomeStats";
import { pageMetadata } from "@/lib/pageMetadata";
import { SITE_NAME } from "@/lib/site";
import { datasetHighlights } from "@/lib/staticData";
import {
  readAllStaticDatasetsFromDisk, readCitiesMapFromDisk, readFacilityYearsFromDisk, readHospitalProfilesFromDisk,
  readPeerPairsFromDisk, readPszNipsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk,
} from "@/lib/staticDataServer";

export const metadata: Metadata = pageMetadata({
  title: `${SITE_NAME} | Hospitalizacje, szpitale publiczne, wyceny JGP`,
  description: "Sprawdź, jak wyglądały hospitalizacje, porównuj publiczne szpitale i poznaj system wycen JGP. Analizy i artykuły o publicznej ochronie zdrowia na podstawie danych NFZ.",
  path: "/",
});

export default async function Home() {
  const [datasets, trends, map, profiles, pairs, psz, facilityYears, cities] = await Promise.all([
    readAllStaticDatasetsFromDisk(), readTrendsFromDisk(), readRegionsMapFromDisk(),
    readHospitalProfilesFromDisk(), readPeerPairsFromDisk(), readPszNipsFromDisk(),
    readFacilityYearsFromDisk(), readCitiesMapFromDisk(),
  ]);
  const latest = datasets.at(-1)!;
  return <HomePage
    highlights={datasetHighlights(datasets)}
    stats={buildHomeStats(trends, latest, map)}
    hospitals={buildHospitalHomeStats(profiles, pairs, latest.facilities)}
    hospitalMap={buildHospitalMapStats(facilityYears.index, facilityYears.sections, cities, map, psz)}
  />;
}
