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
      if (!href || !/^\/(analizy|szpitale)(\?|$)/.test(href)) return;
      const key = href.split("?")[0];
      if (done.has(key)) return;
      if (prefetchForHref(href, window.location.origin)) done.add(key);
    };
    const events = ["pointerover", "focusin", "touchstart"] as const;
    for (const name of events) document.addEventListener(name, onIntent, { passive: true });
    return () => { for (const name of events) document.removeEventListener(name, onIntent); };
  }, []);
  return null;
}
