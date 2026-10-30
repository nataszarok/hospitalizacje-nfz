"use client";

import { useEffect, useRef } from "react";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";
import type { YearPoint } from "@/lib/sanokHospital";
import styles from "./SanokCodesPage.module.css";

const BAR_COLOR = "#2856A3";
const PARTIAL_COLOR = "#A9BCDD";

type SanokYearChartProps = {
  title: string;
  points: YearPoint[];
  metric: "value" | "patients";
};

export function SanokYearChart({ title, points, metric }: SanokYearChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const element = chartRef.current;

    const render = async () => {
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !element) return;

      const isValue = metric === "value";
      await Plotly.react(element, [{
        type: "bar",
        x: points.map((point) => (point.partial ? `${point.year}*` : String(point.year))),
        y: points.map((point) => (isValue ? point.value : point.patients)),
        marker: { color: points.map((point) => (point.partial ? PARTIAL_COLOR : BAR_COLOR)) },
        hovertemplate: isValue ? "%{y:,.0f} zł<extra></extra>" : "%{y:,.0f} pacjentów<extra></extra>",
      }], {
        autosize: true,
        height: 260,
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        margin: { l: 64, r: 8, t: 8, b: 36 },
        bargap: 0.3,
        showlegend: false,
        separators: ", ",
        xaxis: { type: "category", tickfont: { size: 11 } },
        yaxis: { rangemode: "tozero", gridcolor: "#EAECF0", zeroline: false, tickformat: isValue ? "~s" : ",d" },
      }, PLOTLY_CONFIG);
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [points, metric]);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.figureTitle}>{title}</figcaption>
      <div ref={chartRef} data-testid={`sanok-year-chart-${metric}`} />
    </figure>
  );
}
