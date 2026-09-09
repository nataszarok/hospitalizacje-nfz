"use client";

import { ActionIcon, MultiSelect, NumberInput, SegmentedControl, Select, Tooltip } from "@mantine/core";
import type { Dispatch, SetStateAction } from "react";
import type { EstimationMethod, GeographyMode, ReferencePayload } from "@/lib/types";

type SidebarProps = {
  reference: ReferencePayload;
  selectedProducts: string[];
  setSelectedProducts: Dispatch<SetStateAction<string[]>>;
  durations: string[];
  setDurations: Dispatch<SetStateAction<string[]>>;
  method: EstimationMethod;
  setMethod: Dispatch<SetStateAction<EstimationMethod>>;
  minHosp: number;
  setMinHosp: Dispatch<SetStateAction<number>>;
  geoMode: GeographyMode;
  setGeoMode: Dispatch<SetStateAction<GeographyMode>>;
  highlightedRegions: string[];
  setHighlightedRegions: Dispatch<SetStateAction<string[]>>;
  highlightedCities: string[];
  setHighlightedCities: Dispatch<SetStateAction<string[]>>;
};

export function Sidebar({
  reference,
  selectedProducts,
  setSelectedProducts,
  durations,
  setDurations,
  method,
  setMethod,
  minHosp,
  setMinHosp,
  geoMode,
  setGeoMode,
  highlightedRegions,
  setHighlightedRegions,
  highlightedCities,
  setHighlightedCities,
}: SidebarProps) {
  const highlighted = geoMode === "regions" ? highlightedRegions : highlightedCities;

  return <aside className="sidebar">
    <div className="sidebar-brand">
      <div className="sidebar-brand-mark">H</div>
      <div>
        <div className="sidebar-eyebrow">NFZ · analiza {reference.analysisYear}</div>
        <div className="sidebar-title">Panel analityczny</div>
      </div>
    </div>
    <p className="sidebar-intro">Zawęź zakres analizy i wyróżnij wybrane obszary bez usuwania pozostałych placówek z wykresu.</p>

    <FilterSection title="Zakres świadczeń">
      <LabelWithInfo htmlFor="products" help="">Produkt jednostkowy</LabelWithInfo>
      <div className="field-help">Możesz porównać maksymalnie 5 produktów.</div>
      <MultiSelect
        id="products"
        data={reference.products.map((product) => ({ value: product.code, label: product.label }))}
        value={selectedProducts}
        onChange={(values) => setSelectedProducts(values.slice(0, 5))}
        placeholder="Wybierz produkty"
        searchable
        clearable
        maxValues={5}
        hidePickedOptions
        nothingFoundMessage="Brak wyników"
        comboboxProps={{ withinPortal: true, shadow: "md" }}
        className="mantine-filter"
      />
    </FilterSection>

    <FilterSection title="Wyróżnienie geograficzne">
      <SegmentedControl
        fullWidth
        value={geoMode}
        onChange={(value) => setGeoMode(value as GeographyMode)}
        data={[{ value: "regions", label: "Województwa" }, { value: "cities", label: "Miasta" }]}
        className="mantine-segmented"
      />
      <div className="selection-meta">
        <span>{highlighted.length}/5 wyróżnionych</span>
        {highlighted.length > 0 ? <button onClick={() => geoMode === "regions" ? setHighlightedRegions([]) : setHighlightedCities([])}>Wyczyść</button> : null}
      </div>
      <MultiSelect
        data={geoMode === "regions"
          ? reference.regions.map((region) => ({ value: region.owNfz, label: region.name }))
          : reference.cities.map((city) => ({ value: city, label: city }))}
        value={highlighted}
        onChange={(values) => geoMode === "regions"
          ? setHighlightedRegions(values.slice(0, 5))
          : setHighlightedCities(values.slice(0, 5))}
        placeholder={geoMode === "regions" ? "Wybierz województwa" : "Wybierz miasta"}
        searchable
        clearable
        maxValues={5}
        hidePickedOptions
        nothingFoundMessage="Brak wyników"
        comboboxProps={{ withinPortal: true, shadow: "md" }}
        className="mantine-filter"
      />
    </FilterSection>

    <FilterSection title="Filtry">
      <LabelWithInfo htmlFor="minHosp" help="Próg jest liczony po aktualnych filtrach na poziomie całej placówki, czyli unikalnej pary OW NFZ + NIP. Jeśli wybrano kilka produktów, ich hospitalizacje są najpierw sumowane dla placówki. Próg wpływa na punkty, tabele i główne statystyki. Dla porównania aplikacja nadal pokazuje wartości bez tego progu.">Minimalna liczba hospitalizacji na placówkę</LabelWithInfo>
      <NumberInput
        id="minHosp"
        min={0}
        step={10}
        value={minHosp}
        onChange={(value) => setMinHosp(Math.max(0, Number(value) || 0))}
        allowDecimal={false}
        clampBehavior="strict"
        className="mantine-filter"
      />
      <LabelWithInfo htmlFor="durations" help="">Przedział długości hospitalizacji</LabelWithInfo>
      <MultiSelect
        id="durations"
        data={reference.durations}
        value={durations}
        onChange={setDurations}
        placeholder="Wszystkie przedziały"
        clearable
        comboboxProps={{ withinPortal: true, shadow: "md" }}
        className="mantine-filter"
      />
    </FilterSection>

    <FilterSection title="Estymacja wartości ukrytych" last>
      <LabelWithInfo htmlFor="method" help="">Wartości &lt;5</LabelWithInfo>
      <Select
        id="method"
        value={method}
        onChange={(value) => value && setMethod(value as EstimationMethod)}
        data={[
          { value: "sim", label: "Symulacyjna: losowanie 1–4" },
          { value: "min", label: "Konserwatywna: każde <5 = 1" },
        ]}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, shadow: "md" }}
        className="mantine-filter"
      />
    </FilterSection>
    <div className="sidebar-status"><span className="status-dot" />Dane analityczne · PostgreSQL</div>
  </aside>;
}

function InfoTip({ label }: { label: string }) {
  return <Tooltip label={label} multiline w={310} withArrow position="right" openDelay={180}>
    <ActionIcon variant="subtle" color="gray" size="xs" radius="xl" aria-label="Informacja"><span className="info-icon">?</span></ActionIcon>
  </Tooltip>;
}

function LabelWithInfo({ children, help, htmlFor }: { children: React.ReactNode; help: string; htmlFor?: string }) {
  return <div className="field-label-row">
    <label className="field-label" htmlFor={htmlFor}>{children}</label>
    <InfoTip label={help} />
  </div>;
}

function FilterSection({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return <section className={last ? "filter-section last" : "filter-section"}><div className="sidebar-kicker">{title}</div>{children}</section>;
}
