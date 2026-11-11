import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

/**
 * Metadane strony z podglądem linku (Open Graph i X `summary_large_image`).
 * Next łączy `openGraph` i `twitter` z układu płytko: strona z własnym `openGraph` musi podać cały obiekt,
 * dlatego wszystkie strony biorą metadane z tej funkcji. Adresy są względne, bazę daje `metadataBase` w `layout.tsx`.
 *
 * Podgląd zależy tylko od ścieżki: robot X nie uruchamia JS, a statyczny HTML nie zna parametrów
 * (`?osrodek=` pokazuje ten sam obraz co karta grupy).
 */

/** Obraz ogólny portalu (baner marki z `brand/`, paleta PNG), 1200×630. */
export const DEFAULT_PREVIEW_IMAGE = "/og/funduszdanych.png";

/** Obrazy podglądu kart. Nowy rodzaj karty (np. profil szpitala: `/og/szpital/<klucz>.png`) dopisz tutaj. */
export const previewImagePath = {
  jgp: (jgpCode: string) => `/og/jgp/${encodeURIComponent(jgpCode)}.png`,
};

export interface PageMetadataInput {
  /** Tytuł bez nazwy portalu; nazwę dopisujemy w tytule dokumentu. */
  title: string;
  description: string;
  /** Ścieżka strony, np. `/jgp/E53G`. */
  path: string;
  image?: { url: string; alt: string };
}

export function pageMetadata({ title, description, path, image }: PageMetadataInput): Metadata {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const images = [{ url: image?.url ?? DEFAULT_PREVIEW_IMAGE, width: 1200, height: 630, alt: image?.alt ?? `${SITE_NAME}: publiczna ochrona zdrowia w liczbach` }];
  return {
    title: fullTitle,
    description,
    openGraph: { type: "website", locale: "pl_PL", siteName: SITE_NAME, url: path, title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
