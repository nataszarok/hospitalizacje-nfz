"use client";

import { AreaStatsPanel } from "@/components/AreaStatsPanel";
import { ChartScaleControl } from "@/components/ChartScaleControl";
import { AdmissionChart } from "@/components/AdmissionChart";
import type { AdmissionPayload, AxisMode, GeographyMode, ReferencePayload } from "@/lib/types";

export function AdmissionTab({ reference, data, loading, error, selectedProducts, axisMode, setAxisMode, geoMode, highlightedRegions, highlightedCities }: {
  reference: ReferencePayload;
  data: AdmissionPayload;
  loading: boolean;
  error: string | null;
  selectedProducts: string[];
  axisMode: AxisMode;
  setAxisMode: (value: AxisMode) => void;
  geoMode: GeographyMode;
  highlightedRegions: string[];
  highlightedCities: string[];
}) {
  const selectedAreaKeys = geoMode === "regions" ? highlightedRegions : highlightedCities;
  const productByCode = new Map(reference.products.map((product) => [product.code, product]));

  return <>
    {error ? <div className="alert">{error}</div> : null}
    <div className={loading ? "content loading" : "content"}>
      <section className="chart-section">
        <div className="chart-header">
          <div>
            <h2>Przyjęcia planowane a nagłe</h2>
            <p>Każdy punkt to świadczeniodawca. Oś X pokazuje przyjęcia planowane (kod 6), a oś Y sumę przyjęć nagłych (kody 2 i 3). Przełącznik zmienia jednostkę obu osi.</p>
          </div>
        </div>
        {data.rows.length > 0 ? <div className="analysis-grid">
          <div className="plot-column">
            <div className="plot-toolbar">
              <ChartScaleControl value={axisMode} onChange={setAxisMode} />
            </div>
            <AdmissionChart
              rows={data.rows}
              axisMode={axisMode}
              geographyMode={geoMode}
              highlightedRegions={highlightedRegions}
              highlightedCities={highlightedCities}
              products={reference.products}
              regions={reference.regions}
            />
          </div>
          <AreaStatsPanel
            kind="admissions"
            geographyMode={geoMode}
            selectedKeys={selectedAreaKeys}
            groups={geoMode === "regions" ? data.areaStats.regions : data.areaStats.cities}
          />
        </div> : <div className="empty-chart">{selectedProducts.length === 0 ? "Wybierz co najmniej jeden produkt." : "Brak świadczeniodawców spełniających wybrane kryteria."}</div>}
      </section>
      <details className="data-details">
        <summary>Tabela danych · tryb przyjęcia</summary>
        <div className="table-wrap">
          <table className="admission-table">
            <thead><tr><th>Świadczeniodawca</th><th>NIP</th><th>Kod JGP</th><th>Województwo</th><th>Miasto</th><th>Planowane (6)</th><th>Nagłe (2+3)</th><th>Planowane + nagłe</th></tr></thead>
            <tbody>{data.rows.slice(0, 500).map((row) => <tr key={`${row.owNfz}-${row.nip}-${row.productCode}`}><td title={row.providerName}>{row.providerName}</td><td>{row.nip}</td><td>{productByCode.get(row.productCode)?.jgpCode ?? row.productCode}</td><td title={row.voivodeship}>{row.voivodeship}</td><td title={row.city}>{row.city}</td><td>{Math.round(row.plannedAdmissions).toLocaleString("pl-PL")}</td><td>{Math.round(row.urgentAdmissions).toLocaleString("pl-PL")}</td><td>{Math.round(row.totalAdmissions).toLocaleString("pl-PL")}</td></tr>)}</tbody>
          </table>
          {data.rows.length > 500 ? <p className="table-note">Podgląd pokazuje pierwsze 500 wierszy.</p> : null}
        </div>
      </details>
    </div>
  </>;
}
