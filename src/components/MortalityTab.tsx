"use client";

import { useMemo, useState } from "react";
import { AreaStatsPopover } from "@/components/AreaStatsPopover";
import { ChartScaleControl } from "@/components/ChartScaleControl";
import { MortalityChart } from "@/components/MortalityChart";
import { MortalityDisplayControl } from "@/components/MortalityDisplayControl";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { formatCityName } from "@/lib/formatters";
import {
  aggregateMortalityRowsByProvider,
  mortalityRowsPerJgp,
  type MortalityDisplayMode,
} from "@/lib/mortality";
import { nextSortState, sortTableRows, type SortState } from "@/lib/tableSort";
import type { AxisMode, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";
import styles from "./MortalityTab.module.css";

type MortalitySortKey =
  | "providerName"
  | "nip"
  | "jgp"
  | "voivodeship"
  | "city"
  | "hospitalizations"
  | "deaths"
  | "mortalityPct";

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
  displayMode: MortalityDisplayMode;
  setDisplayMode: (value: MortalityDisplayMode) => void;
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
  displayMode,
  setDisplayMode,
}: MortalityTabProps) {
  const [sortState, setSortState] = useState<SortState<MortalitySortKey>>(null);
  const canGroupJgp = selectedProducts.length >= 2;
  const effectiveDisplayMode: MortalityDisplayMode = canGroupJgp ? displayMode : "combined";

  const productMap = useMemo(
    () => new Map(reference.products.map((product) => [product.code, product])),
    [reference.products],
  );

  const selectedProductDefinitions = useMemo(
    () => reference.products.filter((product) => selectedProducts.includes(product.code)),
    [reference.products, selectedProducts],
  );

  const tableRows = useMemo(
    () => effectiveDisplayMode === "combined"
      ? aggregateMortalityRowsByProvider(data.rows)
      : mortalityRowsPerJgp(data.rows),
    [data.rows, effectiveDisplayMode],
  );

  const sortedTableRows = useMemo(() => {
    if (!sortState) return tableRows;

    return sortTableRows(tableRows, sortState.direction, (row) => {
      switch (sortState.key) {
        case "providerName": return row.providerName;
        case "nip": return row.nip;
        case "jgp":
          return row.productCodes
            .map((code) => productMap.get(code)?.jgpCode ?? code)
            .join(", ");
        case "voivodeship": return row.voivodeship;
        case "city": return formatCityName(row.city);
        case "hospitalizations": return row.hospitalizations;
        case "deaths": return row.deaths;
        case "mortalityPct": return row.mortalityPct;
      }
    });
  }, [productMap, sortState, tableRows]);

  const sortBy = (key: MortalitySortKey) => {
    setSortState((current) => nextSortState(current, key));
  };

  return <>
    {error ? <div className="alert">{error}</div> : null}
    <div className={loading ? "content loading" : "content"}>
      <section className="chart-section">
        <div className="chart-header">
          <div>
            <h2>Liczba hospitalizacji a śmiertelność</h2>
            <p>Każdy punkt to świadczeniodawca.
          </div>
        </div>

        {data.rows.length > 0 ? (
          <div className="plot-column">
            <div className={`plot-toolbar ${styles.toolbar}`}>
              {canGroupJgp ? (
                <MortalityDisplayControl value={displayMode} onChange={setDisplayMode} />
              ) : null}

              <div className={styles.presentationControls}>
                <ChartScaleControl value={axisMode} onChange={setAxisMode} />
                <AreaStatsPopover
                  kind="mortality"
                  geographyMode={geoMode}
                  selectedKeys={geoMode === "regions" ? highlightedRegions : highlightedCities}
                  groups={geoMode === "regions" ? data.areaStats.regions : data.areaStats.cities}
                  baselineGroups={geoMode === "regions" ? data.baselineAreaStats.regions : data.baselineAreaStats.cities}
                  products={selectedProductDefinitions}
                  hasComparison={data.hasComparison}
                  displayMode={effectiveDisplayMode}
                />
              </div>
            </div>

            <MortalityChart
              rows={data.rows}
              axisMode={axisMode}
              displayMode={effectiveDisplayMode}
              geographyMode={geoMode}
              highlightedRegions={highlightedRegions}
              highlightedCities={highlightedCities}
              products={selectedProductDefinitions}
              regions={reference.regions}
            />
          </div>
        ) : (
          <div className="empty-chart">
            {selectedProducts.length === 0
              ? "Wybierz co najmniej jeden produkt."
              : "Brak świadczeniodawców spełniających wybrane kryteria."}
          </div>
        )}
      </section>

      <details className="data-details">
        <summary>Tabela danych · liczba hospitalizacji a śmiertelność</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTableHeader label="Świadczeniodawca" active={sortState?.key === "providerName"} direction={sortState?.direction} onSort={() => sortBy("providerName")} />
                <SortableTableHeader label="NIP" active={sortState?.key === "nip"} direction={sortState?.direction} onSort={() => sortBy("nip")} />
                <SortableTableHeader label={effectiveDisplayMode === "combined" ? "KODY JGP" : "KOD JGP"} active={sortState?.key === "jgp"} direction={sortState?.direction} onSort={() => sortBy("jgp")} />
                <SortableTableHeader label="Województwo" active={sortState?.key === "voivodeship"} direction={sortState?.direction} onSort={() => sortBy("voivodeship")} />
                <SortableTableHeader label="Miasto" active={sortState?.key === "city"} direction={sortState?.direction} onSort={() => sortBy("city")} />
                <SortableTableHeader label="Hospitalizacje" active={sortState?.key === "hospitalizations"} direction={sortState?.direction} onSort={() => sortBy("hospitalizations")} />
                <SortableTableHeader label="Zgony" active={sortState?.key === "deaths"} direction={sortState?.direction} onSort={() => sortBy("deaths")} />
                <SortableTableHeader label="Śmiertelność" active={sortState?.key === "mortalityPct"} direction={sortState?.direction} onSort={() => sortBy("mortalityPct")} />
              </tr>
            </thead>
            <tbody>
              {sortedTableRows.slice(0, 500).map((row) => {
                const jgpCodes = row.productCodes
                  .map((code) => productMap.get(code)?.jgpCode ?? code)
                  .join(", ");
                const jgpLabels = row.productCodes
                  .map((code) => productMap.get(code)?.label ?? code)
                  .join(" · ");

                return (
                  <tr key={effectiveDisplayMode === "combined"
                    ? `${row.owNfz}-${row.nip}`
                    : `${row.owNfz}-${row.nip}-${row.productCode}`}
                  >
                    <td title={row.providerName}>{row.providerName}</td>
                    <td>{row.nip}</td>
                    <td title={jgpLabels}>{jgpCodes || "—"}</td>
                    <td title={row.voivodeship}>{row.voivodeship}</td>
                    <td title={formatCityName(row.city)}>{formatCityName(row.city)}</td>
                    <td>{Math.round(row.hospitalizations).toLocaleString("pl-PL")}</td>
                    <td>{Math.round(row.deaths).toLocaleString("pl-PL")}</td>
                    <td>{row.mortalityPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tableRows.length > 500
            ? <p className="table-note">Podgląd pokazuje pierwsze 500 wierszy.</p>
            : null}
        </div>
      </details>
    </div>
  </>;
}
