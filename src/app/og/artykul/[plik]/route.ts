import { articlePreviewCard } from "@/lib/articlePreview";
import { ARTICLES } from "@/lib/articles";
import { PREVIEW_CONTENT_TYPE, renderPreviewPng } from "@/lib/socialPreview";

// Obraz podglądu linku artykułu: plik `/og/artykul/<slug>.png`, budowany raz podczas statycznego eksportu.
// Rozszerzenie jest w parametrze, bo Cloudflare Pages wybiera typ pliku po rozszerzeniu.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ plik: `${article.slug}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ plik: string }> }) {
  const slug = (await params).plik.replace(/\.png$/, "");
  const article = ARTICLES.find((item) => item.slug === slug);
  if (!article) return new Response(null, { status: 404 });
  const png = await renderPreviewPng(articlePreviewCard(article));
  return new Response(new Uint8Array(png), { headers: { "Content-Type": PREVIEW_CONTENT_TYPE } });
}
