import type { Metadata } from "next";
import { AboutDataPage } from "@/components/about/AboutDataPage";
import { SITE_NAME } from "@/lib/site";
import { readHospitalizationIndexFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `O danych | ${SITE_NAME}`,
  description: "Źródła danych, definicje i metody liczenia hospitalizacji, śmiertelności i wartości ukrytych w danych NFZ.",
};

export default async function AboutDataRoute() {
  const { years } = await readHospitalizationIndexFromDisk();
  return <AboutDataPage yearFrom={years[0]} yearTo={years[years.length - 1]} />;
}
