import type { Metadata } from "next";
import { JgpCatalogPage } from "@/components/jgp/JgpCatalogPage";
import { buildJgpCatalog } from "@/lib/jgpCatalog";
import { pageMetadata } from "@/lib/pageMetadata";
import { readJgpSettlementsFromDisk, readTrendsFromDisk } from "@/lib/staticDataServer";

export const metadata: Metadata = pageMetadata({
  title: "Grupy JGP",
  description: "Katalog grup JGP: hospitalizacje w kolejnych latach, zmiana rok do roku, śmiertelność i rozliczenia NFZ. Każda grupa ma własną kartę. Dane NFZ.",
  path: "/jgp",
});

export default async function JgpCatalogRoute() {
  const [trends, settlements] = await Promise.all([readTrendsFromDisk(), readJgpSettlementsFromDisk()]);
  return <JgpCatalogPage catalog={buildJgpCatalog(trends, settlements)} />;
}
