import { jgpPreviewCard } from "@/lib/jgpPreview";
import { readJgpPageDataFromDisk } from "@/lib/jgpPageServer";
import { PREVIEW_CONTENT_TYPE, renderPreviewPng } from "@/lib/socialPreview";
import { readJgpPagesIndexFromDisk } from "@/lib/staticDataServer";

// Obraz podglądu linku karty grupy JGP: plik `/og/jgp/<KOD>.png`, budowany raz podczas statycznego eksportu.
// Rozszerzenie jest w parametrze, bo Cloudflare Pages wybiera typ pliku po rozszerzeniu.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const { groups } = await readJgpPagesIndexFromDisk();
  return groups.map((kod) => ({ plik: `${kod}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ plik: string }> }) {
  const kod = (await params).plik.replace(/\.png$/, "");
  const data = await readJgpPageDataFromDisk(kod);
  if (!data) return new Response(null, { status: 404 });
  const png = await renderPreviewPng(jgpPreviewCard(data));
  return new Response(new Uint8Array(png), { headers: { "Content-Type": PREVIEW_CONTENT_TYPE } });
}
