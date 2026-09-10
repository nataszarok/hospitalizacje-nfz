"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  attachHoverMarker,
  getCommonPlotLayout,
  getGeoKey,
  getGeoSelection,
  HIGHLIGHT_COLORS,
  makeDimensionLegendTraces,
  makeHoverTrace,
  PLOTLY_CONFIG,
  PRODUCT_SYMBOLS,
} from "@/lib/plotlyChart";
import type { AxisMode, GeographyMode, MortalityRow, ProductOption, RegionOption } from "@/lib/types";

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

      const rowProductCodes = new Set(rows.map((row) => row.productCode));
      const productCodes = [
        ...products.filter((product) => rowProductCodes.has(product.code)).map((product) => product.code),
        ...[...rowProductCodes].filter((code) => !productByCode.has(code)),
      ];
      const geoSelection = getGeoSelection(geographyMode, highlightedRegions, highlightedCities);
      const geoLabel = (key: string) => geographyMode === "regions" ? (regionByCode.get(key) ?? `Województwo ${key}`) : key;
      const showLegend = geoSelection.length > 0 || productCodes.length > 1;

      const makeTrace = (subset: MortalityRow[], productCode: string, productIndex: number, name: string, color: string, emphasized = false) => ({
        type: "scattergl",
        mode: "markers",
        name,
        showlegend: false,
        x: subset.map((row) => axisMode === "per_100k" ? row.hospitalizationsPer100k : row.hospitalizations),
        y: subset.map((row) => row.mortalityPct),
        customdata: subset.map((row) => [row.providerName, row.nip, row.owNfz, regionByCode.get(row.owNfz) ?? row.voivodeship, row.city, row.hospitalizations, row.deaths, row.hospitalizationsPer100k, row.productCode]),
        marker: {
          size: emphasized ? 11 : 9,
          opacity: emphasized ? 0.94 : 0.68,
          symbol: productCodes.length === 1 ? "circle" : PRODUCT_SYMBOLS[productIndex % PRODUCT_SYMBOLS.length],
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
        const productLabel = productByCode.get(productCode)?.jgpCode ?? productCode;
        const remaining = productRows.filter((row) => !geoSelection.includes(getGeoKey(row, geographyMode)));
        if (remaining.length > 0) {
          traces.push(makeTrace(remaining, productCode, productIndex, `Pozostałe · ${productLabel}`, "#C7CBD1"));
        }
        geoSelection.forEach((key, geoIndex) => {
          const subset = productRows.filter((row) => getGeoKey(row, geographyMode) === key);
          if (subset.length > 0) {
            traces.push(makeTrace(subset, productCode, productIndex, `${geoLabel(key)} · ${productLabel}`, HIGHLIGHT_COLORS[geoIndex % HIGHLIGHT_COLORS.length], true));
          }
        });
      });

      traces.push(...makeDimensionLegendTraces({
        geographyMode,
        geoSelection,
        geoLabel,
        productCodes,
        productLabel: (code) => productByCode.get(code)?.jgpCode ?? code,
      }));

      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());

      await Plotly.react(chartRef.current, traces, {
        ...getCommonPlotLayout(showLegend, geographyMode === "regions" ? "Województwo - kod JGP" : "Miasto - kod JGP"),
        xaxis: {
          title: { text: axisMode === "per_100k" ? "Hospitalizacje na 100 tys. mieszkańców" : "Liczba hospitalizacji", standoff: 18, font: { size: 15, color: "#344054" } },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#EEF1F5",
          zerolinewidth: 3,
        },
        yaxis: { title: { text: "Śmiertelność (%)", standoff: 18, font: { size: 15, color: "#344054" } }, tickfont: { size: 11, color: "#667085" }, gridcolor: "#EEF1F5", zerolinecolor: "#EEF1F5", zerolinewidth: 3 },
      }, PLOTLY_CONFIG);

      const plot = chartRef.current as HTMLDivElement & {
        on: (event: string, handler: (event: any) => void) => void;
        removeAllListeners: (event: string) => void;
      };
      attachHoverMarker({ plot, Plotly, traces, hoverTraceIndex });
    };
    void render();
    return () => { cancelled = true; };
  }, [rows, axisMode, geographyMode, highlightedRegions, highlightedCities, productByCode, regionByCode]);

  return <div className="plot-shell"><div ref={chartRef} className="plot" /></div>;
}
