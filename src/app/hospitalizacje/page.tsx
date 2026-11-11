import type { Metadata } from "next";
import { HospitalizationSummaryPage } from "@/components/summary/HospitalizationSummaryPage";
import { buildHospitalizationSummary } from "@/lib/hospitalizationSummary";
import { formatYearRange } from "@/lib/formatters";
import { pageMetadata } from "@/lib/pageMetadata";
import { readAllStaticDatasetsFromDisk, readHospitalizationIndexFromDisk, readJgpSettlementsFromDisk, readRegionsMapFromDisk, readTrendsFromDisk } from "@/lib/staticDataServer";

export async function generateMetadata(): Promise<Metadata> {
  const { years } = await readHospitalizationIndexFromDisk();
  return pageMetadata({
    title: "Hospitalizacje w Polsce",
    description: `Podsumowanie hospitalizacji rozliczonych przez NFZ w latach ${formatYearRange(years[0], years.at(-1) as string)}: liczba w latach i miesiącach, długość pobytu, tryb przyjęcia, zgony, województwa, obszary leczenia, kwoty NFZ, wzrosty i spadki grup JGP oraz świadczeniodawcy.`,
    path: "/hospitalizacje",
  });
}

export default async function HospitalizationSummaryRoute() {
  const [datasets, trends, map, settlements] = await Promise.all([readAllStaticDatasetsFromDisk(), readTrendsFromDisk(), readRegionsMapFromDisk(), readJgpSettlementsFromDisk()]);
  return <HospitalizationSummaryPage summary={buildHospitalizationSummary(trends, datasets, map, settlements)} />;
}
