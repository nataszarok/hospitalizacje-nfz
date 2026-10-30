"use client";

import { SegmentedControl } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { TrendChart, type TrendGranularity, type TrendMeasure } from "@/components/trends/TrendChart";
import { loadRegionalTrends, loadTrends, productTrend, trendsForRegion, type RegionalTrendsDataset, type TrendsDataset } from "@/lib/staticData";
import { incompleteCoverage, trendSummary } from "@/lib/trends";
import type { EstimationMethod } from "@/lib/types";
import styles from "./TrendView.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const pct = (value: number, signed = false) =>
  `${signed && value > 0 ? "+" : ""}${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export type TrendViewProps = {
  productCodes: string[];
  method: EstimationMethod;
  /** OW NFZ: trend tylko dla świadczeniodawców z tego województwa (brak = cała Polska). */
  region?: string | null;
  /** Nazwa obszaru w opisie wykresu, np. „woj. mazowieckie”. */
  areaLabel?: string;
  /** Dodatkowa uwaga o obszarze, np. gdy dla miasta pokazujemy województwo. */
  areaNote?: string | null;
};

/**
 * Widok „W czasie”: trend hospitalizacji dla wybranych produktów we wszystkich latach.
 * Niezależny od układu dashboardu — używa go zakładka w /analizy i strona grupy JGP.
 */
export function TrendView({ productCodes, method, region = null, areaLabel, areaNote }: TrendViewProps) {
  const [national, setNational] = useState<TrendsDataset | null>(null);
  const [regional, setRegional] = useState<RegionalTrendsDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<TrendGranularity>("month");
  const [measure, setMeasure] = useState<TrendMeasure>("hospitalizations");

  useEffect(() => {
    let cancelled = false;
    loadTrends()
      .then((data) => { if (!cancelled) setNational(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania trendów."); });
    return () => { cancelled = true; };
  }, []);

  // Plik regionalny pobieramy dopiero przy wyborze województwa.
  useEffect(() => {
    if (!region || regional) return;
    let cancelled = false;
    loadRegionalTrends()
      .then((data) => { if (!cancelled) setRegional(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania trendów regionalnych."); });
    return () => { cancelled = true; };
  }, [region, regional]);

  const trends = useMemo(() => {
    if (!national) return null;
    if (!region) return national;
    return regional ? trendsForRegion(national, regional, region) : null;
  }, [national, regional, region]);

  const trend = useMemo(() => trends && productCodes.length ? productTrend(trends, productCodes, method) : null, [trends, productCodes, method]);
  const gaps = useMemo(() => trends ? incompleteCoverage(trends, productCodes) : [], [trends, productCodes]);
  const summary = useMemo(() => trend ? trendSummary(trend, gaps) : null, [trend, gaps]);

  if (error) return <div className="alert">{error}</div>;
  if (!productCodes.length) return <div className="empty-chart">Wybierz co najmniej jeden produkt.</div>;
  if (!trends || !trend) return <div className="empty-chart">Ładowanie trendów…</div>;

  const years = trends.years;
  const range = `${years[0]}–${years.at(-1)}`;
  const cards = summary ? [
    { label: `Hospitalizacje ${summary.year}`, value: integer(summary.hospitalizations), note: `łącznie ${range}: ${integer(trend.yearly.reduce((s, p) => s + (p?.hospitalizations ?? 0), 0))}` },
    { label: "Zmiana rok do roku", value: summary.changePct === null ? "—" : pct(summary.changePct, true), note: !summary.previousYear ? "brak roku do porównania" : summary.changePct === null ? "inny zestaw grup JGP w porównywanych latach" : `względem ${summary.previousYear}` },
    { label: `Zgony ${summary.year}`, value: integer(summary.deaths), note: `śmiertelność ${pct(summary.mortalityPct)}` },
    { label: `Przyjęcia nagłe ${summary.year}`, value: pct(summary.urgentPct), note: "udział w hospitalizacjach" },
  ] : [];

  return <div className={styles.view}>
    <div className={styles.kpis}>
      {cards.map((card) => <section key={card.label} className={styles.kpi}>
        <div className={styles.kpiLabel}>{card.label}</div>
        <div className={styles.kpiValue}>{card.value}</div>
        <div className={styles.kpiNote}>{card.note}</div>
      </section>)}
    </div>

    <section className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h2>Hospitalizacje w latach {range}</h2>
          <p>{granularity === "month" ? "Liczba w kolejnych miesiącach." : "Suma w kolejnych latach."} Wszystkie wybrane produkty razem{areaLabel ? ` · ${areaLabel}` : ""}.</p>
          {areaNote ? <p className={styles.areaNote}>{areaNote}</p> : null}
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            aria-label="Miara"
            value={measure}
            onChange={(value) => setMeasure(value as TrendMeasure)}
            data={[
              { value: "hospitalizations", label: "Hospitalizacje" },
              { value: "admission", label: "Tryb przyjęcia" },
              { value: "deaths", label: "Zgony" },
            ]}
            size="xs"
          />
          <SegmentedControl
            aria-label="Okres"
            value={granularity}
            onChange={(value) => setGranularity(value as TrendGranularity)}
            data={[{ value: "month", label: "Miesiące" }, { value: "year", label: "Lata" }]}
            size="xs"
          />
        </div>
      </div>

      <TrendChart trend={trend} years={years} granularity={granularity} measure={measure} />

      {gaps.length ? <ul className={styles.gaps} aria-label="Zmiany katalogu JGP">
        {gaps.map((gap) => <li key={gap.code}>
          Grupa <strong>{gap.jgpCode ?? gap.code}</strong> występuje w danych tylko w latach: {gap.years.join(", ")} (zmiana katalogu JGP). Lata bez tej grupy są przerwą na wykresie, nie zerem.
        </li>)}
      </ul> : null}
    </section>

    <details className="data-details">
      <summary>Tabela danych · lata</summary>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Rok</th><th>Hospitalizacje</th><th>Zgony</th><th>Śmiertelność</th><th>Planowe</th><th>Nagłe</th></tr></thead>
          <tbody>
            {years.map((year, i) => {
              const point = trend.yearly[i];
              return <tr key={year}>
                <td>{year}</td>
                {point ? <>
                  <td>{integer(point.hospitalizations)}</td>
                  <td>{integer(point.deaths)}</td>
                  <td>{pct(point.hospitalizations ? (point.deaths / point.hospitalizations) * 100 : 0)}</td>
                  <td>{integer(point.planned)}</td>
                  <td>{integer(point.urgent)}</td>
                </> : <td colSpan={5}>brak wybranych grup w katalogu JGP</td>}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </details>
  </div>;
}
