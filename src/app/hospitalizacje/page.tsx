import type { Metadata } from "next";
import { HospitalizationSummaryPage } from "@/components/summary/HospitalizationSummaryPage";
import { buildHospitalizationSummary } from "@/lib/hospitalizationSummary";
import { SITE_NAME } from "@/lib/site";
import { readAllStaticDatasetsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `Hospitalizacje w Polsce | ${SITE_NAME}`,
  description: "Podsumowanie hospitalizacji rozliczonych przez NFZ: liczba w latach i miesiącach, tryb przyjęcia, województwa, obszary leczenia, rodziny grup JGP, zgony i świadczeniodawcy.",
};

export default async function HospitalizationSummaryRoute() {
  const [datasets, trends, map] = await Promise.all([readAllStaticDatasetsFromDisk(), readTrendsFromDisk(), readRegionsMapFromDisk()]);
  return <HospitalizationSummaryPage summary={buildHospitalizationSummary(trends, datasets, map)} />;
}
