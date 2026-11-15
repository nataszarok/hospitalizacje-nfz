import type { Metadata } from "next";
import { articleHref, findArticle, type Article } from "@/lib/articles";
import { pageMetadata, previewImagePath } from "@/lib/pageMetadata";
import type { PreviewCard } from "@/lib/socialPreview";

/**
 * Podgląd linku artykułu (DESIGN.md 7.3): ten sam generator co karty JGP i szpitali (`socialPreview`), treść z wpisu
 * w `ARTICLES` — etykieta „Artykuł · <rodzaj>”, tytuł i opis. Bez wykresu: liczby z tekstu zmieniają się z danymi.
 */
export function articlePreviewCard(article: Article): PreviewCard {
  return { eyebrow: `Artykuł · ${article.kicker}`, title: article.title, subtitle: article.description, subtitleLimit: ARTICLE_SUBTITLE_LIMIT };
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
  });
}
