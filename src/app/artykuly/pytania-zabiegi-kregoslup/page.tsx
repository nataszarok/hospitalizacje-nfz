import type { Metadata } from "next";
import { SpineQuestionsArticle } from "@/components/articles/SpineQuestionsArticle";
import { findArticle } from "@/lib/articles";
import { articleMetadata } from "@/lib/articlePreview";
import { KOSZALIN, providerGroupsSeries } from "@/lib/spineQuestions";
import { readJgpGroupFileFromDisk } from "@/lib/staticDataServer";

const article = findArticle("pytania-zabiegi-kregoslup");

export const metadata: Metadata = articleMetadata(article.slug);

export default async function SpineQuestionsRoute() {
  const files = await Promise.all(["H52", "H53"].map((code) => readJgpGroupFileFromDisk(code)));
  if (files.some((file) => !file)) throw new Error("Brak plików grup H52/H53 w build-data/jgp (uruchom npm run generate:data)");
  return <SpineQuestionsArticle koszalin={providerGroupsSeries(files.map((file) => file!), KOSZALIN)} />;
}
