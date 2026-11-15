import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_SUBTITLE_LIMIT, articleMetadata, articlePreviewCard } from "@/lib/articlePreview";
import { ARTICLES } from "@/lib/articles";

// DESIGN.md 7.3: każdy artykuł ma podgląd linku — obraz `/og/artykul/<slug>.png` w Open Graph i na X.
describe("podgląd linku artykułów", () => {
  it.each(ARTICLES.map((article) => [article.slug, article] as const))("%s: metadane z obrazem podglądu i typem article", (slug, article) => {
    const metadata = articleMetadata(slug);
    const image = `/og/artykul/${slug}.png`;
    expect(metadata.openGraph).toMatchObject({ type: "article", url: `/artykuly/${slug}`, title: article.title, images: [expect.objectContaining({ url: image, width: 1200, height: 630 })] });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [expect.objectContaining({ url: image })] });
  });

  it.each(ARTICLES.map((article) => [article.slug] as const))("%s: trasa strony bierze metadane z articleMetadata", (slug) => {
    const page = readFileSync(join(process.cwd(), "src", "app", "artykuly", slug, "page.tsx"), "utf8");
    expect(page).toContain("articleMetadata(");
  });

  it("obraz: etykieta „Artykuł · rodzaj”, tytuł i opis, bez wykresu", () => {
    const card = articlePreviewCard(ARTICLES[0]);
    expect(card).toEqual({ eyebrow: `Artykuł · ${ARTICLES[0].kicker}`, title: ARTICLES[0].title, subtitle: ARTICLES[0].description, subtitleLimit: ARTICLE_SUBTITLE_LIMIT });
  });

  it.each(ARTICLES.map((article) => [article.slug, article.description] as const))("%s: opis mieści się na obrazie bez wielokropka", (_slug, description) => {
    expect(description.length).toBeLessThanOrEqual(ARTICLE_SUBTITLE_LIMIT);
  });
});
