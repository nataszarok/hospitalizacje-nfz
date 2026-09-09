"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionIcon, MultiSelect, NumberInput, SegmentedControl, Select, Tooltip } from "@mantine/core";
import { AreaStatsPanel } from "@/components/AreaStatsPanel";
import { KpiStrip } from "@/components/KpiStrip";
import { MortalityChart } from "@/components/MortalityChart";
import type { AxisMode, EstimationMethod, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";

const EMPTY_KPI = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const EMPTY_GEO_STATS = { regions: [], cities: [] };

function toggleLimited(current: string[], value: string, max = 5) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  return current.length < max ? [...current, value] : current;
}

export function Dashboard() {
  const [reference, setReference] = useState<ReferencePayload | null>(null);
  const [data, setData] = useState<MortalityPayload>({ rows: [], current: EMPTY_KPI, baseline: EMPTY_KPI, hasComparison: false, areaStats: EMPTY_GEO_STATS, baselineAreaStats: EMPTY_GEO_STATS });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [durations, setDurations] = useState<string[]>([]);
  const [method, setMethod] = useState<EstimationMethod>("min");
  const [minHosp, setMinHosp] = useState(0);
  const [axisMode, setAxisMode] = useState<AxisMode>("total");
  const [geoMode, setGeoMode] = useState<GeographyMode>("regions");
  const [highlightedRegions, setHighlightedRegions] = useState<string[]>([]);
  const [highlightedCities, setHighlightedCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/reference", { cache: "no-store" });
        if (!response.ok) throw new Error("Nie udało się pobrać słowników.");
        const payload = await response.json() as ReferencePayload;
        setReference(payload);
        setSelectedProducts(payload.defaultProductCode ? [payload.defaultProductCode] : payload.products.slice(0, 1).map((p) => p.code));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd inicjalizacji aplikacji.");
        setLoading(false);
      }
    };
    void load();
  }, []);

  const reload = useCallback(async () => {
    if (selectedProducts.length === 0) {
      setData({ rows: [], current: EMPTY_KPI, baseline: EMPTY_KPI, hasComparison: false, areaStats: EMPTY_GEO_STATS, baselineAreaStats: EMPTY_GEO_STATS });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        products: selectedProducts.join(","),
        durations: durations.join(","),
        method,
        minHosp: String(minHosp),
      });
      const response = await fetch(`/api/mortality?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Nie udało się pobrać danych analizy.");
      setData(await response.json() as MortalityPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania danych.");
    } finally {
      setLoading(false);
    }
  }, [selectedProducts, durations, method, minHosp]);

  useEffect(() => { if (reference) void reload(); }, [reference, reload]);

  const productMap = useMemo(() => new Map(reference?.products.map((p) => [p.code, p]) ?? []), [reference]);

  if (!reference && loading) return <main className="center-state">Ładowanie aplikacji…</main>;
  if (!reference) return <main className="center-state error">{error ?? "Brak konfiguracji."}</main>;

  return <div className="app-shell">
    <aside className="sidebar">
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
          <span>{(geoMode === "regions" ? highlightedRegions : highlightedCities).length}/5 wyróżnionych</span>
          {(geoMode === "regions" ? highlightedRegions : highlightedCities).length > 0 ? <button onClick={() => geoMode === "regions" ? setHighlightedRegions([]) : setHighlightedCities([])}>Wyczyść</button> : null}
        </div>
        <MultiSelect
          data={geoMode === "regions"
            ? reference.regions.map((region) => ({ value: region.owNfz, label: region.name }))
            : reference.cities.map((city) => ({ value: city, label: city }))}
          value={geoMode === "regions" ? highlightedRegions : highlightedCities}
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
    </aside>

    <main className="main">
      <header className="page-header">
        <h1>Hospitalizacje w Polsce</h1>
        <p>Analiza wolumenu, śmiertelności i trybu przyjęcia · NFZ {reference.analysisYear}</p>
      </header>
      <nav className="tabs" aria-label="Główna nawigacja">
        <button className="active">Wolumen i śmiertelność</button>
        <button disabled title="Następny etap migracji">Tryb przyjęcia</button>
        <button disabled title="Następny etap migracji">Metodologia i dane</button>
      </nav>

      {error ? <div className="alert">{error}</div> : null}
      <div className={loading ? "content loading" : "content"}>
        <KpiStrip current={data.current} baseline={data.baseline} compare={data.hasComparison} />
        <section className="chart-section">
          <div className="chart-header">
            <div><h2>Śmiertelność a wolumen</h2><p>Każdy punkt to placówka; wyróżnione obszary pozostają na tle pozostałych placówek.</p></div>

          </div>
          {data.rows.length > 0 ? <div className="analysis-grid">
            <div className="plot-column">
              <div className="plot-toolbar">
                <SegmentedControl
                  value={axisMode}
                  onChange={(value) => setAxisMode(value as AxisMode)}
                  data={[
                    { value: "total", label: "Liczba hospitalizacji" },
                    { value: "per_100k", label: "Na 100 tys. mieszk." },
                  ]}
                  className="axis-segmented"
                />
              </div>
              <MortalityChart rows={data.rows} axisMode={axisMode} geographyMode={geoMode} highlightedRegions={highlightedRegions} highlightedCities={highlightedCities} products={reference.products.filter((p) => selectedProducts.includes(p.code))} regions={reference.regions} />
            </div>
            <AreaStatsPanel
              geographyMode={geoMode}
              selectedKeys={geoMode === "regions" ? highlightedRegions : highlightedCities}
              groups={geoMode === "regions" ? data.areaStats.regions : data.areaStats.cities}
              baselineGroups={geoMode === "regions" ? data.baselineAreaStats.regions : data.baselineAreaStats.cities}
              products={reference.products.filter((p) => selectedProducts.includes(p.code))}
              hasComparison={data.hasComparison}
            />
          </div> : <div className="empty-chart">{selectedProducts.length === 0 ? "Wybierz co najmniej jeden produkt." : "Brak placówek spełniających wybrane kryteria."}</div>}
        </section>
        <details className="data-details"><summary>Tabela danych · wolumen i śmiertelność</summary><div className="table-wrap"><table><thead><tr><th>Świadczeniodawca</th><th>NIP</th><th>Produkt</th><th>OW NFZ</th><th>Województwo</th><th>Miasto</th><th>Hospitalizacje</th><th>Zgony</th><th>Śmiertelność</th></tr></thead><tbody>{data.rows.slice(0, 500).map((row) => <tr key={`${row.owNfz}-${row.nip}-${row.productCode}`}><td>{row.providerName}</td><td>{row.nip}</td><td title={productMap.get(row.productCode)?.label}>{row.productCode}</td><td>{row.owNfz}</td><td>{row.voivodeship}</td><td>{row.city}</td><td>{Math.round(row.hospitalizations).toLocaleString("pl-PL")}</td><td>{Math.round(row.deaths).toLocaleString("pl-PL")}</td><td>{row.mortalityPct.toFixed(1)}%</td></tr>)}</tbody></table>{data.rows.length > 500 ? <p className="table-note">Podgląd pokazuje pierwsze 500 wierszy.</p> : null}</div></details>
      </div>
    </main>
  </div>;
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
