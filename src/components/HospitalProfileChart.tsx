"use client";

import { useEffect, useMemo, useRef } from "react";
import type { HospitalProfileRow } from "@/lib/types";
import { getAppFontFamily, PLOTLY_CONFIG } from "@/lib/plotlyChart";
import { JGP_SECTION_NAMES, getJgpSection } from "@/lib/jgpSections";

interface SectionRow {
  section: string;
  name: string;
  hospitalizations: number;
  jgpGroups: number;
  sharePct: number;
}

export function HospitalProfileChart({ rows }: { rows: HospitalProfileRow[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  const sections = useMemo<SectionRow[]>(() => {
    const bySection = new Map<string, { hospitalizations: number; jgpGroups: number }>();
    const total = rows.reduce((sum, row) => sum + row.hospitalizations, 0);

    for (const row of rows) {
      const section = getJgpSection(row.jgpCode);
      if (!section) continue;
      const current = bySection.get(section) ?? { hospitalizations: 0, jgpGroups: 0 };
      current.hospitalizations += row.hospitalizations;
      current.jgpGroups += 1;
      bySection.set(section, current);
    }

    return Array.from(bySection.entries())
      .map(([section, values]) => ({
        section,
        name: JGP_SECTION_NAMES[section] ?? "Sekcja JGP",
        hospitalizations: values.hospitalizations,
        jgpGroups: values.jgpGroups,
        sharePct: total > 0 ? values.hospitalizations / total * 100 : 0,
      }))
      .sort((a, b) => b.hospitalizations - a.hospitalizations || a.section.localeCompare(b.section));
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current) return;
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !chartRef.current) return;

      await Plotly.react(chartRef.current, [{
        type: "bar",
        x: sections.map((row) => row.section),
        y: sections.map((row) => row.hospitalizations),
        customdata: sections.map((row) => [row.name, row.jgpGroups, row.sharePct]),
        marker: { color: "#2856A3", opacity: 0.88 },
        hovertemplate: [
          "<b>Sekcja %{x}</b>",
          "%{customdata[0]}",
          "Hospitalizacje: %{y:,.0f}",
          "Kody JGP w sekcji: %{customdata[1]}",
          "Udział w hospitalizacjach szpitala: %{customdata[2]:.1f}%",
          "<extra></extra>",
        ].join("<br>"),
      }], {
        height: 430,
        autosize: true,
        margin: { l: 78, r: 24, t: 18, b: 72 },
        paper_bgcolor: "#FFFFFF",
        plot_bgcolor: "#FFFFFF",
        showlegend: false,
        bargap: 0.24,
        font: { family: getAppFontFamily(), color: "#172033", size: 12 },
        xaxis: {
          title: { text: "Sekcja JGP", standoff: 16, font: { size: 14, color: "#344054" } },
          tickfont: { size: 11, color: "#667085" },
          categoryorder: "array",
          categoryarray: sections.map((row) => row.section),
        },
        yaxis: {
          title: { text: "Liczba hospitalizacji", standoff: 14, font: { size: 14, color: "#344054" } },
          tickfont: { size: 11, color: "#667085" },
          gridcolor: "#EEF1F5",
          zerolinecolor: "#EEF1F5",
        },
        hoverlabel: { bgcolor: "#5F6672", font: { color: "#FFFFFF", size: 13 } },
      }, PLOTLY_CONFIG);
    };
    void render();
    return () => { cancelled = true; };
  }, [sections]);

  return <div className="plot-shell hospital-profile-plot-shell"><div ref={chartRef} className="plot" /></div>;
}
