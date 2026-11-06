"use client";

import { MultiSelect, Select } from "@mantine/core";
import { useCallback, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { InfoTip } from "@/components/InfoTip";
import { YearPlayer } from "@/components/YearPlayer";
import { areasFromValues, areasToValues, MAX_AREAS, type AnalysisArea } from "@/lib/area";
import type { DashboardActiveTab } from "@/lib/dashboardUrlState";
import { formatCityName, formatJgpName } from "@/lib/formatters";
import type { ProductOption, ReferencePayload } from "@/lib/types";
import styles from "./Explorer.module.css";

export type ExplorerSidebarProps = {
  view: DashboardActiveTab;
  reference: ReferencePayload;
  years: string[];
  year: string;
  setYear: (year: string) => void;
  selectedProducts: string[];
  setSelectedProducts: Dispatch<SetStateAction<string[]>>;
  /** Opisy grup z innych lat (wybrana grupa może nie występować w katalogu bieżącego roku). */
  knownProducts?: ProductOption[];
  /** Obszary analizy (do 5, suma); pusta lista = cała Polska. */
  areas: AnalysisArea[];
  setAreas: (areas: AnalysisArea[]) => void;
  durations: string[];
  setDurations: Dispatch<SetStateAction<string[]>>;
};

const MAX_PRODUCTS = 10;
const COMBOBOX = { withinPortal: true, shadow: "md" } as const;

/**
 * Panel ustawień eksploratora (lewa kolumna): zakres analizy i filtry świadczeniodawców.
 * Zwarty: objaśnienia pól są pod ikoną „?”. Pokazuje tylko ustawienia, które mają znaczenie w bieżącym widoku.
 */
export function ExplorerSidebar(props: ExplorerSidebarProps) {
  const { view, reference, years, year, setYear, selectedProducts, setSelectedProducts } = props;
  // „W czasie” obejmuje wszystkie lata, więc wybór roku ma sens tylko w pozostałych widokach.
  const showYear = view !== "trend";
  // „Gdzie”: rok jako oś czasu z odtwarzaniem (mapa w kolejnych latach), w pozostałych widokach — lista lat.
  const onYearIndex = useCallback((index: number) => setYear(years[index]), [setYear, years]);
  // Długość pobytu: filtr widoku, w którym go ustawiono (W czasie, Kto leczy, Tryb przyjęcia; nie Gdzie).
  const durationFilter = view !== "regions";

  return <div className={styles.sidebarInner} role="region" aria-label="Ustawienia analizy">
    <Section title="Zakres analizy">
      <Field label="Grupy JGP" htmlFor="products" meta={`${selectedProducts.length}/${MAX_PRODUCTS}`} help={`Wybierz od 1 do 10 grup. Wyniki są liczone łącznie dla wszystkich wybranych grup. Lista grup pochodzi z katalogu roku ${year}.`}>
        <ProductPicker reference={reference} known={props.knownProducts} selected={selectedProducts} setSelected={setSelectedProducts} />
      </Field>

      <Field label="Obszar" htmlFor="area" meta={`${props.areas.length}/${MAX_AREAS}`} help="Do 5 województw lub miast naraz; liczby to ich suma. Województwo to oddział NFZ, miasto to siedziba świadczeniodawcy. W widokach Kto leczy i Tryb przyjęcia wykres pokazuje wszystkich świadczeniodawców, a obszary wyróżnia kolorami; liczby nad wykresem dotyczą obszarów.">
        <MultiSelect
          id="area"
          value={areasToValues(props.areas)}
          onChange={(values) => props.setAreas(areasFromValues(values))}
          data={[
            { group: "Województwa", items: reference.regions.map((region) => ({ value: `ow:${region.owNfz}`, label: region.name })) },
            { group: "Miasta", items: reference.cities.map((city) => ({ value: `c:${city}`, label: formatCityName(city) })) },
          ]}
          placeholder={props.areas.length ? undefined : "Cała Polska"}
          searchable
          clearable
          maxValues={MAX_AREAS}
          hidePickedOptions
          nothingFoundMessage="Brak wyników"
          comboboxProps={COMBOBOX}
          className="mantine-filter"
        />
      </Field>

      {showYear ? <Field label="Rok" htmlFor="year" help={view === "regions" ? "Przycisk odtwarzania pokazuje mapę w kolejnych latach; liczby nad mapą zmieniają się razem z nią." : undefined}>
        {years.length < 2
          ? <div id="year" className={styles.staticValue}>{year}</div>
          : view === "regions"
            ? <div id="year"><YearPlayer years={years} index={Math.max(0, years.indexOf(year))} onIndex={onYearIndex} compact /></div>
            : <Select
              id="year"
              value={year}
              onChange={(value) => value && setYear(value)}
              data={[...years].reverse()}
              allowDeselect={false}
              comboboxProps={COMBOBOX}
              className="mantine-filter"
            />}
      </Field> : null}
    </Section>

    {durationFilter ? <Section title="Filtry">
      <Field label="Długość pobytu" htmlFor="durations" help="Tylko hospitalizacje z wybranych przedziałów długości pobytu. Bez wyboru: wszystkie. Filtr działa tylko w bieżącym widoku. W widoku W czasie pokazuje lata (dane miesięczne nie mają podziału na długość pobytu).">
        <MultiSelect
          id="durations"
          data={reference.durations}
          value={props.durations}
          onChange={props.setDurations}
          placeholder="Wszystkie przedziały"
          clearable
          comboboxProps={COMBOBOX}
          className="mantine-filter"
        />
      </Field>
    </Section> : null}

  </div>;
}

/**
 * Wybór grup JGP: pole wyszukiwania dodaje grupę, wybrane grupy są listą pod nim (kod i pełna nazwa, przycisk usuwania).
 * Lista zamiast „pigułek” w polu: długie nazwy grup się zawijają, a pole nie rośnie o pustą linię.
 */
function ProductPicker({ reference, known = [], selected, setSelected }: { reference: ReferencePayload; known?: ProductOption[]; selected: string[]; setSelected: Dispatch<SetStateAction<string[]>> }) {
  const [search, setSearch] = useState("");
  const chosen = new Set(selected);
  const products = new Map([...known, ...reference.products].map((product) => [product.code, product]));
  const full = selected.length >= MAX_PRODUCTS;

  return <div className={styles.picker}>
    <Select
      id="products"
      value={null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(code) => {
        if (code) setSelected((current) => current.includes(code) ? current : [...current, code].slice(0, MAX_PRODUCTS));
        setSearch("");
      }}
      data={reference.products.filter((product) => !chosen.has(product.code)).map((product) => ({ value: product.code, label: product.label }))}
      placeholder={full ? "Wybrano 10 grup" : selected.length ? "Dodaj grupę: kod lub nazwa" : "Wpisz kod lub nazwę grupy"}
      disabled={full}
      searchable
      // Enter dodaje pierwszą pasującą grupę (bez wybierania strzałkami).
      selectFirstOptionOnChange
      limit={50}
      nothingFoundMessage="Brak wyników"
      comboboxProps={COMBOBOX}
      className="mantine-filter"
    />
    {selected.length ? <ul className={styles.pickedList} aria-label="Wybrane grupy JGP">
      {selected.map((code) => {
        const product = products.get(code);
        const jgp = product?.jgpCode ?? code;
        const name = product?.name ? formatJgpName(product.name) : product?.label ?? code;
        return <li key={code} className={styles.picked}>
          <span className={styles.pickedCode}>{jgp}</span>
          <span className={styles.pickedName} title={name}>{name}</span>
          <button type="button" className={styles.pickedRemove} aria-label={`Usuń ${jgp}`} onClick={() => setSelected((current) => current.filter((value) => value !== code))}>×</button>
        </li>;
      })}
    </ul> : null}
    {selected.length >= 2 ? <button type="button" className={styles.pickedClear} onClick={() => setSelected([])}>Usuń wszystkie</button> : null}
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.sidebarSection}>
    <h2 className={styles.sidebarKicker}>{title}</h2>
    {children}
  </section>;
}

function Field({ label, htmlFor, meta, help, children }: { label: string; htmlFor: string; meta?: string; help?: string; children: ReactNode }) {
  return <div className={styles.field}>
    <div className={styles.fieldLabelRow}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>{label}</label>
      {help ? <InfoTip label={help} ariaLabel={`Objaśnienie: ${label}`} /> : null}
      {meta ? <span className={styles.fieldMeta}>{meta}</span> : null}
    </div>
    {children}
  </div>;
}
