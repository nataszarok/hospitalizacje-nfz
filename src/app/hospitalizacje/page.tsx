import type { Metadata } from "next";
import { HospitalizationSummaryPage } from "@/components/summary/HospitalizationSummaryPage";
import { buildHospitalizationSummary } from "@/lib/hospitalizationSummary";
import { SITE_NAME } from "@/lib/site";
import { readAllStaticDatasetsFromDisk, readJgpSettlementsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `Hospitalizacje w Polsce | ${SITE_NAME}`,
  description: "Podsumowanie hospitalizacji rozliczonych przez NFZ: liczba w latach i miesiącach, długość pobytu, tryb przyjęcia, zgony, województwa, obszary leczenia, kwoty NFZ, wzrosty i spadki grup JGP oraz świadczeniodawcy.",
};

export default async function HospitalizationSummaryRoute() {
  const [datasets, trends, map, settlements] = await Promise.all([readAllStaticDatasetsFromDisk(), readTrendsFromDisk(), readRegionsMapFromDisk(), readJgpSettlementsFromDisk()]);
  return <HospitalizationSummaryPage summary={buildHospitalizationSummary(trends, datasets, map, settlements)} />;
}
