import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HospitalPage } from "@/components/hospitals/HospitalPage";
import { hospitalPreviewAlt } from "@/lib/hospitalPreview";
import { readHospitalPageDataFromDisk, readHospitalPreviewFromDisk } from "@/lib/hospitalPageServer";
import { HOSPITAL_PAGE_KEYS, hospitalSlug } from "@/lib/hospitalPages";
import { pageMetadata, previewImagePath } from "@/lib/pageMetadata";

export const dynamicParams = false;

// Karty szpitali z `build-data/hospitals/index.json` (sieć PSZ i próbka), adres `/szpitale/<NIP>-<OW>`.
export function generateStaticParams() {
  return HOSPITAL_PAGE_KEYS.map((key) => ({ id: hospitalSlug(key) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await readHospitalPreviewFromDisk(id);
  return pageMetadata({
    title: `${card?.title ?? id} | Szpitale`,
    description: "Hospitalizacje szpitala w kolejnych latach: co leczy, jak długo leżą pacjenci, oddziały i łóżka. Dane NFZ i RPWDL.",
    path: `/szpitale/${id}`,
    image: card ? { url: previewImagePath.szpital(id), alt: hospitalPreviewAlt(card) } : undefined,
  });
}

export default async function HospitalCardRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await readHospitalPageDataFromDisk(id);
  if (!data) notFound();
  return <HospitalPage data={data} />;
}
