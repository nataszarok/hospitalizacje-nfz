"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  attachHoverMarker,
  getCommonPlotLayout,
  getGeoKey,
  getGeoSelection,
  HIGHLIGHT_COLORS,
  makeHoverTrace,
  PLOTLY_CONFIG,
} from "@/lib/plotlyChart";
import { ratioPct } from "@/lib/metrics";
import type { AdmissionRow, AxisMode, GeographyMode, RegionOption } from "@/lib/types";

export function AdmissionChart({ rows, axisMode, geographyMode, highlightedRegions, highlightedCities, regions }: {
  rows: AdmissionRow[];
  axisMode: AxisMode;
  geographyMode: GeographyMode;
  highlightedRegions: string[];
  highlightedCities: string[];
  regions: RegionOption[];
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const regionByCode = useMemo(() => new Map(regions.map((r) => [r.owNfz, r.name])), [regions]);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !chartRef.current) return;

      const geoSelection = getGeoSelection(geographyMode, highlightedRegions, highlightedCities);
      const geoLabel = (key: string) => geographyMode === "regions" ? (regionByCode.get(key) ?? `Województwo ${key}`) : key;
      const showLegend = geoSelection.length > 0;

      const makeTrace = (subset: AdmissionRow[], name: string, color: string, emphasized = false) => ({
        type: "scattergl",
        mode: "markers",
        name,
        x: subset.map((row) => axisMode === "per_100k" ? row.plannedAdmissionsPer100k : row.plannedAdmissions),
        y: subset.map((row) => axisMode === "per_100k" ? row.urgentAdmissionsPer100k : row.urgentAdmissions),
        customdata: subset.map((row) => {
          const ratio = ratioPct(row.plannedAdmissions, row.urgentAdmissions);
          return [
            row.providerName,
            row.nip,
            row.owNfz,
            regionByCode.get(row.owNfz) ?? row.voivodeship,
            row.city,
            row.plannedAdmissions,
            row.urgentAdmissions,
            row.totalAdmissions,
            row.plannedAdmissionsPer100k,
            row.urgentAdmissionsPer100k,
            ratio === null ? "—" : `${ratio.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
          ];
        }),
        marker: {
          size: emphasized ? 11 : 9,
          opacity: emphasized ? 0.94 : 0.68,
          symbol: "circle",
          color,
          line: { width: emphasized ? 0.8 : 0.4, color: "#FFFFFF" },
        },
        hovertemplate: [
          "<b>%{customdata[0]}</b>",
          "NIP: %{customdata[1]}",
          "Województwo: %{customdata[3]}",
          "Miejscowość: %{customdata[4]}",
          "Planowane (6): %{customdata[5]:,.0f}",
          "Nagłe (2+3): %{customdata[6]:,.0f}",
          "Planowane / nagłe: %{customdata[10]}",
          axisMode === "per_100k" ? "Planowane / 100 tys.: %{customdata[8]:,.2f}" : "",
          axisMode === "per_100k" ? "Nagłe / 100 tys.: %{customdata[9]:,.2f}" : "",
          "<extra></extra>",
        ].filter(Boolean).join("<br>"),
      });

      const traces: Record<string, unknown>[] = [];
      const remaining = rows.filter((row) => !geoSelection.includes(getGeoKey(row, geographyMode)));
      if (remaining.length > 0) traces.push(makeTrace(remaining, "Pozostali świadczeniodawcy", "#C7CBD1"));

      geoSelection.forEach((key, geoIndex) => {
        const subset = rows.filter((row) => getGeoKey(row, geographyMode) === key);
        if (subset.length > 0) traces.push(makeTrace(subset, geoLabel(key), HIGHLIGHT_COLORS[geoIndex % HIGHLIGHT_COLORS.length], true));
      });

      const hoverTraceIndex = traces.length;
      traces.push(makeHoverTrace());

      await Plotly.react(chartRef.current, traces, {
        ...getCommonPlotLayout(showLegend),
        xaxis: {
          title: { text: axisMode === "per_100k" ? "Przyjęcia planowane na 100 tys. mieszkańców (kod 6)" : "Liczba przyjęć planowanych (kod 6)", standoff: 18, font: { size: 15, color: "#344054" } },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#EEF1F5",
          zerolinewidth: 3,
        },
        yaxis: {
          title: { text: axisMode === "per_100k" ? "Przyjęcia nagłe na 100 tys. mieszkańców (kody 2 + 3)" : "Liczba przyjęć nagłych (kody 2 + 3)", standoff: 18, font: { size: 15, color: "#344054" } },
          tickfont: { size: 11, color: "#667085" },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#EEF1F5",
          zerolinewidth: 3,
        },
      }, PLOTLY_CONFIG);

      const plot = chartRef.current as HTMLDivElement & {
        on: (event: string, handler: (event: any) => void) => void;
        removeAllListeners: (event: string) => void;
      };
      attachHoverMarker({ plot, Plotly, traces, hoverTraceIndex });
    };
    void render();
    return () => { cancelled = true; };
  }, [rows, axisMode, geographyMode, highlightedRegions, highlightedCities, regionByCode]);

  return <div className="plot-shell"><div ref={chartRef} className="plot" /></div>;
}
