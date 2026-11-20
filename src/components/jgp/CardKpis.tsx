import type { ReactNode } from "react";
import tabs from "@/components/jgp/JgpTabs.module.css";

export interface CardKpi {
  /** Etykieta boksu na szerokim ekranie („Hospitalizacje 2025”). */
  label: ReactNode;
  value: ReactNode;
  /** Słowo po liczbie w pasku faktów na telefonie („hospitalizacji”); bez niego — sama liczba. */
  unit?: string;
  /** Druga linia boksu (zmiana r/r, porównanie); na telefonie znika — te dane są w zakładkach karty. */
  note?: ReactNode;
}

/**
 * Liczby w nagłówku karty (karta grupy JGP, karta szpitala). Szeroki ekran: boksy 2×2. Telefon: jeden pasek faktów
 * w 1–2 liniach („6871 hospitalizacji · 4,08% zgonów · 200 łóżek”), żeby pierwszy ekran pokazywał zakładki i treść.
 */
export function CardKpis({ label, items }: { label: string; items: CardKpi[] }) {
  return <dl className={tabs.kpis} aria-label={label}>
    {items.map((item, i) => <div key={i}>
      <dt>{item.label}</dt>
      <dd>{item.value}{item.unit ? <em className={tabs.kpiUnit}> {item.unit}</em> : null}</dd>
      {item.note ? <span>{item.note}</span> : null}
    </div>)}
  </dl>;
}
