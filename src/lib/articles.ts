import { ARTICLES_PATH } from "@/lib/dashboardNavigation";

/** Artykuł portalu: adres, tytuł i krótki opis do listy `/artykuly` i metadanych. */
export interface Article {
  slug: string;
  title: string;
  description: string;
  /** Etykieta nad tytułem, np. „Podstawy”. */
  kicker: string;
}

// Adres modułu jest jeden dla menu, strony głównej i listy: `ARTICLES_PATH` w `dashboardNavigation.ts`.
export { ARTICLES_PATH };

export const articleHref = (slug: string) => `${ARTICLES_PATH}/${slug}`;

/** Lista artykułów od najnowszego. Nowy artykuł: wpis tutaj + trasa `src/app/artykuly/<slug>/page.tsx` z `articleMetadata(slug)` (podgląd linku). */
export const ARTICLES: readonly Article[] = [
  {
    slug: "pytania-zabiegi-kregoslup",
    title: "Zabiegi na kręgosłupie: pytania do NFZ",
    description: "Pytania o rozliczenia H52, H53 i H55 i o kontrole NFZ. Kontrole z lat 2024–2025 badały zwykle 2022 r. i objęły co piąty miesiąc rozliczeń skontrolowanych szpitali.",
    kicker: "Pytania",
  },
  {
    slug: "historia-h55",
    title: "H55. Historia jednego kodu",
    description: "Dziewięć lat rozliczeń termolezji kręgosłupa i 25 kontroli NFZ. Kontrolerzy sprawdzili co piąty miesiąc, w którym skontrolowane szpitale rozliczały H55.",
    kicker: "Analiza",
  },
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
