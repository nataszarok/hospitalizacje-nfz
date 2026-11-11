"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePlotResize } from "@/lib/usePlotResize";
import { formatCityName } from "@/lib/formatters";
import {
  aggregateMortalityRowsByProvider,
  mortalityRowsPerJgp,
  type MortalityDisplayMode,
  type MortalityDisplayRow,
} from "@/lib/mortality";
import { BASE_POINT, OTHER_POINT } from "@/lib/chartPalette";
import { funnelStatus, showsMortalityReference } from "@/lib/jgpCard";
import { FUNNEL_STATUS_COLORS, funnelLegendTraces, funnelLines, mortalityTotals } from "@/lib/mortalityFunnel";
import { areaFromValue, areaToValue, type AnalysisArea } from "@/lib/area";
import {
  areaHighlightKey,
  areaHighlightTitle,
  attachHoverMarker,
  axisTitle,
  baselineShape,
  getCommonPlotLayout,
  hoverTemplate,
  measureAxis,
  paddedRange,
  HIGHLIGHT_COLORS,
  makeDimensionLegendTraces,
  makeHoverTrace,
  PLOTLY_CONFIG,
  PRODUCT_SYMBOLS,
  referenceAnnotation,
  referenceShape,
  meanPctLabel,
  type PlotElement,
} from "@/lib/plotlyChart";
import type { AxisMode, MortalityRow, ProductOption, RegionOption } from "@/lib/types";

export function MortalityChart({
  rows,
  axisMode,
  displayMode,
  highlightAreas,
  products,
  regions,
  funnel = false,
}: {
  rows: MortalityRow[];
  axisMode: AxisMode;
  displayMode: MortalityDisplayMode;
  /** Obszary wyróżnione kolorami (kolejność = kolejność kolorów); reszta punktów jest szara. */
  highlightAreas: AnalysisArea[];
  products: ProductOption[];
  regions: RegionOption[];
  /**
   * Lejek (tylko oś „liczba hospitalizacji” i grupy razem, `explorerFunnelState`): granice 95% i 99,8% wokół średniej,
   * punkty spoza wyróżnionych obszarów w kolorach statusu, w dymku status. Jak na karcie grupy JGP.
   */
  funnel?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  usePlotResize(chartRef);
  const productByCode = useMemo(
    () => new Map(products.map((product) => [product.code, product])),
    [products],
  );
  const regionByCode = useMemo(
    () => new Map(regions.map((region) => [region.owNfz, region.name])),
    [regions],
  );

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!chartRef.current) return;

      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !chartRef.current) return;

      const rowProductCodes = new Set(rows.map((row) => row.productCode));
      const productCodes = [
        ...products
          .filter((product) => rowProductCodes.has(product.code))
          .map((product) => product.code),
        ...[...rowProductCodes].filter((code) => !productByCode.has(code)),
      ];

      const geoSelection = highlightAreas.map(areaToValue);

      const geoLabel = (key: string) => {
        const area = areaFromValue(key);
        return area.kind === "region" ? (regionByCode.get(area.owNfz) ?? `Województwo ${area.owNfz}`) : area.kind === "city" ? formatCityName(area.city) : key;
      };

      // Bez wyróżnienia punkty są niebieskie; z wyróżnieniem pozostałe szare (jak na karcie grupy JGP).
      const restColor = geoSelection.length ? OTHER_POINT : BASE_POINT;
      const isCombined = displayMode === "combined";
      // Legenda Plotly: obszary, kody JGP i linie granic odchyleń w jednej kolumnie.
      const showLegend = funnel || geoSelection.length > 0 || (!isCombined && productCodes.length > 1);

      // Średnia śmiertelność wszystkich świadczeniodawców wykresu (linia „średnia” i środek lejka).
      const { meanPct } = mortalityTotals(rows);
      const status = (row: MortalityDisplayRow) => funnelStatus(row.mortalityPct, meanPct, row.hospitalizations);

      const makeTrace = (
        subset: MortalityDisplayRow[],
        productIndex: number,
        name: string,
        color: string | ((row: MortalityDisplayRow) => string),
        emphasized = false,
      ) => ({
        type: "scattergl",
        mode: "markers",
        name,
        showlegend: false,
        x: subset.map((row) => axisMode === "per_100k"
          ? row.hospitalizationsPer100k
          : row.hospitalizations),
        y: subset.map((row) => row.mortalityPct),
        customdata: subset.map((row) => [
          row.providerName,
          row.nip,
          row.owNfz,
          regionByCode.get(row.owNfz) ?? row.voivodeship,
          formatCityName(row.city),
          row.hospitalizations,
          row.deaths,
          row.hospitalizationsPer100k,
          row.productCodes
            .map((code) => productByCode.get(code)?.jgpCode ?? code)
            .join(", "),
          funnel ? status(row) : "",
        ]),
        marker: {
          size: emphasized ? 11 : 9,
          // Kolory tła mają już przezroczystość z palety.
          opacity: emphasized ? 0.94 : 1,
          symbol: isCombined || productCodes.length === 1
            ? "circle"
            : PRODUCT_SYMBOLS[productIndex % PRODUCT_SYMBOLS.length],
          color: typeof color === "function" ? subset.map(color) : color,
          line: {
            width: emphasized ? 0.8 : 0.4,
            color: "#FFFFFF",
          },
        },
        // Kolejność dymka: nazwa, kontekst (miejscowość · województwo · JGP), oś Y, oś X, NIP na końcu.
        hovertemplate: hoverTemplate({
          title: "%{customdata[0]}",
          context: "%{customdata[4]} · %{customdata[3]} · %{customdata[8]}",
          rows: [
            { label: "Śmiertelność", value: "%{y:.2f}%" },
            axisMode === "per_100k"
              ? { label: "Hospitalizacje na 100 tys.", value: "%{customdata[7]:,.1f}" }
              : { label: "Hospitalizacje", value: "%{customdata[5]:,.0f}" },
            { label: "Zgony", value: "%{customdata[6]:,.0f}" },
            ...(funnel ? [{ label: "Granice odchyleń", value: "%{customdata[9]}" }] : []),
          ],
          footer: "NIP %{customdata[1]}",
        }),
      });

      // Linie lejka pod punktami, bez dymka.
      const traces: Record<string, unknown>[] = funnel
        ? funnelLines(meanPct, Math.max(0, ...rows.map((row) => row.hospitalizations))).map((line) => ({
          type: "scattergl", mode: "lines", x: line.x, y: line.y, hoverinfo: "skip", showlegend: false,
          line: { color: line.color, width: 1.2, dash: line.dash },
        }))
        : [];
      // Oś X liczymy z punktów, bez linii lejka (sięgają do 105% maksimum): włączenie lejka nie zmienia osi.
      const funnelTraceCount = traces.length;

      if (isCombined) {
        const chartRows = aggregateMortalityRowsByProvider(rows);
        const remaining = chartRows.filter(
          (row) => areaHighlightKey(highlightAreas, row) === null,
        );

        if (remaining.length > 0) {
          // Lejek bez wyróżnionych obszarów: kolor punktu = status na lejku.
          const color = funnel && !geoSelection.length ? (row: MortalityDisplayRow) => FUNNEL_STATUS_COLORS[status(row)] : restColor;
          traces.push(makeTrace(remaining, 0, "Pozostałe", color));
        }

        geoSelection.forEach((key, geoIndex) => {
          const subset = chartRows.filter(
            (row) => areaHighlightKey(highlightAreas, row) === key,
          );

          if (subset.length > 0) {
            traces.push(makeTrace(
              subset,
              0,
              geoLabel(key),
              HIGHLIGHT_COLORS[geoIndex % HIGHLIGHT_COLORS.length],
              true,
            ));
          }
        });
      } else {
        productCodes.forEach((productCode, productIndex) => {
          const productRows = mortalityRowsPerJgp(
            rows.filter((row) => row.productCode === productCode),
          );
          const productLabel = productByCode.get(productCode)?.jgpCode ?? productCode;

          const remaining = productRows.filter(
            (row) => areaHighlightKey(highlightAreas, row) === null,
          );

          if (remaining.length > 0) {
            traces.push(makeTrace(
              remaining,
              productIndex,
              `Pozostałe · ${productLabel}`,
              restColor,
            ));
          }

          geoSelection.forEach((key, geoIndex) => {
            const subset = productRows.filter(
              (row) => areaHighlightKey(highlightAreas, row) === key,
            );

            if (subset.length > 0) {
              traces.push(makeTrace(
                subset,
                productIndex,
                `${geoLabel(key)} · ${productLabel}`,
                HIGHLIGHT_COLORS[geoIndex % HIGHLIGHT_COLORS.length],
                true,
              ));
            }
          });
        });
      }

      traces.push(...makeDimensionLegendTraces({
        geoTitle: areaHighlightTitle(highlightAreas),
        geoSelection,
        geoLabel,
        productCodes: isCombined ? [] : productCodes,
        productLabel: (code) => productByCode.get(code)?.jgpCode ?? code,
      }));
      if (funnel) traces.push(...funnelLegendTraces());

      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());

      // Ten sam margines na obu osiach (−6% / +10%); zero rysuje podstawa pod danymi.
      const xValues = traces.slice(funnelTraceCount).flatMap((trace) => (trace.x as (number | null)[] | undefined) ?? []);
      const yValues = rows.map((row) => row.mortalityPct);
      const showMean = showsMortalityReference(meanPct);

      await Plotly.react(
        chartRef.current,
        traces,
        {
          // Przełączniki są w wierszu nad wykresem (`MortalityTab`), więc wykres ma zwykły górny margines.
          ...getCommonPlotLayout(showLegend),
          xaxis: measureAxis({
            title: axisTitle(axisMode === "per_100k" ? "Hospitalizacje na 100 tys. mieszkańców" : "Liczba hospitalizacji", 18),
            range: paddedRange(xValues),
            ...(axisMode === "per_100k" ? {} : { tickformat: ",.0f" }),
          }),
          yaxis: measureAxis({
            title: axisTitle("Śmiertelność (%)", 18),
            range: paddedRange(yValues),
            ticksuffix: "%",
          }),
          // Linia średniej od 0,5% (`showsMortalityReference`), podpis „średnia: …” przy prawej krawędzi.
          shapes: [baselineShape("y"), baselineShape("x"), ...(showMean ? [referenceShape(meanPct)] : [])],
          annotations: showMean ? [referenceAnnotation(meanPct, meanPctLabel(meanPct))] : [],
        },
        PLOTLY_CONFIG,
      );

      const plot = chartRef.current as PlotElement;
      attachHoverMarker({ plot, Plotly, traces, hoverTraceIndex });
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [
    rows,
    axisMode,
    displayMode,
    highlightAreas,
    products,
    productByCode,
    regionByCode,
    funnel,
  ]);

  return <div className="plot-shell"><div ref={chartRef} className="plot" /></div>;
}