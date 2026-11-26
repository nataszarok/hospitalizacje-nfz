import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_SUBTITLE_LIMIT, articleMetadata, articlePreviewCard, articleVideoPreviewCard, jpegSize } from "@/lib/articlePreview";
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

  it.each(ARTICLES.filter((article) => article.video).map((article) => [article.slug, article] as const))("%s: film — og:video z adresem bezwzględnym i kadr podglądu z public/", (slug, article) => {
    const metadata = articleMetadata(slug);
    expect(metadata.openGraph).toMatchObject({ videos: [{ url: `https://funduszdanych.pl${article.video!.src}`, type: "video/mp4", width: article.video!.width, height: article.video!.height }] });
    const card = articleVideoPreviewCard(article)!;
    // Kadr podglądu: `previewFrame`, a bez niego poster odtwarzacza.
    const frameFile = readFileSync(join(process.cwd(), "public", article.video!.previewFrame ?? article.video!.poster));
    expect(card.frame).toBe(`data:image/jpeg;base64,${frameFile.toString("base64")}`);
    expect(card.frameWidth / card.frameHeight).toBeCloseTo(article.video!.width / article.video!.height, 2);
    expect(card.label).toBe(article.kicker);
  });

  it("artykuł bez filmu: bez og:video i bez kadru", () => {
    const article = ARTICLES.find((item) => !item.video)!;
    expect(articleMetadata(article.slug).openGraph).not.toHaveProperty("videos");
    expect(articleVideoPreviewCard(article)).toBeNull();
  });

  it("jpegSize czyta wymiary z nagłówka JPG", () => {
    const poster = readFileSync(join(process.cwd(), "public", ARTICLES.find((item) => item.video)!.video!.poster));
    expect(jpegSize(poster)).toEqual({ width: 1280, height: 720 });
    expect(jpegSize(Buffer.from("not a jpeg"))).toBeNull();
  });
});
