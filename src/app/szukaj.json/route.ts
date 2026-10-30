import { buildSearchIndex } from "@/lib/search";
import { readHospitalizationIndexFromDisk, readStaticDatasetFromDisk } from "@/lib/staticDataServer";

// Indeks wyszukiwarki budowany raz, podczas statycznego eksportu (plik /szukaj.json).
export const dynamic = "force-static";

export async function GET() {
  const { latestYear } = await readHospitalizationIndexFromDisk();
  return Response.json(buildSearchIndex(await readStaticDatasetFromDisk(latestYear)));
}
