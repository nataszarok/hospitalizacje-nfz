import type { Metadata } from "next";
import { H55HistoryArticle } from "@/components/articles/H55HistoryArticle";
import { findArticle } from "@/lib/articles";
import { readH55ArticleDataFromDisk } from "@/lib/h55ArticleServer";
import { articleMetadata } from "@/lib/articlePreview";

const article = findArticle("historia-h55");

export const metadata: Metadata = articleMetadata(article.slug);

export default async function H55HistoryArticleRoute() {
  return <H55HistoryArticle data={await readH55ArticleDataFromDisk()} />;
}
