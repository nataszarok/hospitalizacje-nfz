import type { Metadata } from "next";
import { ArticlesPage } from "@/components/articles/ArticlesPage";
import { ARTICLES } from "@/lib/articles";
import { ARTICLES_PATH } from "@/lib/dashboardNavigation";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Artykuły",
  description: "Teksty o publicznej ochronie zdrowia w Polsce: jak działa system rozliczeń NFZ, skąd biorą się liczby i jak je czytać.",
  path: ARTICLES_PATH,
});

export default function ArticlesRoute() {
  return <ArticlesPage articles={ARTICLES} />;
}
