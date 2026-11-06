"use client";

import { Select } from "@mantine/core";
import { useCallback, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { InfoTip } from "@/components/InfoTip";
import { YearPlayer } from "@/components/YearPlayer";
import { areaLabel, areasFromValues, areasToValues, MAX_AREAS, type AnalysisArea } from "@/lib/area";
import { REGION_PICK_COLORS } from "@/lib/chartPalette";
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
        <ListPicker
          id="area"
          selected={areasToValues(props.areas)}
          onChange={(values) => props.setAreas(areasFromValues(values))}
          data={[
            { group: "Województwa", items: reference.regions.map((region) => ({ value: `ow:${region.owNfz}`, label: region.name })) },
            { group: "Miasta", items: reference.cities.map((city) => ({ value: `c:${city}`, label: formatCityName(city) })) },
          ]}
          max={MAX_AREAS}
          placeholder={(count) => count >= MAX_AREAS ? `Wybrano ${MAX_AREAS} obszarów` : count ? "Dodaj województwo lub miasto" : "Cała Polska: wpisz województwo lub miasto"}
          listLabel="Wybrane obszary"
          // Kolor obszaru jak na wykresach i mapie (pozycja na liście).
          lead={(_value, index) => <i className={styles.pickedSwatch} style={{ background: REGION_PICK_COLORS[index % REGION_PICK_COLORS.length] }} aria-hidden />}
          label={(value) => {
            const area = areasFromValues([value])[0];
            return area ? areaLabel(area, reference) : value;
          }}
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
        <ListPicker
          id="durations"
          selected={props.durations}
          onChange={props.setDurations}
          data={reference.durations.map((value) => ({ value, label: value }))}
          placeholder={(count) => count ? "Dodaj przedział" : "Wszystkie przedziały"}
          listLabel="Wybrane przedziały długości pobytu"
          label={(value) => value}
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
  const products = new Map([...known, ...reference.products].map((product) => [product.code, product]));
  const jgpOf = (code: string) => products.get(code)?.jgpCode ?? code;
  return <ListPicker
    id="products"
    selected={selected}
    onChange={setSelected}
    data={reference.products.map((product) => ({ value: product.code, label: product.label }))}
    max={MAX_PRODUCTS}
    placeholder={(count) => count >= MAX_PRODUCTS ? "Wybrano 10 grup" : count ? "Dodaj grupę: kod lub nazwa" : "Wpisz kod lub nazwę grupy"}
    listLabel="Wybrane grupy JGP"
    limit={50}
    lead={(code) => <span className={styles.pickedCode}>{jgpOf(code)}</span>}
    label={(code) => {
      const product = products.get(code);
      return product?.name ? formatJgpName(product.name) : product?.label ?? code;
    }}
    removeLabel={(code) => `Usuń ${jgpOf(code)}`}
  />;
}

type PickerOption = { value: string; label: string };

/**
 * Pole wyszukiwania i lista wybranych pozycji pod nim (wspólny wzór pól panelu: grupy JGP, obszar, długość pobytu).
 * Wybrana pozycja znika z podpowiedzi; Enter dodaje pierwszą pasującą. Lista nie zostawia pustego miejsca w polu.
 */
function ListPicker({ id, selected, onChange, data, max, placeholder, listLabel, limit, lead, label, detail, removeLabel }: {
  id: string;
  selected: string[];
  onChange: (values: string[]) => void;
  data: PickerOption[] | { group: string; items: PickerOption[] }[];
  max?: number;
  placeholder: (count: number) => string;
  listLabel: string;
  limit?: number;
  lead?: (value: string, index: number) => ReactNode;
  label: (value: string) => string;
  detail?: (value: string) => string;
  removeLabel?: (value: string) => string;
}) {
  const [search, setSearch] = useState("");
  const chosen = new Set(selected);
  const full = max !== undefined && selected.length >= max;
  const available = data.map((item) => "group" in item
    ? { group: item.group, items: item.items.filter((option) => !chosen.has(option.value)) }
    : item).filter((item) => "group" in item ? item.items.length > 0 : !chosen.has(item.value));

  return <div className={styles.picker}>
    <Select
      id={id}
      value={null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(value) => {
        if (value && !chosen.has(value)) onChange([...selected, value].slice(0, max));
        setSearch("");
      }}
      data={available}
      placeholder={placeholder(selected.length)}
      disabled={full}
      searchable
      // Enter dodaje pierwszą pasującą pozycję (bez wybierania strzałkami).
      selectFirstOptionOnChange
      limit={limit}
      nothingFoundMessage="Brak wyników"
      comboboxProps={COMBOBOX}
      className="mantine-filter"
    />
    {selected.length ? <ul className={styles.pickedList} aria-label={listLabel}>
      {selected.map((value, index) => {
        const name = label(value);
        return <li key={value} className={`${styles.picked} ${lead ? "" : styles.pickedPlain}`}>
          {lead ? lead(value, index) : null}
          <span className={styles.pickedName} title={name}>{name}{detail ? <small className={styles.pickedDetail}> · {detail(value)}</small> : null}</span>
          <button type="button" className={styles.pickedRemove} aria-label={removeLabel ? removeLabel(value) : `Usuń ${name}`} onClick={() => onChange(selected.filter((item) => item !== value))}>×</button>
        </li>;
      })}
    </ul> : null}
    {selected.length >= 2 ? <button type="button" className={styles.pickedClear} onClick={() => onChange([])}>Usuń wszystkie</button> : null}
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
