"use client";

import { useSyncExternalStore } from "react";

/**
 * Czy okno spełnia zapytanie CSS (np. „(max-width: 700px)”); `null` przed hydracją (strona statyczna nie zna szerokości okna).
 * Układ zależny od szerokości rozstrzygaj w CSS, a hook stosuj do stanu, którego CSS nie wyrazi (np. `aria-selected`).
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener?.("change", onChange);
      return () => list.removeEventListener?.("change", onChange);
    },
    () => typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : null,
    () => null,
  );
}
