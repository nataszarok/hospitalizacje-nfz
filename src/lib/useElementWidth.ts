"use client";

import { useEffect, useState } from "react";

/**
 * Szerokość elementu w pikselach (ResizeObserver); 0 przed pomiarem. Po załadowaniu fontów mierzy jeszcze raz,
 * bo szerokość tekstu zależy od kroju. Bez ResizeObserver (testy) — jeden pomiar w następnej klatce.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
  const [node, ref] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const [, setFonts] = useState(0);
  useEffect(() => {
    const element = node;
    if (!element) return;
    document.fonts?.ready.then(() => setFonts((value) => value + 1));
    if (typeof ResizeObserver === "undefined") {
      const frame = requestAnimationFrame(() => setWidth(element.clientWidth));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [node]);
  return { ref, width };
}
