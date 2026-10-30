"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartScaleControl } from "@/components/ChartScaleControl";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";
import { loadPlotly } from "@/lib/plotlyLoader";
import { regionalBreakdown, type RegionRow } from "@/lib/regions";
import { loadStaticDataset, loadTrends, type StaticDataset, type TrendsDataset } from "@/lib/staticData";
import type { AxisMode, EstimationMethod } from "@/lib/types";
import styles from "./Explorer.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Widok „Gdzie”: województwa w wybranym roku, liczba ogółem albo na 100 tys. mieszkańców. */
export function RegionView({ productCodes, year, method }: { productCodes: string[]; year: string; method: EstimationMethod }) {
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

  if (error) return <div className="alert">{error}</div>;
  if (!productCodes.length) return <div className="empty-chart">Wybierz co najmniej jeden produkt.</div>;
  if (!data) return <div className="empty-chart">Ładowanie danych…</div>;

  const total = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const population = rows.reduce((sum, row) => sum + row.population, 0);
  const national = population ? (total / population) * 100_000 : 0;
  const sorted = axisMode === "per_100k" ? rows : [...rows].sort((a, b) => b.hospitalizations - a.hospitalizations);

  return <div className={styles.viewStack}>
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Hospitalizacje w województwach · {data.year}</h2>
          <p>
            {axisMode === "per_100k" ? `Na 100 tys. mieszkańców. Średnia dla Polski: ${decimal(national)}.` : `Liczba ogółem. Razem: ${integer(total)}.`}
            {" "}Województwo świadczeniodawcy, nie miejsce zamieszkania pacjenta.
          </p>
        </div>
        <ChartScaleControl value={axisMode} onChange={setAxisMode} />
      </div>
      <RegionChart rows={sorted} axisMode={axisMode} national={national} />
    </section>

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

function RegionChart({ rows, axisMode, national }: { rows: RegionRow[]; axisMode: AxisMode; national: number }) {
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const Plotly = await loadPlotly();
      if (cancelled || !chartRef.current) return;
      const perCapita = axisMode === "per_100k";
      // Poziome słupki od góry: największa wartość na górze.
      const ordered = [...rows].reverse();
      await Plotly.react(chartRef.current, [{
        type: "bar",
        orientation: "h",
        y: ordered.map((row) => row.name),
        x: ordered.map((row) => perCapita ? row.per100k : row.hospitalizations),
        marker: { color: "#2856A3" },
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
  }, [rows, axisMode, national]);
  return <div ref={chartRef} role="img" aria-label="Wykres: hospitalizacje w województwach" />;
}
