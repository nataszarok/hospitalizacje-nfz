"use client";

import { useEffect, useRef } from "react";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";
import { formatQuarter, type SanokQuarterPoint } from "@/lib/sanokCodes";
import styles from "./SanokCodesPage.module.css";

export const FACILITY_COLORS = ["#2856A3", "#C65D2E"];

type SanokTrendChartProps = {
  title: string;
  series: SanokQuarterPoint[][];
  facilityNames: string[];
  metric: "count" | "longStayShare";
};

export function SanokTrendChart({ title, series, facilityNames, metric }: SanokTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const element = chartRef.current;

    const render = async () => {
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !element) return;

      const isShare = metric === "longStayShare";
      const traces = series.map((points, index) => ({
        type: "scatter",
        mode: "lines+markers",
        name: facilityNames[index],
        x: points.map((point) => formatQuarter(point.quarter)),
        y: points.map((point) => (isShare ? point.longStayShare : point.count)),
        customdata: points.map((point) => point.count),
        connectgaps: false,
        line: { color: FACILITY_COLORS[index], width: 2.5 },
        marker: { color: FACILITY_COLORS[index], size: 5 },
        hovertemplate: isShare
          ? "%{y:.1%} z %{customdata} hosp.<extra>%{fullData.name}</extra>"
          : "%{y} hosp.<extra>%{fullData.name}</extra>",
      }));

      await Plotly.react(element, traces, {
        autosize: true,
        height: 280,
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        margin: { l: 52, r: 12, t: 8, b: 64 },
        hovermode: "x unified",
        showlegend: false,
        xaxis: { type: "category", tickangle: -45, gridcolor: "#F0F2F5", tickfont: { size: 11 } },
        yaxis: isShare
          ? { range: [0, 1], tickformat: ".0%", gridcolor: "#EAECF0", zeroline: false }
          : { rangemode: "tozero", gridcolor: "#EAECF0", zeroline: false, separatethousands: true },
        separators: ", ",
      }, PLOTLY_CONFIG);
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [series, facilityNames, metric]);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.figureTitle}>{title}</figcaption>
      <div ref={chartRef} data-testid={`sanok-chart-${metric}`} />
    </figure>
  );
}
