"use client";

import { Select } from "@mantine/core";
import { useMemo, useState } from "react";
import type { ChartBand, ChartMarker } from "@/components/jgp/GroupLineChart";
import { ArticleLineChart } from "./ArticleLineChart";
import styles from "./H55FacilityPicker.module.css";

/** Placówka do wyboru: szereg miesięczny H55, okresy objęte kontrolami i starty kontroli, krótki opis pod wykresem. */
export interface PickerFacility {
  key: string;
  /** Podpis na liście i w legendzie: miejscowość (albo krótka nazwa kontroli). */
  label: string;
  /** Pełna nazwa placówki. */
  name: string;
  values: number[];
  bands: ChartBand[];
  markers: ChartMarker[];
  /** Fakty nad wykresem (etykieta i wartość), np. poradnia neurochirurgiczna, pacjenci z termolezją w latach. */
  facts: { label: string; value: string }[];
}

/**
 * Wykres H55 dowolnej placówki: wyszukiwarka nad wykresem (Mantine `Select`, jak wybór szpitala w porównaniach),
 * wykres miesięcy z kart JGP z pasmem okresu objętego kontrolą i linią startu kontroli (gdy placówka ją miała).
 * Oś: wszystkie miesiące danych, widok na start — lata (długi okres).
 */
export function H55FacilityPicker({ months, facilities, initialKey, caption }: {
  months: string[];
  facilities: PickerFacility[];
  initialKey: string;
  caption: string;
}) {
  const [key, setKey] = useState(initialKey);
  const facility = facilities.find((item) => item.key === key) ?? facilities[0];
  const options = useMemo(() => facilities.map((item) => ({ value: item.key, label: `${item.label} · ${item.name}` })), [facilities]);
  const lines = useMemo(() => [{ key: facility.key, name: facility.label, detail: facility.name, values: facility.values, tone: "selected" as const, activeOnly: true }], [facility]);
  return <div className={styles.picker}>
    <Select
      label="Placówka"
      searchable
      value={facility.key}
      onChange={(value) => { if (value) setKey(value); }}
      data={options}
      placeholder="Wpisz miejscowość lub nazwę"
      nothingFoundMessage="Brak wyników"
      allowDeselect={false}
      comboboxProps={{ withinPortal: true, shadow: "md" }}
      className="mantine-filter"
    />
    {facility.facts.length ? <dl className={styles.facts} aria-label={`Placówka: ${facility.name}`}>
      {facility.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
    </dl> : null}
    <ArticleLineChart
      key={facility.key}
      title={`Ile hospitalizacji H55 rozliczyła placówka: ${facility.label}?`}
      caption={caption}
      months={months}
      lines={lines}
      valueLabel="hosp."
      ariaLabel={`Hospitalizacje H55 w miesiącach: ${facility.name}`}
      bands={facility.bands}
      markers={facility.markers}
      initialPeriod="month"
      legend={false}
    />
  </div>;
}
