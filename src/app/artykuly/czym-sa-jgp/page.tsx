import type { Metadata } from "next";
import { JgpIntroArticle } from "@/components/articles/JgpIntroArticle";
import { articleHref, findArticle } from "@/lib/articles";
import { buildJgpCatalog } from "@/lib/jgpCatalog";
import { buildJgpIntroFacts } from "@/lib/jgpIntroArticle";
import { pageMetadata } from "@/lib/pageMetadata";
import { datasetHighlights } from "@/lib/staticData";
import { readStaticDatasetFromDisk, readTrendsFromDisk, readValuationsFromDisk } from "@/lib/staticDataServer";

const article = findArticle("czym-sa-jgp");

export const metadata: Metadata = pageMetadata({
  title: article.title,
  description: article.description,
  path: articleHref(article.slug),
});

export default async function JgpIntroArticleRoute() {
  const [trends, valuations] = await Promise.all([readTrendsFromDisk(), readValuationsFromDisk()]);
  const catalog = buildJgpCatalog(trends);
  const latest = datasetHighlights(await readStaticDatasetFromDisk(catalog.latestYear));
  return <JgpIntroArticle facts={buildJgpIntroFacts(catalog, valuations, latest)} />;
}
