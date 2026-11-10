import type { ReactNode } from "react";
import { FUNNEL_LEGEND, FUNNEL_STATUS_COLORS } from "@/lib/mortalityFunnel";
import base from "./JgpPage.module.css";
import styles from "./JgpTabs.module.css";

/**
 * Legenda lejka śmiertelności: pięć stopni skali odchylenia.
 * `corner`: w pionie, w prawym górnym rogu wykresu (rodzic ma `position: relative`); domyślnie wiersz pod wykresem.
 * `children`: pozycje przed skalą (np. wybrany ośrodek w powiększeniu wykresu).
 */
export function FunnelLegend({ corner = false, children }: { corner?: boolean; children?: ReactNode }) {
  return <ul className={corner ? `${base.legend} ${styles.cornerLegend}` : base.legend} aria-label="Legenda lejka">
    {children}
    {FUNNEL_LEGEND.map((item) => <li key={item.status}><span className={base.swatch} style={{ background: FUNNEL_STATUS_COLORS[item.status] }} aria-hidden />{item.label}</li>)}
  </ul>;
}

/** Pozycja legendy z wybranym ośrodkiem: ten sam znak (gwiazda) co na wykresie i w tabeli. */
export function SelectedLegendItem({ name }: { name: string }) {
  return <li><i className={styles.selectedStar} aria-hidden />wybrany ośrodek: {name}</li>;
}
