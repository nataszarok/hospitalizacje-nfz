import type { ReactNode } from "react";
import { FUNNEL_LEGEND, FUNNEL_LINE_LEGEND, FUNNEL_STATUS_COLORS } from "@/lib/mortalityFunnel";
import base from "./JgpPage.module.css";
import styles from "./JgpTabs.module.css";

/**
 * Legenda granic odchyleń (lejka): pięć stopni skali odchylenia i dwie linie granic (95% kropki, 99,8% kreski).
 * `statuses={false}`: tylko linie granic (punkty mają kolory obszarów).
 * `corner`: w pionie, w prawym górnym rogu wykresu (rodzic ma `position: relative`); domyślnie wiersz pod wykresem.
 * `children`: pozycje przed skalą (np. wybrany ośrodek w powiększeniu wykresu).
 */
export function FunnelLegend({ corner = false, statuses = true, children }: { corner?: boolean; statuses?: boolean; children?: ReactNode }) {
  return <ul className={corner ? `${base.legend} ${styles.cornerLegend}` : base.legend} aria-label="Legenda granic odchyleń">
    {children}
    {statuses ? FUNNEL_LEGEND.map((item) => <li key={item.status}><span className={base.swatch} style={{ background: FUNNEL_STATUS_COLORS[item.status] }} aria-hidden />{item.label}</li>) : null}
    {FUNNEL_LINE_LEGEND.map((item) => <li key={item.dash}>
      <svg className={styles.legendLine} width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" strokeDasharray={item.dash === "dot" ? "2 2" : "5 3"} /></svg>
      {item.label}
    </li>)}
  </ul>;
}

/** Pozycja legendy z wybranym ośrodkiem: ten sam znak (gwiazda) co na wykresie i w tabeli. */
export function SelectedLegendItem({ name }: { name: string }) {
  return <li><i className={styles.selectedStar} aria-hidden />wybrany ośrodek: {name}</li>;
}
