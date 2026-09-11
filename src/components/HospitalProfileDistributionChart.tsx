"use client";

import { useEffect, useRef } from "react";
import type { HospitalProfileRow } from "@/lib/types";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";

export function HospitalProfileDistributionChart({ rows }: { rows: HospitalProfileRow[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !chartRef.current) return;

      const values = rows.map((row) => row.hospitalizations);
      const bins = Math.min(30, Math.max(8, Math.ceil(Math.sqrt(Math.max(rows.length, 1)) * 2)));

      await Plotly.react(chartRef.current, [
        {
          type: "histogram",
          x: values,
          nbinsx: bins,
          marker: { color: "#7C92BC", opacity: 0.78 },
          hovertemplate: [
            "Hospitalizacje / kod JGP: %{x}",
            "Liczba kodów w przedziale: %{y}",
            "<extra></extra>",
          ].join("<br>"),
          name: "Rozkład",
        },
        {
          type: "scatter",
          mode: "markers",
          x: values,
          y: rows.map(() => 0),
          customdata: rows.map((row) => [row.jgpCode, row.jgpName ?? "", row.hospitalizations, row.sharePct]),
          marker: { color: "#172033", size: 6, opacity: 0.62 },
          hovertemplate: [
            "<b>%{customdata[0]}</b>",
            "%{customdata[1]}",
            "Hospitalizacje: %{customdata[2]:,.0f}",
            "Udział: %{customdata[3]:.1f}%",
            "<extra></extra>",
          ].join("<br>"),
          name: "Kody JGP",
          showlegend: false,
        },
      ], {
        height: 410,
        autosize: true,
        margin: { l: 78, r: 24, t: 18, b: 76 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        showlegend: false,
        bargap: 0.06,
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        xaxis: {
          title: { text: "Liczba hospitalizacji zagregowana per kod JGP", standoff: 16, font: { size: 14, color: "#344054" } },
          tickfont: { size: 11, color: "#667085" },
          gridcolor: "#F3F5F8",
          zerolinecolor: "#EEF1F5",
        },
        yaxis: {
          title: { text: "Liczba kodów JGP", standoff: 14, font: { size: 14, color: "#344054" } },
          tickfont: { size: 11, color: "#667085" },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#D9DEE7",
          rangemode: "tozero",
        },
        hovermode: "closest",
        hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
      }, PLOTLY_CONFIG);
    };
    void render();
    return () => { cancelled = true; };
  }, [rows]);

  return <div className="plot-shell hospital-profile-plot-shell"><div ref={chartRef} className="plot" /></div>;
}
