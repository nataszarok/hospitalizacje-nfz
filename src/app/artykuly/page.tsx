import type { Metadata } from "next";
import { ArticlesPage } from "@/components/articles/ArticlesPage";
import { ARTICLES_PATH } from "@/lib/dashboardNavigation";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata: Metadata = pageMetadata({
  title: "Artykuły",
  description: "Artykuły o publicznej ochronie zdrowia na podstawie danych NFZ, m.in. o rozliczeniach i kontrolach NFZ. Moduł w przygotowaniu.",
  path: ARTICLES_PATH,
});

export default function ArticlesRoute() {
  return <ArticlesPage />;
}
