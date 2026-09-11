"use client";

import { useEffect, useRef } from "react";
import type { HospitalRankingRow } from "@/lib/types";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";

function shortLabel(value: string, max = 42): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function HospitalRankingChart({ rows }: { rows: HospitalRankingRow[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !chartRef.current) return;

      const topRows = rows.slice(0, 15).reverse();
      await Plotly.react(chartRef.current, [{
        type: "bar",
        orientation: "h",
        x: topRows.map((row) => row.hospitalizations),
        y: topRows.map((row) => shortLabel(row.providerName)),
        customdata: topRows.map((row) => [row.providerName, row.city, row.voivodeship, row.hospitalizations, row.sharePct]),
        marker: { color: "#2856A3", opacity: 0.88 },
        hovertemplate: [
          "<b>%{customdata[0]}</b>",
          "%{customdata[1]} · %{customdata[2]}",
          "Hospitalizacje: %{customdata[3]:,.0f}",
          "Udział w wybranym JGP: %{customdata[4]:.1f}%",
          "<extra></extra>",
        ].join("<br>"),
      }], {
        height: 540,
        autosize: true,
        margin: { l: 260, r: 28, t: 18, b: 72 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        showlegend: false,
        bargap: 0.28,
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        xaxis: {
          title: { text: "Liczba hospitalizacji", standoff: 16, font: { size: 14, color: "#344054" } },
          tickfont: { size: 11, color: "#667085" },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#EEF1F5",
        },
        yaxis: {
          tickfont: { size: 10.5, color: "#475467" },
          automargin: false,
        },
        hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
      }, PLOTLY_CONFIG);
    };
    void render();
    return () => { cancelled = true; };
  }, [rows]);

  return <div className="plot-shell find-hospital-plot-shell"><div ref={chartRef} className="plot" /></div>;
}
