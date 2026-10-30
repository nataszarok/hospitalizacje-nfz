"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartScaleControl } from "@/components/ChartScaleControl";
import { areaLabel, COUNTRY_AREA, type AnalysisArea } from "@/lib/area";
import { formatCityName } from "@/lib/formatters";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";
import { cityBreakdown, regionalBreakdown, type CityRow, type RegionRow } from "@/lib/regions";
import { loadStaticDataset, loadTrends, type StaticDataset, type TrendsDataset } from "@/lib/staticData";
import type { AxisMode, EstimationMethod } from "@/lib/types";
import styles from "./Explorer.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const CITY_LIMIT = 15;
const BASE_COLOR = "#2856A3";
const SELECTED_COLOR = "#C65D2E";

export type RegionViewProps = {
  productCodes: string[];
  year: string;
  method: EstimationMethod;
  area?: AnalysisArea;
  /** Kliknięcie miasta w tabeli ustawia obszar analizy. */
  onSelectArea?: (area: AnalysisArea) => void;
};

/**
 * Widok „Gdzie”: województwa (ogółem albo na 100 tys. mieszkańców) i miasta w wybranym roku.
 * Obszar: województwo zawęża listę miast i jest wyróżnione na wykresie; miasto jest wyróżnione w tabeli.
 */
export function RegionView({ productCodes, year, method, area = COUNTRY_AREA, onSelectArea }: RegionViewProps) {
  const [data, setData] = useState<{ year: string; trends: TrendsDataset; dataset: StaticDataset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [axisMode, setAxisMode] = useState<AxisMode>("per_100k");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTrends(), loadStaticDataset(year)])
      .then(([trends, dataset]) => { if (!cancelled) setData({ year, trends, dataset }); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania danych."); });
    return () => { cancelled = true; };
  }, [year]);

  const rows = useMemo(() => data && productCodes.length
    ? regionalBreakdown(data.trends, productCodes, data.year, method, data.dataset.regions, data.dataset.populations)
    : [], [data, productCodes, method]);
  const regionFilter = area.kind === "region" ? area.owNfz : undefined;
  const cities = useMemo(() => data && productCodes.length
    ? cityBreakdown(data.dataset, productCodes, method, regionFilter)
    : [], [data, productCodes, method, regionFilter]);
  const selectedCity = area.kind === "city" ? area.city : undefined;
  // Województwa wyróżnione na wykresie: wybrane województwo albo województwa świadczeniodawców z wybranego miasta.
  const selectedRegions = useMemo(() => regionFilter
    ? [regionFilter]
    : selectedCity ? cities.find((row) => row.city === selectedCity)?.regions ?? [] : [], [regionFilter, selectedCity, cities]);

  if (error) return <div className="alert">{error}</div>;
  if (!productCodes.length) return <div className="empty-chart">Wybierz co najmniej jeden produkt.</div>;
  if (!data) return <div className="empty-chart">Ładowanie danych…</div>;

  const total = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const population = rows.reduce((sum, row) => sum + row.population, 0);
  const national = population ? (total / population) * 100_000 : 0;
  const sorted = axisMode === "per_100k" ? rows : [...rows].sort((a, b) => b.hospitalizations - a.hospitalizations);
  const regionNames = new Map(data.dataset.regions);
  const label = areaLabel(area, { regions: data.dataset.regions.map(([owNfz, name]) => ({ owNfz, name })) });

  return <div className={styles.viewStack}>
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Hospitalizacje w województwach · {data.year}</h2>
          <p>
            {axisMode === "per_100k" ? `Na 100 tys. mieszkańców. Średnia dla Polski: ${decimal(national)}.` : `Liczba ogółem. Razem: ${integer(total)}.`}
            {" "}Województwo to oddział NFZ, w którym świadczeniodawca rozlicza hospitalizacje, nie miejsce zamieszkania pacjenta.
            {selectedRegions.length ? ` Wyróżnione: ${selectedRegions.map((ow) => regionNames.get(ow) ?? ow).join(", ")}.` : ""}
          </p>
        </div>
        <ChartScaleControl value={axisMode} onChange={setAxisMode} />
      </div>
      <RegionChart rows={sorted} axisMode={axisMode} national={national} selected={selectedRegions} />
    </section>

    <CitySection
      year={data.year}
      cities={cities}
      area={area}
      areaName={label}
      regionNames={regionNames}
      onSelectArea={onSelectArea}
    />

    <details className="data-details">
      <summary>Tabela danych · województwa</summary>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Województwo</th><th>Hospitalizacje</th><th>Na 100 tys.</th><th>Zgony</th><th>Śmiertelność</th><th>Nagłe</th></tr></thead>
          <tbody>
            {sorted.map((row) => <tr key={row.owNfz}>
              <td>{row.name}</td>
              <td>{integer(row.hospitalizations)}</td>
              <td>{decimal(row.per100k)}</td>
              <td>{integer(row.deaths)}</td>
              <td>{decimal(row.mortalityPct)}%</td>
              <td>{decimal(row.urgentPct)}%</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </details>
  </div>;
}

function CitySection({ year, cities, area, areaName, regionNames, onSelectArea }: {
  year: string;
  cities: CityRow[];
  area: AnalysisArea;
  areaName: string;
  regionNames: Map<string, string>;
  onSelectArea?: (area: AnalysisArea) => void;
}) {
  const selectedCity = area.kind === "city" ? area.city : null;
  const top = cities.slice(0, CITY_LIMIT);
  // Wybrane miasto zawsze widać, także spoza pierwszej piętnastki.
  const selectedRow = selectedCity ? cities.find((row) => row.city === selectedCity) : undefined;
  const shown = selectedRow && !top.includes(selectedRow) ? [...top, selectedRow] : top;
  const max = Math.max(...shown.map((row) => row.hospitalizations), 0);
  const scope = area.kind === "region" ? areaName : "cała Polska";

  return <section className={styles.card} aria-labelledby="region-cities">
    <div className={styles.cardHeader}>
      <div>
        <h2 id="region-cities">Miasta · {year} · {scope}</h2>
        <p>
          Miasto siedziby świadczeniodawcy. Liczba ogółem — dane nie zawierają liczby mieszkańców miast, więc nie liczymy wskaźnika na 100 tys.
          {area.kind === "region" ? " Siedziba może leżeć poza województwem, np. gdy sieć szpitali rozlicza się w kilku oddziałach NFZ." : ""}
        </p>
      </div>
    </div>
    {shown.length ? <div className="table-wrap">
      <table className={styles.cityTable}>
        <thead>
          <tr>
            <th>#</th><th>Miasto</th><th>Hospitalizacje</th>
            <th className={styles.num}>Świadczeniodawcy</th><th className={styles.num}>Śmiertelność</th><th className={styles.num}>Nagłe</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => <tr key={row.city} className={row.city === selectedCity ? styles.citySelected : undefined} aria-current={row.city === selectedCity ? "true" : undefined}>
            <td>{cities.indexOf(row) + 1}</td>
            <td title={row.regions.map((ow) => regionNames.get(ow) ?? ow).join(", ")}>
              {onSelectArea && row.city !== selectedCity
                ? <button type="button" className={styles.cityButton} onClick={() => onSelectArea({ kind: "city", city: row.city })}>{formatCityName(row.city)}</button>
                : formatCityName(row.city)}
            </td>
            <td>
              <div className={styles.barCell}>
                <span className={styles.bar} style={{ width: `${max ? (row.hospitalizations / max) * 100 : 0}%` }} aria-hidden />
                <span className={styles.barValue}>{integer(row.hospitalizations)}</span>
              </div>
            </td>
            <td className={styles.num}>{integer(row.providers)}</td>
            <td className={styles.num}>{decimal(row.mortalityPct)}%</td>
            <td className={styles.num}>{decimal(row.urgentPct)}%</td>
          </tr>)}
        </tbody>
      </table>
    </div> : <div className="empty-chart">Brak hospitalizacji w wybranym obszarze.</div>}
    {cities.length > CITY_LIMIT
      ? <p className={styles.cardNote}>{CITY_LIMIT} z {integer(cities.length)} miast. {onSelectArea ? "Kliknij miasto, aby ustawić je jako obszar analizy." : ""}</p>
      : null}
  </section>;
}

function RegionChart({ rows, axisMode, national, selected }: { rows: RegionRow[]; axisMode: AxisMode; national: number; selected: string[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      const perCapita = axisMode === "per_100k";
      const isSelected = (row: RegionRow) => selected.includes(row.owNfz);
      // Poziome słupki od góry: największa wartość na górze. Wyróżnienie: kolor i pogrubiona nazwa.
      const ordered = [...rows].reverse();
      await Plotly.react(chartRef.current, [{
        type: "bar",
        orientation: "h",
        y: ordered.map((row) => isSelected(row) ? `<b>${row.name}</b>` : row.name),
        x: ordered.map((row) => perCapita ? row.per100k : row.hospitalizations),
        marker: { color: ordered.map((row) => isSelected(row) ? SELECTED_COLOR : BASE_COLOR) },
        hovertemplate: perCapita ? "%{y}<br>%{x:,.1f} na 100 tys.<extra></extra>" : "%{y}<br>%{x:,.0f} hospitalizacji<extra></extra>",
      }], {
        height: Math.max(320, rows.length * 26 + 76),
        autosize: true,
        margin: { l: 150, r: 24, t: 24, b: 36 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        separators: ", ",
        bargap: 0.35,
        showlegend: false,
        hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
        xaxis: { gridcolor: "#EEF1F5", zerolinecolor: "#D0D5DD", tickformat: ",.0f" },
        yaxis: { automargin: true },
        shapes: perCapita && national ? [{ type: "line", x0: national, x1: national, yref: "paper", y0: 0, y1: 1, line: { color: "#667085", width: 1, dash: "dot" } }] : [],
        annotations: perCapita && national ? [{ x: national, yref: "paper", y: 1, yanchor: "bottom", showarrow: false, text: "Polska", font: { size: 11, color: "#667085" } }] : [],
      }, PLOTLY_CONFIG);
    };
    void render();
    return () => { cancelled = true; };
  }, [rows, axisMode, national, selected]);
  return <div ref={chartRef} role="img" aria-label="Wykres: hospitalizacje w województwach" />;
}
