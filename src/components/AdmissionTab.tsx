"use client";

import { useMemo, useState } from "react";
import { AdmissionChart } from "@/components/AdmissionChart";
import { AreaStatsPopover } from "@/components/AreaStatsPopover";
import { ChartScaleControl } from "@/components/ChartScaleControl";
import { MortalityDisplayControl } from "@/components/MortalityDisplayControl";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { JgpCodeLinks, ProviderLink } from "@/components/TableLinks";
import {
  admissionRowsPerJgp,
  aggregateAdmissionRowsByProvider,
} from "@/lib/admissions";
import type { AnalysisArea } from "@/lib/area";
import { formatCityName } from "@/lib/formatters";
import type { MortalityDisplayMode } from "@/lib/mortality";
import { nextSortState, sortTableRows, type SortState } from "@/lib/tableSort";
import type { AdmissionPayload, AxisMode, GeographyMode, ReferencePayload } from "@/lib/types";
import styles from "./AdmissionTab.module.css";

type AdmissionSortKey =
  | "providerName"
  | "nip"
  | "jgp"
  | "voivodeship"
  | "city"
  | "plannedAdmissions"
  | "urgentAdmissions"
  | "totalAdmissions";

export function AdmissionTab({
  reference,
  data,
  loading,
  error,
  selectedProducts,
  axisMode,
  setAxisMode,
  highlightAreas,
  displayMode,
  setDisplayMode,
}: {
  reference: ReferencePayload;
  data: AdmissionPayload;
  loading: boolean;
  error: string | null;
  selectedProducts: string[];
  axisMode: AxisMode;
  setAxisMode: (value: AxisMode) => void;
  /** Obszary analizy wyróżnione kolorami na wykresie (pusta lista = bez wyróżnień). */
  highlightAreas: AnalysisArea[];
  displayMode: MortalityDisplayMode;
  setDisplayMode: (value: MortalityDisplayMode) => void;
}) {
  // Panel statystyk obszarów ma jeden poziom: miasta, gdy wybrano tylko miasta; w pozostałych przypadkach województwa.
  const geoMode: GeographyMode = highlightAreas.length && highlightAreas.every((area) => area.kind === "city") ? "cities" : "regions";
  const selectedAreaKeys = highlightAreas.flatMap((area) => geoMode === "regions" ? (area.kind === "region" ? [area.owNfz] : []) : (area.kind === "city" ? [area.city] : []));
  const [sortState, setSortState] = useState<SortState<AdmissionSortKey>>(null);
  const canGroupJgp = selectedProducts.length >= 2;
  const effectiveDisplayMode: MortalityDisplayMode = canGroupJgp ? displayMode : "combined";

  const productByCode = useMemo(
    () => new Map(reference.products.map((product) => [product.code, product])),
    [reference.products],
  );

  const tableRows = useMemo(
    () => effectiveDisplayMode === "combined"
      ? aggregateAdmissionRowsByProvider(data.rows)
      : admissionRowsPerJgp(data.rows),
    [data.rows, effectiveDisplayMode],
  );

  const sortedRows = useMemo(() => {
    if (!sortState) return tableRows;

    return sortTableRows(tableRows, sortState.direction, (row) => {
      switch (sortState.key) {
        case "providerName": return row.providerName;
        case "nip": return row.nip;
        case "jgp":
          return row.productCodes
            .map((code) => productByCode.get(code)?.jgpCode ?? code)
            .join(", ");
        case "voivodeship": return row.voivodeship;
        case "city": return formatCityName(row.city);
        case "plannedAdmissions": return row.plannedAdmissions;
        case "urgentAdmissions": return row.urgentAdmissions;
        case "totalAdmissions": return row.totalAdmissions;
      }
    });
  }, [productByCode, sortState, tableRows]);

  const sortBy = (key: AdmissionSortKey) => {
    setSortState((current) => nextSortState(current, key));
  };

  return <>
    {error ? <div className="alert">{error}</div> : null}
    <div className={loading ? "content loading" : "content"}>
      <section className="chart-section">
        {data.rows.length > 0 ? (
          <div className={`plot-column ${styles.plotColumn}`}>
            <div className={`plot-toolbar ${styles.toolbar}`}>
              {canGroupJgp ? (
                <MortalityDisplayControl value={displayMode} onChange={setDisplayMode} />
              ) : null}

              <div className={styles.presentationControls}>
                <ChartScaleControl value={axisMode} onChange={setAxisMode} />
                <AreaStatsPopover
                  kind="admissions"
                  geographyMode={geoMode}
                  selectedKeys={selectedAreaKeys}
                  rows={data.rows}
                  products={reference.products}
                  displayMode={effectiveDisplayMode}
                />
              </div>
            </div>

            <AdmissionChart
              rows={data.rows}
              axisMode={axisMode}
              displayMode={effectiveDisplayMode}
              highlightAreas={highlightAreas}
              products={reference.products}
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
        <summary>Tabela danych · tryb przyjęcia</summary>
        <div className="table-wrap">
          <table className="admission-table">
            <thead>
              <tr>
                <SortableTableHeader label="Świadczeniodawca" active={sortState?.key === "providerName"} direction={sortState?.direction} onSort={() => sortBy("providerName")} />
                <SortableTableHeader label="NIP" active={sortState?.key === "nip"} direction={sortState?.direction} onSort={() => sortBy("nip")} />
                <SortableTableHeader label={effectiveDisplayMode === "combined" ? "Kody JGP" : "Kod JGP"} active={sortState?.key === "jgp"} direction={sortState?.direction} onSort={() => sortBy("jgp")} />
                <SortableTableHeader label="Województwo" active={sortState?.key === "voivodeship"} direction={sortState?.direction} onSort={() => sortBy("voivodeship")} />
                <SortableTableHeader label="Miasto" active={sortState?.key === "city"} direction={sortState?.direction} onSort={() => sortBy("city")} />
                <SortableTableHeader label="Planowane (6)" active={sortState?.key === "plannedAdmissions"} direction={sortState?.direction} onSort={() => sortBy("plannedAdmissions")} />
                <SortableTableHeader label="Nagłe (2+3)" active={sortState?.key === "urgentAdmissions"} direction={sortState?.direction} onSort={() => sortBy("urgentAdmissions")} />
                <SortableTableHeader label="Planowane + nagłe" active={sortState?.key === "totalAdmissions"} direction={sortState?.direction} onSort={() => sortBy("totalAdmissions")} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.slice(0, 500).map((row) => {
                const jgpCodes = row.productCodes
                  .map((code) => productByCode.get(code)?.jgpCode ?? code);

                return (
                  <tr key={effectiveDisplayMode === "combined"
                    ? `${row.owNfz}-${row.nip}`
                    : `${row.owNfz}-${row.nip}-${row.productCode}`}
                  >
                    <td title={row.providerName}><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.providerName} /></td>
                    <td>{row.nip}</td>
                    <td><JgpCodeLinks codes={jgpCodes} /></td>
                    <td title={row.voivodeship}>{row.voivodeship}</td>
                    <td title={formatCityName(row.city)}>{formatCityName(row.city)}</td>
                    <td>{Math.round(row.plannedAdmissions).toLocaleString("pl-PL")}</td>
                    <td>{Math.round(row.urgentAdmissions).toLocaleString("pl-PL")}</td>
                    <td>{Math.round(row.totalAdmissions).toLocaleString("pl-PL")}</td>
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
