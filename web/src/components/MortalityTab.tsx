"use client";

import { useMemo } from "react";
import { SegmentedControl } from "@mantine/core";
import { AreaStatsPanel } from "@/components/AreaStatsPanel";
import { KpiStrip } from "@/components/KpiStrip";
import { MortalityChart } from "@/components/MortalityChart";
import type { AxisMode, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";

type MortalityTabProps = {
  reference: ReferencePayload;
  data: MortalityPayload;
  loading: boolean;
  error: string | null;
  selectedProducts: string[];
  axisMode: AxisMode;
  setAxisMode: (value: AxisMode) => void;
  geoMode: GeographyMode;
  highlightedRegions: string[];
  highlightedCities: string[];
};

export function MortalityTab({
  reference,
  data,
  loading,
  error,
  selectedProducts,
  axisMode,
  setAxisMode,
  geoMode,
  highlightedRegions,
  highlightedCities,
}: MortalityTabProps) {
  const productMap = useMemo(() => new Map(reference.products.map((product) => [product.code, product])), [reference.products]);
  const selectedProductDefinitions = useMemo(
    () => reference.products.filter((product) => selectedProducts.includes(product.code)),
    [reference.products, selectedProducts],
  );

  return <>
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
            <MortalityChart
              rows={data.rows}
              axisMode={axisMode}
              geographyMode={geoMode}
              highlightedRegions={highlightedRegions}
              highlightedCities={highlightedCities}
              products={selectedProductDefinitions}
              regions={reference.regions}
            />
          </div>
          <AreaStatsPanel
            geographyMode={geoMode}
            selectedKeys={geoMode === "regions" ? highlightedRegions : highlightedCities}
            groups={geoMode === "regions" ? data.areaStats.regions : data.areaStats.cities}
            baselineGroups={geoMode === "regions" ? data.baselineAreaStats.regions : data.baselineAreaStats.cities}
            products={selectedProductDefinitions}
            hasComparison={data.hasComparison}
          />
        </div> : <div className="empty-chart">{selectedProducts.length === 0 ? "Wybierz co najmniej jeden produkt." : "Brak placówek spełniających wybrane kryteria."}</div>}
      </section>
      <details className="data-details">
        <summary>Tabela danych · wolumen i śmiertelność</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Świadczeniodawca</th><th>NIP</th><th>Produkt</th><th>OW NFZ</th><th>Województwo</th><th>Miasto</th><th>Hospitalizacje</th><th>Zgony</th><th>Śmiertelność</th></tr></thead>
            <tbody>{data.rows.slice(0, 500).map((row) => <tr key={`${row.owNfz}-${row.nip}-${row.productCode}`}><td>{row.providerName}</td><td>{row.nip}</td><td title={productMap.get(row.productCode)?.label}>{row.productCode}</td><td>{row.owNfz}</td><td>{row.voivodeship}</td><td>{row.city}</td><td>{Math.round(row.hospitalizations).toLocaleString("pl-PL")}</td><td>{Math.round(row.deaths).toLocaleString("pl-PL")}</td><td>{row.mortalityPct.toFixed(1)}%</td></tr>)}</tbody>
          </table>
          {data.rows.length > 500 ? <p className="table-note">Podgląd pokazuje pierwsze 500 wierszy.</p> : null}
        </div>
      </details>
    </div>
  </>;
}
