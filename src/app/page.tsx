import type { Metadata } from "next";
import { HomePage } from "@/components/portal/HomePage";
import { SITE_NAME } from "@/lib/site";
import { datasetHighlights } from "@/lib/staticData";
import { readStaticDatasetFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `${SITE_NAME} | Dane i analizy szpitali`,
  description: "Przeglądaj analizy hospitalizacji, śmiertelności i trybu przyjęć. Odkrywaj dane NFZ oraz porównuj szpitale.",
};

export default async function Home() {
  return <HomePage highlights={datasetHighlights(await readStaticDatasetFromDisk())} />;
}
