"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AxisMode, GeographyMode, MortalityRow, ProductOption, RegionOption } from "@/lib/types";

const HIGHLIGHT_COLORS = ["#2856A3", "#C65D2E", "#2E7D5B", "#7656A8", "#A06A17"];
const SYMBOLS = ["circle", "square", "diamond", "triangle-up", "cross"];

export function MortalityChart({ rows, axisMode, geographyMode, highlightedRegions, highlightedCities, products, regions }: {
  rows: MortalityRow[];
  axisMode: AxisMode;
  geographyMode: GeographyMode;
  highlightedRegions: string[];
  highlightedCities: string[];
  products: ProductOption[];
  regions: RegionOption[];
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const productByCode = useMemo(() => new Map(products.map((p) => [p.code, p])), [products]);
  const regionByCode = useMemo(() => new Map(regions.map((r) => [r.owNfz, r.name])), [regions]);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !chartRef.current) return;

      const appFontFamily = getComputedStyle(document.body).fontFamily || "Inter, ui-sans-serif, system-ui, sans-serif";
      const productCodes = [...new Set(rows.map((row) => row.productCode))];
      const geoSelection = geographyMode === "regions" ? highlightedRegions : highlightedCities;
      const geoKey = (row: MortalityRow) => geographyMode === "regions" ? row.owNfz : row.city;
      const geoLabel = (key: string) => geographyMode === "regions" ? (regionByCode.get(key) ?? `Województwo ${key}`) : key;
      const showLegend = geoSelection.length > 0 || productCodes.length > 1;

      const makeTrace = (subset: MortalityRow[], productCode: string, productIndex: number, name: string, color: string, emphasized = false) => ({
        type: "scattergl",
        mode: "markers",
        name,
        x: subset.map((row) => axisMode === "per_100k" ? row.hospitalizationsPer100k : row.hospitalizations),
        y: subset.map((row) => row.mortalityPct),
        customdata: subset.map((row) => [row.providerName, row.nip, row.owNfz, regionByCode.get(row.owNfz) ?? row.voivodeship, row.city, row.hospitalizations, row.deaths, row.hospitalizationsPer100k, row.productCode]),
        marker: {
          size: emphasized ? 11 : 9,
          opacity: emphasized ? 0.94 : 0.68,
          symbol: productCodes.length === 1 ? "circle" : SYMBOLS[productIndex % SYMBOLS.length],
          color,
          line: { width: emphasized ? 0.8 : 0.4, color: "#FFFFFF" },
        },
        hovertemplate: [
          "<b>%{customdata[0]}</b>",
          "NIP: %{customdata[1]}",
          "Województwo: %{customdata[3]}",
          "Miejscowość: %{customdata[4]}",
          "Hospitalizacje: %{customdata[5]:,.0f}",
          "Zgony: %{customdata[6]:,.0f}",
          "Śmiertelność: %{y:.2f}%",
          "<extra></extra>",
        ].join("<br>"),
      });

      const traces: Record<string, unknown>[] = [];
      productCodes.forEach((productCode, productIndex) => {
        const productRows = rows.filter((row) => row.productCode === productCode);
        const productLabel = productByCode.get(productCode)?.label ?? productCode;
        const remaining = productRows.filter((row) => !geoSelection.includes(geoKey(row)));
        if (remaining.length > 0) {
          traces.push(makeTrace(remaining, productCode, productIndex, `Pozostałe · ${productLabel}`, "#C7CBD1"));
        }
        geoSelection.forEach((key, geoIndex) => {
          const subset = productRows.filter((row) => geoKey(row) === key);
          if (subset.length > 0) {
            traces.push(makeTrace(subset, productCode, productIndex, `${geoLabel(key)} · ${productLabel}`, HIGHLIGHT_COLORS[geoIndex % HIGHLIGHT_COLORS.length], true));
          }
        });
      });

      const hoverTraceIndex = traces.length;
      traces.push({
        type: "scattergl",
        mode: "markers",
        x: [null],
        y: [null],
        showlegend: false,
        hoverinfo: "skip",
        marker: {
          size: 13,
          opacity: 1,
          color: "#D92D20",
          symbol: "circle",
          line: { width: 1.4, color: "#FFFFFF" },
        },
      });

      await Plotly.react(chartRef.current, traces, {
        height: 540,
        autosize: true,
        margin: { l: 88, r: 24, t: showLegend ? 78 : 22, b: 88 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        hovermode: "closest",
        hoverdistance: 18,
        font: { family: appFontFamily, color: "#172033", size: 12 },
        xaxis: {
          title: { text: axisMode === "per_100k" ? "Hospitalizacje na 100 tys. mieszkańców" : "Liczba hospitalizacji", standoff: 18, font: { size: 15, color: "#344054" } },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#EEF1F5",
          zerolinewidth: 3,
        },
        yaxis: { title: { text: "Śmiertelność (%)", standoff: 18, font: { size: 15, color: "#344054" } }, tickfont: { size: 11, color: "#667085" }, gridcolor: "#EEF1F5", zerolinecolor: "#EEF1F5", zerolinewidth: 3,},
        legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "left", x: 0, font: { size: 11, color: "#111111" } },
        showlegend: showLegend,
        hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
      }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] });

      const plot = chartRef.current as HTMLDivElement & {
        on: (event: string, handler: (event: any) => void) => void;
        removeAllListeners: (event: string) => void;
      };

      plot.removeAllListeners("plotly_hover");
      plot.removeAllListeners("plotly_unhover");

      plot.on("plotly_hover", (event) => {
        const point = event?.points?.[0];
        if (!point || point.curveNumber === hoverTraceIndex) return;

        const sourceTrace = traces[point.curveNumber] as {
          marker?: { symbol?: string | string[] };
        };
        const sourceSymbol = sourceTrace.marker?.symbol;
        const symbol = Array.isArray(sourceSymbol)
          ? (sourceSymbol[point.pointNumber] ?? "circle")
          : (sourceSymbol ?? "circle");

        void Plotly.restyle(plot, {
          x: [[point.x]],
          y: [[point.y]],
          "marker.symbol": [symbol],
        }, [hoverTraceIndex]);
      });

      plot.on("plotly_unhover", () => {
        void Plotly.restyle(plot, {
          x: [[null]],
          y: [[null]],
        }, [hoverTraceIndex]);
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [rows, axisMode, geographyMode, highlightedRegions, highlightedCities, productByCode, regionByCode]);

  return <div className="plot-shell"><div ref={chartRef} className="plot" /></div>;
}
