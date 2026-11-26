import type { Metadata } from "next";
import { KoszalinFilmArticle } from "@/components/articles/KoszalinFilmArticle";
import { findArticle } from "@/lib/articles";
import { articleMetadata } from "@/lib/articlePreview";

const article = findArticle("film-koszalin-h52-h53");

export const metadata: Metadata = articleMetadata(article.slug);

export default function KoszalinFilmRoute() {
  return <KoszalinFilmArticle />;
}
