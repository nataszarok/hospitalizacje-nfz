"use client";

import { useEffect } from "react";
import { prefetchForHref } from "@/lib/dataPrefetch";

/**
 * Jeden nasłuch na całą stronę (w `layout.tsx`): najechanie, fokus albo dotyk linku do eksploratora lub szpitali
 * zaczyna pobierać dane tej strony (`prefetchForHref`). Każdy moduł pobieramy z wyprzedzeniem raz na wizytę.
 */
export function DataPrefetch() {
  useEffect(() => {
    const done = new Set<string>();
    const onIntent = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = link?.getAttribute("href");
      // Eksplorator JGP i porównanie szpitali; katalog `/szpitale` i karty szpitali mają dane w HTML.
      if (!href || !/^\/(analizy|szpitale\/eksplorator)(\?|$)/.test(href)) return;
      // Porównanie szpitali ma własne pliki (pary A/B): osobny klucz niż profil.
      const key = href.split("?")[0] + (/[?&]hv=c(&|$)/.test(href) ? "?hv=c" : "");
      if (done.has(key)) return;
      if (prefetchForHref(href, window.location.origin)) done.add(key);
    };
    const events = ["pointerover", "focusin", "touchstart"] as const;
    for (const name of events) document.addEventListener(name, onIntent, { passive: true });
    return () => { for (const name of events) document.removeEventListener(name, onIntent); };
  }, []);
  return null;
}
