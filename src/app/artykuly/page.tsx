import type { Metadata } from "next";
import { ArticleIndexPage } from "@/components/articles/ArticleIndexPage";
import { ARTICLES, ARTICLES_PATH } from "@/lib/articles";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Artykuły",
  description: "Teksty o publicznej ochronie zdrowia w Polsce: jak działa system rozliczeń NFZ, skąd biorą się liczby i jak je czytać.",
  path: ARTICLES_PATH,
});

export default function ArticlesRoute() {
  return <ArticleIndexPage articles={ARTICLES} />;
}
