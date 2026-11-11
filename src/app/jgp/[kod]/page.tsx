import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JgpPage } from "@/components/jgp/JgpPage";
import { formatJgpName } from "@/lib/formatters";
import { jgpHref } from "@/lib/portalLinks";
import { jgpPreviewAlt, jgpPreviewCard } from "@/lib/jgpPreview";
import { readJgpPageDataFromDisk } from "@/lib/jgpPageServer";
import { pageMetadata, previewImagePath } from "@/lib/pageMetadata";
import { readJgpPagesIndexFromDisk, readRegionsMapFromDisk } from "@/lib/staticDataServer";

export const dynamicParams = false;

// Karta dla każdej grupy JGP z danych (lista z `scripts/build_jgp_pages.py`).
export async function generateStaticParams() {
  const { groups } = await readJgpPagesIndexFromDisk();
  return groups.map((kod) => ({ kod }));
}

export async function generateMetadata({ params }: { params: Promise<{ kod: string }> }): Promise<Metadata> {
  const { kod } = await params;
  const data = await readJgpPageDataFromDisk(kod);
  return pageMetadata({
    title: `${kod} ${data ? formatJgpName(data.name) : ""} | Grupy JGP`,
    // Pierwsze zdanie opisu (proza albo zdanie o rozpoznaniach) mówi wyszukiwarce, co obejmuje grupa.
    description: `Hospitalizacje w grupie JGP ${kod} w kolejnych latach i świadczeniodawcy, którzy leczą najwięcej pacjentów.${data?.description ? ` ${data.description.sentences[0].split(/(?<=\.)\s/)[0]}` : ""} Dane NFZ.`,
    path: jgpHref(kod) as string,
    image: data ? { url: previewImagePath.jgp(kod), alt: jgpPreviewAlt(jgpPreviewCard(data)) } : undefined,
  });
}

export default async function JgpGroupPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const [data, map] = await Promise.all([readJgpPageDataFromDisk(kod), readRegionsMapFromDisk()]);
  if (!data) notFound();
  return <JgpPage data={data} map={map} />;
}
