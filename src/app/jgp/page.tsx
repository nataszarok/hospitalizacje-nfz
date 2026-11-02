import type { Metadata } from "next";
import { JgpCatalogPage } from "@/components/jgp/JgpCatalogPage";
import { buildJgpCatalog } from "@/lib/jgpCatalog";
import { SITE_NAME } from "@/lib/site";
import { readTrendsFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = {
  title: `Grupy JGP | ${SITE_NAME}`,
  description: "Katalog grup JGP: hospitalizacje w kolejnych latach, zmiana rok do roku i śmiertelność. Każda grupa ma własną kartę. Dane NFZ.",
};

export default async function JgpCatalogRoute() {
  return <JgpCatalogPage catalog={buildJgpCatalog(await readTrendsFromDisk())} />;
}
