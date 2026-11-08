import type { ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import styles from "./Explorer.module.css";

export interface ExplorerKpi {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** Objaśnienie pod ikoną „?”. */
  help?: string;
}

/**
 * Pasek liczb nad widokiem eksploratora: ten sam we wszystkich widokach i w tym samym stylu co liczby
 * w nagłówku karty grupy JGP (etykieta, wartość, krótki dopisek).
 */
export function ExplorerKpis({ items }: { items: ExplorerKpi[] }) {
  return <dl className={styles.kpis} aria-label="Liczby wybranego zakresu">
    {items.map((item) => <div key={item.label}>
      <dt>{item.label}{item.help ? <InfoTip label={item.help} ariaLabel={`Objaśnienie: ${item.label}`} /> : null}</dt>
      <dd>{item.value}</dd>
      {item.note ? <span>{item.note}</span> : null}
    </div>)}
  </dl>;
}
