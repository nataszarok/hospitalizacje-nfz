import type { Metadata } from "next";
import { AboutDataPage } from "@/components/about/AboutDataPage";
import { formatYearRange } from "@/lib/formatters";
import { pageMetadata } from "@/lib/pageMetadata";
import { readHospitalizationIndexFromDisk } from "@/lib/staticDataServer";

export async function generateMetadata(): Promise<Metadata> {
  const { years } = await readHospitalizationIndexFromDisk();
  return pageMetadata({
    title: "O danych",
    description: `Źródła danych, definicje i metody liczenia hospitalizacji, śmiertelności i wartości ukrytych w danych NFZ za lata ${formatYearRange(years[0], years.at(-1) as string)}.`,
    path: "/o-danych",
  });
}

export default async function AboutDataRoute() {
  const { years } = await readHospitalizationIndexFromDisk();
  return <AboutDataPage yearFrom={years[0]} yearTo={years[years.length - 1]} />;
}
