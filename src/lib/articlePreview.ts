import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { articleHref, findArticle, type Article } from "@/lib/articles";
import { pageMetadata, previewImagePath } from "@/lib/pageMetadata";
import { SITE_URL } from "@/lib/site";
import type { PreviewCard, VideoPreviewCard } from "@/lib/socialPreview";

/**
 * Podgląd linku artykułu (DESIGN.md 7.3): ten sam generator co karty JGP i szpitali (`socialPreview`), treść z wpisu
 * w `ARTICLES` — etykieta „Artykuł · <rodzaj>”, tytuł i opis. Bez wykresu: liczby z tekstu zmieniają się z danymi.
 */
export function articlePreviewCard(article: Article): PreviewCard {
  return { eyebrow: `Artykuł · ${article.kicker}`, title: article.title, subtitle: article.description, subtitleLimit: ARTICLE_SUBTITLE_LIMIT };
}

/**
 * Podgląd artykułu z filmem: kadr filmu (`previewFrame` albo poster z `public/`) z przyciskiem odtwarzania i czasem, jak miniatura wideo.
 * Tytuł i opis pokazuje serwis pod obrazem (z metadanych), więc obraz ich nie powtarza.
 */
export function articleVideoPreviewCard(article: Article): VideoPreviewCard | null {
  const video = article.video;
  if (!video) return null;
  const framePath = video.previewFrame ?? video.poster;
  const frame = readFileSync(join(process.cwd(), "public", framePath));
  const mime = framePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const posterSize = jpegSize(frame) ?? { width: video.width, height: video.height };
  return { frame: `data:${mime};base64,${frame.toString("base64")}`, frameWidth: posterSize.width, frameHeight: posterSize.height, durationSeconds: video.durationSeconds, label: article.kicker };
}

/** Wymiary JPG z nagłówka SOF (poster może być mniejszy niż film). Inny format: `null`. */
export function jpegSize(data: Buffer): { width: number; height: number } | null {
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) return null;
    const marker = data[i + 1];
    const length = data.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

/** Opis artykułu na obrazie: do ok. 4 wierszy (DESIGN.md 7.3, opis do ok. 200 znaków). */
export const ARTICLE_SUBTITLE_LIMIT = 220;

/** Tekst alternatywny obrazu: to samo co na obrazie, słowami. */
export const articlePreviewAlt = (article: Article) => `Artykuł funduszdanych.pl: ${article.title}. ${article.description}`;

/** Metadane strony artykułu z obrazem podglądu `/og/artykul/<slug>.png`. Każda trasa `/artykuly/<slug>` bierze je stąd. */
export function articleMetadata(slug: string): Metadata {
  const article = findArticle(slug);
  return pageMetadata({
    title: article.title,
    description: article.description,
    path: articleHref(article.slug),
    type: "article",
    image: { url: previewImagePath.artykul(article.slug), alt: articlePreviewAlt(article) },
    // Adres bezwzględny: Next nie dokleja `metadataBase` do `og:video`.
    video: article.video ? { url: `${SITE_URL}${article.video.src}`, type: "video/mp4", width: article.video.width, height: article.video.height } : undefined,
  });
}
