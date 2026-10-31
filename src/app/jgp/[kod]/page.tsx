import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JgpPage } from "@/components/jgp/JgpPage";
import { buildJgpPageData, JGP_PAGE_CODES } from "@/lib/jgpPage";
import { SITE_NAME } from "@/lib/site";
import {
  readHospitalizationIndexFromDisk, readJgpGroupFileFromDisk, readPeerPairsFromDisk, readRegionsMapFromDisk, readStaticDatasetFromDisk, readTrendsFromDisk, readValuationsFromDisk,
} from "@/lib/staticDataServer";

export const dynamicParams = false;

export function generateStaticParams() {
  return JGP_PAGE_CODES.map((kod) => ({ kod }));
}

async function pageData(kod: string) {
  const [trends, index, groupFile, valuations, peerPairs] = await Promise.all([
    readTrendsFromDisk(), readHospitalizationIndexFromDisk(), readJgpGroupFileFromDisk(kod), readValuationsFromDisk(), readPeerPairsFromDisk(),
  ]);
  return buildJgpPageData(trends, await readStaticDatasetFromDisk(index.latestYear), kod, "min", 15, {
    groupFile, valuations: valuations.rows, valuationYear: valuations.year, peerPairs,
  });
}

export async function generateMetadata({ params }: { params: Promise<{ kod: string }> }): Promise<Metadata> {
  const { kod } = await params;
  const data = await pageData(kod);
  return {
    title: `${kod} ${data?.name ?? ""} | Grupy JGP | ${SITE_NAME}`,
    description: `Hospitalizacje w grupie JGP ${kod} w kolejnych latach i świadczeniodawcy, którzy leczą najwięcej pacjentów. Dane NFZ.`,
  };
}

export default async function JgpGroupPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const [data, map] = await Promise.all([pageData(kod), readRegionsMapFromDisk()]);
  if (!data) notFound();
  return <JgpPage data={data} map={map} />;
}
