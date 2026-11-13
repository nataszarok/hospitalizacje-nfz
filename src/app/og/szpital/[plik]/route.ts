import { readHospitalPreviewFromDisk } from "@/lib/hospitalPageServer";
import { HOSPITAL_PAGE_KEYS, hospitalSlug } from "@/lib/hospitalPages";
import { PREVIEW_CONTENT_TYPE, renderPreviewPng } from "@/lib/socialPreview";

// Obraz podglądu linku karty szpitala: plik `/og/szpital/<NIP>-<OW>.png`, budowany raz podczas statycznego eksportu.
// Rozszerzenie jest w parametrze, bo Cloudflare Pages wybiera typ pliku po rozszerzeniu.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return HOSPITAL_PAGE_KEYS.map((key) => ({ plik: `${hospitalSlug(key)}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ plik: string }> }) {
  const id = (await params).plik.replace(/\.png$/, "");
  const card = await readHospitalPreviewFromDisk(id);
  if (!card) return new Response(null, { status: 404 });
  const png = await renderPreviewPng(card);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": PREVIEW_CONTENT_TYPE } });
}
