"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  admissionRowsPerJgp,
  aggregateAdmissionRowsByProvider,
  type AdmissionDisplayRow,
} from "@/lib/admissions";
import { formatCityName } from "@/lib/formatters";
import type { MortalityDisplayMode } from "@/lib/mortality";
import { BASE_POINT, OTHER_POINT } from "@/lib/chartPalette";
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
  PLOT_TOOLBAR_MARGIN,
  HIGHLIGHT_COLORS,
  makeDimensionLegendTraces,
  makeHoverTrace,
  PLOTLY_CONFIG,
  PRODUCT_SYMBOLS,
  type PlotElement,
} from "@/lib/plotlyChart";
import { ratioPct } from "@/lib/metrics";
import type { AdmissionRow, AxisMode, ProductOption, RegionOption } from "@/lib/types";

export function AdmissionChart({
  rows,
  axisMode,
  displayMode,
  highlightAreas,
  products,
  regions,
}: {
  rows: AdmissionRow[];
  axisMode: AxisMode;
  displayMode: MortalityDisplayMode;
  /** Obszary wyróżnione kolorami (kolejność = kolejność kolorów); reszta punktów jest szara. */
  highlightAreas: AnalysisArea[];
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

      const geoSelection = highlightAreas.map(areaToValue);
      const geoLabel = (key: string) => {
        const area = areaFromValue(key);
        return area.kind === "region" ? (regionByCode.get(area.owNfz) ?? `Województwo ${area.owNfz}`) : area.kind === "city" ? formatCityName(area.city) : key;
      };

      // Bez wyróżnienia punkty są niebieskie; z wyróżnieniem pozostałe szare (jak na karcie grupy JGP).
      const restColor = geoSelection.length ? OTHER_POINT : BASE_POINT;
      const isCombined = displayMode === "combined";
      const showLegend = geoSelection.length > 0 || (!isCombined && productCodes.length > 1);

      const makeTrace = (
        subset: AdmissionDisplayRow[],
        productIndex: number,
        name: string,
        color: string,
        emphasized = false,
      ) => ({
        type: "scattergl",
        mode: "markers",
        name,
        showlegend: false,
        x: subset.map((row) => axisMode === "per_100k"
          ? row.plannedAdmissionsPer100k
          : row.plannedAdmissions),
        y: subset.map((row) => axisMode === "per_100k"
          ? row.urgentAdmissionsPer100k
          : row.urgentAdmissions),
        customdata: subset.map((row) => {
          const ratio = ratioPct(row.plannedAdmissions, row.urgentAdmissions);
          return [
            row.providerName,
            row.nip,
            row.owNfz,
            regionByCode.get(row.owNfz) ?? row.voivodeship,
            formatCityName(row.city),
            row.plannedAdmissions,
            row.urgentAdmissions,
            row.totalAdmissions,
            row.plannedAdmissionsPer100k,
            row.urgentAdmissionsPer100k,
            ratio === null
              ? "—"
              : `${ratio.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
            row.productCodes
              .map((code) => productByCode.get(code)?.jgpCode ?? code)
              .join(", "),
          ];
        }),
        marker: {
          size: emphasized ? 11 : 9,
          // Kolory tła mają już przezroczystość z palety.
          opacity: emphasized ? 0.94 : 1,
          symbol: isCombined || productCodes.length === 1
            ? "circle"
            : PRODUCT_SYMBOLS[productIndex % PRODUCT_SYMBOLS.length],
          color,
          line: { width: emphasized ? 0.8 : 0.4, color: "#FFFFFF" },
        },
        // Kolejność dymka: nazwa, kontekst, oś Y (nagłe), oś X (planowe), stosunek, NIP na końcu.
        hovertemplate: hoverTemplate({
          title: "%{customdata[0]}",
          context: "%{customdata[4]} · %{customdata[3]} · %{customdata[11]}",
          rows: axisMode === "per_100k"
            ? [
              { label: "Nagłe (2+3) na 100 tys.", value: "%{customdata[9]:,.2f}" },
              { label: "Planowe (6) na 100 tys.", value: "%{customdata[8]:,.2f}" },
              { label: "Planowe / nagłe", value: "%{customdata[10]}" },
            ]
            : [
              { label: "Nagłe (2+3)", value: "%{customdata[6]:,.0f}" },
              { label: "Planowe (6)", value: "%{customdata[5]:,.0f}" },
              { label: "Planowe / nagłe", value: "%{customdata[10]}" },
            ],
          footer: "NIP %{customdata[1]}",
        }),
      });

      const traces: Record<string, unknown>[] = [];

      if (isCombined) {
        const chartRows = aggregateAdmissionRowsByProvider(rows);
        const remaining = chartRows.filter(
          (row) => areaHighlightKey(highlightAreas, row) === null,
        );

        if (remaining.length > 0) {
          traces.push(makeTrace(remaining, 0, "Pozostałe", restColor));
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
          const productRows = admissionRowsPerJgp(
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

      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());

      await Plotly.react(chartRef.current, traces, {
        ...getCommonPlotLayout(showLegend),
        margin: { ...getCommonPlotLayout(showLegend).margin, t: PLOT_TOOLBAR_MARGIN },
        // Ten sam margines na obu osiach (−6% / +10%); zero rysuje podstawa pod danymi.
        xaxis: measureAxis({
          title: axisTitle(axisMode === "per_100k" ? "Przyjęcia planowane na 100 tys. mieszkańców" : "Liczba przyjęć planowanych", 18),
          range: paddedRange(traces.flatMap((trace) => (trace.x as (number | null)[] | undefined) ?? [])),
          ...(axisMode === "per_100k" ? {} : { tickformat: ",.0f" }),
        }),
        yaxis: measureAxis({
          title: axisTitle(axisMode === "per_100k" ? "Przyjęcia nagłe na 100 tys. mieszkańców" : "Liczba przyjęć nagłych", 18),
          range: paddedRange(traces.flatMap((trace) => (trace.y as (number | null)[] | undefined) ?? [])),
          ...(axisMode === "per_100k" ? {} : { tickformat: ",.0f" }),
        }),
        shapes: [baselineShape("y"), baselineShape("x")],
      }, PLOTLY_CONFIG);

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
  ]);

  return <div className="plot-shell"><div ref={chartRef} className="plot" /></div>;
}
