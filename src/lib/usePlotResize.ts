"use client";

import { useEffect, type RefObject } from "react";
import { loadPlotly } from "@/lib/plotlyLoader";

/** Odstęp od ostatniej zmiany szerokości do przerysowania (animacja trybu analizy trwa ok. 0,35 s). */
const RESIZE_DELAY_MS = 80;

/**
 * Wykres Plotly dopasowuje się do szerokości swojego kontenera, nie tylko okna. `responsive: true` w Plotly słucha
 * wyłącznie zmiany rozmiaru okna, a szerokość kontenera zmienia się też bez niej (tryb analizy w eksploratorze,
 * panel boczny, powiększenie). ResizeObserver przerysowuje wykres po zmianie szerokości elementu `ref`.
 */
export function usePlotResize(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Tylko narysowany (Plotly dopisuje `_fullLayout` po pierwszym `react`) i widoczny wykres: `Plots.resize`
        // odrzuca element bez `offsetParent` (ukryty albo odłączony) błędem „Resize must be passed a displayed plot div”.
        if (!("_fullLayout" in element) || element.offsetParent === null) return;
        void loadPlotly().then((Plotly) => Plotly.Plots.resize(element)).catch(() => undefined);
      }, RESIZE_DELAY_MS);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ref]);
}
