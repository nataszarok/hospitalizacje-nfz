import type { Metadata } from "next";
import { JgpIntroArticle } from "@/components/articles/JgpIntroArticle";
import { findArticle } from "@/lib/articles";
import { buildJgpCatalog } from "@/lib/jgpCatalog";
import { buildJgpIntroFacts } from "@/lib/jgpIntroArticle";
import { articleMetadata } from "@/lib/articlePreview";
import { datasetHighlights } from "@/lib/staticData";
import { readStaticDatasetFromDisk, readTrendsFromDisk, readValuationsFromDisk } from "@/lib/staticDataServer";

const article = findArticle("czym-sa-jgp");

export const metadata: Metadata = articleMetadata(article.slug);

export default async function JgpIntroArticleRoute() {
  const [trends, valuations] = await Promise.all([readTrendsFromDisk(), readValuationsFromDisk()]);
  const catalog = buildJgpCatalog(trends);
  const latest = datasetHighlights(await readStaticDatasetFromDisk(catalog.latestYear));
  return <JgpIntroArticle facts={buildJgpIntroFacts(catalog, valuations, latest)} />;
}
