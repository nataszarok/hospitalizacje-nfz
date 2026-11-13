/** Artykuł portalu: adres, tytuł i krótki opis do listy `/artykuly` i metadanych. */
export interface Article {
  slug: string;
  title: string;
  description: string;
  /** Etykieta nad tytułem, np. „Podstawy”. */
  kicker: string;
}

export const ARTICLES_PATH = "/artykuly";

export const articleHref = (slug: string) => `${ARTICLES_PATH}/${slug}`;

/** Lista artykułów od najnowszego. Nowy artykuł: wpis tutaj + trasa `src/app/artykuly/<slug>/page.tsx`. */
export const ARTICLES: readonly Article[] = [
  {
    slug: "czym-sa-jgp",
    title: "Czym są grupy JGP?",
    description: "Wprowadzenie od zera na przykładzie czterech pacjentów z kamicą żółciową: od wypisu ze szpitala przez kody i grupę JGP do kwoty, którą płaci NFZ.",
    kicker: "Podstawy",
  },
];

export function findArticle(slug: string): Article {
  const article = ARTICLES.find((item) => item.slug === slug);
  if (!article) throw new Error(`Brak artykułu: ${slug}`);
  return article;
}
