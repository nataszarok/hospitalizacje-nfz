"use client";

import { MultiSelect, NumberInput, SegmentedControl, Select } from "@mantine/core";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { areaFromValue, areaToValue, type AnalysisArea } from "@/lib/area";
import type { DashboardActiveTab } from "@/lib/dashboardUrlState";
import { formatCityName } from "@/lib/formatters";
import type { EstimationMethod, GeographyMode, ReferencePayload } from "@/lib/types";
import styles from "./Explorer.module.css";

export type ExplorerContextBarProps = {
  view: DashboardActiveTab;
  reference: ReferencePayload;
  years: string[];
  year: string;
  setYear: (year: string) => void;
  selectedProducts: string[];
  setSelectedProducts: Dispatch<SetStateAction<string[]>>;
  area: AnalysisArea;
  setArea: (area: AnalysisArea) => void;
  method: EstimationMethod;
  setMethod: Dispatch<SetStateAction<EstimationMethod>>;
  minHosp: number;
  setMinHosp: Dispatch<SetStateAction<number>>;
  durations: string[];
  setDurations: Dispatch<SetStateAction<string[]>>;
  geoMode: GeographyMode;
  setGeoMode: Dispatch<SetStateAction<GeographyMode>>;
  highlightedRegions: string[];
  setHighlightedRegions: Dispatch<SetStateAction<string[]>>;
  highlightedCities: string[];
  setHighlightedCities: Dispatch<SetStateAction<string[]>>;
};

const MAX_PRODUCTS = 10;

/**
 * Wspólny kontekst eksploratora: zakres JGP i okres na górze, ustawienia zaawansowane w „Więcej filtrów”.
 * Pokazuje tylko ustawienia, które mają znaczenie w bieżącym widoku.
 */
export function ExplorerContextBar(props: ExplorerContextBarProps) {
  const { view, reference, years, year, setYear, selectedProducts, setSelectedProducts } = props;
  const [open, setOpen] = useState(false);
  const allYears = view === "trend";
  // Filtry placówek i wyróżnienia dotyczą tylko widoków opartych na świadczeniodawcach.
  const providerFilters = view === "mortality" || view === "admissions";
  const activeFilters = (props.method !== "min" ? 1 : 0)
    + (providerFilters ? (props.minHosp > 0 ? 1 : 0) + (props.durations.length ? 1 : 0) + (props.highlightedRegions.length || props.highlightedCities.length ? 1 : 0) : 0);

  return <section className={styles.contextBar} aria-label="Zakres analizy">
    <div className={styles.contextRow}>
      <div className={styles.contextField}>
        <label className={styles.contextLabel} htmlFor="products">Zakres JGP</label>
        <MultiSelect
          id="products"
          data={reference.products.map((product) => ({ value: product.code, label: product.label }))}
          value={selectedProducts}
          onChange={(values) => setSelectedProducts(values.slice(0, MAX_PRODUCTS))}
          placeholder={selectedProducts.length ? undefined : "Wpisz kod lub nazwę grupy"}
          searchable
          clearable
          maxValues={MAX_PRODUCTS}
          hidePickedOptions
          nothingFoundMessage="Brak wyników"
          comboboxProps={{ withinPortal: true, shadow: "md" }}
          className="mantine-filter"
        />
      </div>

      <div className={styles.contextFieldArea}>
        <label className={styles.contextLabel} htmlFor="area">Obszar</label>
        <Select
          id="area"
          value={areaToValue(props.area)}
          onChange={(value) => props.setArea(areaFromValue(value))}
          data={[
            { group: "Kraj", items: [{ value: "pl", label: "Cała Polska" }] },
            { group: "Województwa", items: reference.regions.map((region) => ({ value: `ow:${region.owNfz}`, label: region.name })) },
            { group: "Miasta", items: reference.cities.map((city) => ({ value: `c:${city}`, label: formatCityName(city) })) },
          ]}
          searchable
          allowDeselect={false}
          nothingFoundMessage="Brak wyników"
          comboboxProps={{ withinPortal: true, shadow: "md" }}
          className="mantine-filter"
        />
      </div>

      <div className={styles.contextFieldNarrow}>
        <label className={styles.contextLabel} htmlFor="year">Okres</label>
        {allYears || years.length < 2
          ? <div id="year" className={styles.contextStatic}>{allYears && years.length > 1 ? `${years[0]}–${years.at(-1)}` : year}</div>
          : <Select
            id="year"
            value={year}
            onChange={(value) => value && setYear(value)}
            data={[...years].reverse()}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true, shadow: "md" }}
            className="mantine-filter"
          />}
      </div>

      <button type="button" className={styles.moreButton} aria-expanded={open} aria-controls="explorer-more-filters" onClick={() => setOpen((value) => !value)}>
        Więcej filtrów{activeFilters ? ` (${activeFilters})` : ""} <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
    </div>
    {allYears ? <p className={styles.contextHint}>Widok „W czasie” obejmuje wszystkie lata. Lista grup JGP pochodzi z katalogu roku {year}.</p> : null}

    {open ? <div id="explorer-more-filters" className={styles.moreFilters}>
      <Field label="Wartości <5" htmlFor="method" help="Dane źródłowe ukrywają małe liczby. Konserwatywna: każde <5 = 1. Symulacyjna: wartości 1–4 losowane z rozkładu, w którym mniejsze są bardziej prawdopodobne.">
        <Select
          id="method"
          value={props.method}
          onChange={(value) => value && props.setMethod(value as EstimationMethod)}
          data={[
            { value: "min", label: "Konserwatywna: każde <5 = 1" },
            { value: "sim", label: "Symulacyjna: losowanie 1–4" },
          ]}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, shadow: "md" }}
          className="mantine-filter"
        />
      </Field>

      {providerFilters ? <>
        <Field label="Minimalna liczba hospitalizacji na świadczeniodawcę" htmlFor="minHosp">
          <NumberInput
            id="minHosp"
            min={0}
            step={10}
            value={props.minHosp}
            onChange={(value) => props.setMinHosp(Math.max(0, Number(value) || 0))}
            allowDecimal={false}
            clampBehavior="strict"
            className="mantine-filter"
          />
        </Field>
        <Field label="Długość pobytu" htmlFor="durations">
          <MultiSelect
            id="durations"
            data={reference.durations}
            value={props.durations}
            onChange={props.setDurations}
            placeholder="Wszystkie przedziały"
            clearable
            comboboxProps={{ withinPortal: true, shadow: "md" }}
            className="mantine-filter"
          />
        </Field>
        <Field label="Wyróżnij na wykresie" htmlFor="highlight">
          <SegmentedControl
            fullWidth
            value={props.geoMode}
            onChange={(value) => props.setGeoMode(value as GeographyMode)}
            data={[{ value: "regions", label: "Województwa" }, { value: "cities", label: "Miasta" }]}
            className="mantine-segmented"
          />
          <MultiSelect
            id="highlight"
            data={props.geoMode === "regions"
              ? reference.regions.map((region) => ({ value: region.owNfz, label: region.name }))
              : reference.cities.map((city) => ({ value: city, label: formatCityName(city) }))}
            value={props.geoMode === "regions" ? props.highlightedRegions : props.highlightedCities}
            onChange={(values) => props.geoMode === "regions"
              ? props.setHighlightedRegions(values.slice(0, 10))
              : props.setHighlightedCities(values.slice(0, 10))}
            placeholder={props.geoMode === "regions" ? "Wybierz województwa" : "Wybierz miasta"}
            searchable
            clearable
            maxValues={10}
            hidePickedOptions
            nothingFoundMessage="Brak wyników"
            comboboxProps={{ withinPortal: true, shadow: "md" }}
            className="mantine-filter"
          />
        </Field>
      </> : null}
    </div> : null}
  </section>;
}

function Field({ label, htmlFor, help, children }: { label: string; htmlFor: string; help?: string; children: ReactNode }) {
  return <div className={styles.moreField}>
    <label className={styles.contextLabel} htmlFor={htmlFor}>{label}</label>
    {help ? <div className={styles.fieldHelp}>{help}</div> : null}
    {children}
  </div>;
}
