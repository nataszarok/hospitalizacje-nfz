import type { Metadata } from "next";
import { HomePage } from "@/components/portal/HomePage";
import { buildHomeStats } from "@/lib/homeStats";
import { buildHospitalHomeStats } from "@/lib/hospitalHomeStats";
import { SITE_NAME } from "@/lib/site";
import { datasetHighlights } from "@/lib/staticData";
import { readAllStaticDatasetsFromDisk, readFinancialResultsFromDisk, readHospitalProfilesFromDisk, readPeerPairsFromDisk, readPszNipsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `${SITE_NAME} | Hospitalizacje, szpitale publiczne, wyceny JGP`,
  description: "Sprawdź, jak wyglądały hospitalizacje, porównuj publiczne szpitale i poznaj system wycen JGP. Analizy i artykuły o publicznej ochronie zdrowia na podstawie danych NFZ.",
};

export default async function Home() {
  const [datasets, trends, map, profiles, financial, pairs, psz] = await Promise.all([
    readAllStaticDatasetsFromDisk(), readTrendsFromDisk(), readRegionsMapFromDisk(),
    readHospitalProfilesFromDisk(), readFinancialResultsFromDisk(), readPeerPairsFromDisk(), readPszNipsFromDisk(),
  ]);
  const latest = datasets.at(-1)!;
  return <HomePage
    highlights={datasetHighlights(datasets)}
    stats={buildHomeStats(trends, latest, map)}
    hospitals={buildHospitalHomeStats(profiles, financial, pairs, latest.facilities, psz)}
  />;
}
