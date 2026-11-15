import type { Metadata } from "next";
import { H55HistoryArticle } from "@/components/articles/H55HistoryArticle";
import { articleHref, findArticle } from "@/lib/articles";
import { readH55ArticleDataFromDisk } from "@/lib/h55ArticleServer";
import { pageMetadata } from "@/lib/pageMetadata";

const article = findArticle("historia-h55");

export const metadata: Metadata = pageMetadata({
  title: article.title,
  description: article.description,
  path: articleHref(article.slug),
});

export default async function H55HistoryArticleRoute() {
  return <H55HistoryArticle data={await readH55ArticleDataFromDisk()} />;
}
