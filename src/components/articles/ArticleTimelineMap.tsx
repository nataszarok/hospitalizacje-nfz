"use client";

import { useState } from "react";
import { RegionView } from "@/components/explorer/RegionView";
import { YearPlayer } from "@/components/YearPlayer";
import type { EstimationMethod } from "@/lib/types";
import styles from "./ArticleFigure.module.css";

/**
 * Mapa w czasie w artykule: mapa widoku „Gdzie” z eksploratora (`RegionView` z `mapOnly`: sama mapa z legendą, bez tabeli
 * i przełącznika, bez legendy — skala jest w podpisie; województwa w skali ±2 odchylenia standardowe wokół średniej roku) z osią lat nad mapą (`YearPlayer`: suwak i odtwarzanie). Rok na start: pierwszy (odtwarzanie idzie do przodu).
 */
export function ArticleTimelineMap({ title, caption, productCodes, years, method = "sim", initialMode = "cities" }: {
  title: string;
  caption: string;
  productCodes: string[];
  years: string[];
  method?: EstimationMethod;
  initialMode?: "regions" | "cities";
}) {
  const [index, setIndex] = useState(0);
  return <figure className={styles.figure}>
    <div className={styles.head}><figcaption className={styles.title}>{title}</figcaption></div>
    <YearPlayer years={years} index={index} onIndex={setIndex} />
    <RegionView productCodes={productCodes} year={years[index]} method={method} initialMode={initialMode} mapOnly regionScale="yearSd" legend={false} />
    <p className={styles.note}>{caption}</p>
  </figure>;
}
