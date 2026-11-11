"use client";

import { useEffect, useMemo, useState } from "react";
import { MortalityDisplayControl } from "@/components/MortalityDisplayControl";
import { GroupLineChart, type ChartLine } from "@/components/jgp/GroupLineChart";
import { CHART_COLORS, REGION_PICK_COLORS } from "@/lib/chartPalette";
import type { ChartPeriod } from "@/lib/jgpCard";
import type { MortalityDisplayMode } from "@/lib/mortality";
import { citySection, durationYears, type DurationYearsSection } from "@/lib/regions";
import { loadDurationYearsSection, loadRegionalTrends, loadTrends, peekTrends, productTrend, trendsForRegions, type RegionalTrendsDataset, type TrendsDataset } from "@/lib/staticData";
import { TREND_METRICS, type TrendMetric } from "@/lib/trendMetrics";
import { durationChartData, incompleteCoverage, trendChartLines, trendMonths } from "@/lib/trends";
import type { EstimationMethod } from "@/lib/types";
import styles from "./TrendView.module.css";

const NO_REGIONS: string[] = [];
const NO_DURATIONS: string[] = [];
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const pct = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
/** Kolory grup w zestawieniu „Per JGP”: niebieski danych, potem paleta wyróżnień z karty grupy JGP. */
const GROUP_COLORS = [CHART_COLORS.data, ...REGION_PICK_COLORS];

export type TrendViewProps = {
  productCodes: string[];
  method: EstimationMethod;
  /** OW NFZ: trend tylko dla świadczeniodawców z tych województw, suma (pusta lista = cała Polska). */
  regions?: string[];
  /** Filtr długości pobytu: wtedy wykres pokazuje lata (trend miesięczny nie ma podziału na długość pobytu). */
  durations?: string[];
  /** Nazwa obszaru w opisie wykresu, np. „woj. mazowieckie”. */
  areaLabel?: string;
  /** Dodatkowa uwaga o obszarze, np. gdy widok pominął wybrane miasta. */
  areaNote?: string | null;
  /** Zestawienie JGP: „Zbiorczo” (suma) albo „Per JGP” (seria na grupę). Przełącznik tylko przy ≥ 2 grupach i z `onDisplayModeChange`. */
  displayMode?: MortalityDisplayMode;
  onDisplayModeChange?: (value: MortalityDisplayMode) => void;
};

/**
 * Widok „W czasie”: hospitalizacje, śmiertelność i udział przyjęć nagłych wybranych grup we wszystkich latach.
 * Wykres jak na karcie grupy JGP (`GroupLineChart`): kropka = miesiąc, linia = średnia z 3 miesięcy.
 */
export function TrendView({ productCodes, method, regions = NO_REGIONS, areaLabel, areaNote, durations = NO_DURATIONS, displayMode = "combined", onDisplayModeChange }: TrendViewProps) {
  // Trendy już w pamięci (pobrane z wyprzedzeniem): wykres w pierwszym renderze, bez pustego miejsca.
  const [national, setNational] = useState<TrendsDataset | null>(peekTrends);
  const [regional, setRegional] = useState<{ key: string; files: RegionalTrendsDataset[] } | null>(null);
  const [durationData, setDurationData] = useState<{ key: string; files: DurationYearsSection[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>("month");
  const [metric, setMetric] = useState<TrendMetric>("hospitalizations");

  useEffect(() => {
    let cancelled = false;
    loadTrends()
      .then((data) => { if (!cancelled) setNational(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania trendów."); });
    return () => { cancelled = true; };
  }, []);

  // Pliki województw pobieramy dopiero przy ich wyborze (osobny plik na każdy OW NFZ).
  const regionKey = regions.join(",");
  useEffect(() => {
    if (!regionKey) return;
    let cancelled = false;
    Promise.all(regionKey.split(",").map(loadRegionalTrends))
      .then((files) => { if (!cancelled) setRegional({ key: regionKey, files }); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania trendów regionalnych."); });
    return () => { cancelled = true; };
  }, [regionKey]);

  const trends = useMemo(() => {
    if (!national) return null;
    if (!regionKey) return national;
    return regional?.key === regionKey ? trendsForRegions(national, regional.files) : null;
  }, [national, regional, regionKey]);

  // Filtr długości pobytu: pliki lat według długości pobytu, tylko sekcje katalogu JGP wybranych grup.
  const filtered = durations.length > 0;
  const sectionKey = useMemo(() => {
    if (!national || !filtered) return "";
    const jgpCodes = new Map(national.products.map(([code, jgpCode]) => [code, jgpCode]));
    return [...new Set(productCodes.map((code) => citySection(jgpCodes.get(code))))].sort().join(",");
  }, [national, filtered, productCodes]);
  useEffect(() => {
    if (!sectionKey) return;
    let cancelled = false;
    Promise.all(sectionKey.split(",").map(loadDurationYearsSection))
      .then((files) => { if (!cancelled) setDurationData({ key: sectionKey, files }); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania danych długości pobytu."); });
    return () => { cancelled = true; };
  }, [sectionKey]);
  const durationSeries = useMemo(() => national && filtered && durationData?.key === sectionKey
    ? durationYears(durationData.files, national.years, productCodes, method, durations, regions)
    : null, [national, filtered, durationData, sectionKey, productCodes, method, durations, regions]);

  const canBreakdown = Boolean(onDisplayModeChange) && productCodes.length >= 2;
  const perGroup = canBreakdown && displayMode === "per_jgp";
  const trend = useMemo(() => trends && productCodes.length ? productTrend(trends, productCodes, method) : null, [trends, productCodes, method]);
  const gaps = useMemo(() => trends ? incompleteCoverage(trends, productCodes) : [], [trends, productCodes]);
  const chart = useMemo((): { months: string[]; lines: ChartLine[] } => {
    if (!trends || !productCodes.length) return { months: [], lines: [] };
    let data: { months: string[]; lines: { key: string; name: string; values: number[]; base?: number[] }[] };
    if (filtered) {
      if (!durationSeries) return { months: [], lines: [] };
      data = durationChartData(durationSeries, trends.years, metric, perGroup, new Map(trends.products.map(([code, jgpCode]) => [code, jgpCode])));
    } else {
      const months = trendMonths(trends, productCodes);
      data = { months, lines: trendChartLines(trends, productCodes, method, metric, perGroup, months) };
    }
    return { months: data.months, lines: data.lines.map((line, i) => perGroup
      ? { ...line, color: GROUP_COLORS[i % GROUP_COLORS.length] }
      : { ...line, tone: "primary" as const }) };
  }, [trends, productCodes, method, metric, perGroup, filtered, durationSeries]);
  const { months, lines } = chart;
  // Lata tabeli: z filtrem długości pobytu suma produktów z pliku długości pobytu (bez planowych).
  const yearlyRows = useMemo(() => {
    if (!trends || !trend) return [];
    if (!filtered) return trend.yearly.map((point) => point ? { ...point, planned: point.planned as number | null } : null);
    if (!durationSeries) return trends.years.map(() => null);
    return trends.years.map((year, i) => {
      const parts = [...durationSeries.values()].map((points) => points[i]).filter((p): p is NonNullable<typeof p> => p !== null);
      return parts.length ? { year, hospitalizations: parts.reduce((s, p) => s + p.hospitalizations, 0), deaths: parts.reduce((s, p) => s + p.deaths, 0), urgent: parts.reduce((s, p) => s + p.urgent, 0), planned: null as number | null } : null;
    });
  }, [trends, trend, filtered, durationSeries]);

  if (error) return <div className="alert">{error}</div>;
  if (!productCodes.length) return <div className="empty-chart">Wybierz co najmniej jedną grupę JGP.</div>;
  if (!trends || !trend || (filtered && !durationSeries)) return <div className="empty-chart">Ładowanie trendów…</div>;

  const years = trends.years;
  const shown = TREND_METRICS[metric];
  const range = months.length ? `${months[0].slice(0, 4)}–${months.at(-1)!.slice(0, 4)}` : `${years[0]}–${years.at(-1)}`;
  // Z filtrem długości pobytu tylko lata: dane miesięczne nie mają podziału na długość pobytu.
  const shownPeriod: ChartPeriod = filtered ? "year" : period;
  const periodWord = shownPeriod === "year" ? "rocznie" : "miesięcznie";

  return <div className={styles.view}>
    <section className={styles.chartCard}>
      <div className={styles.metricTabs} role="tablist" aria-label="Miara">
        {(Object.keys(TREND_METRICS) as TrendMetric[]).map((key) => <button
          key={key}
          type="button"
          role="tab"
          aria-selected={metric === key}
          className={metric === key ? styles.metricTabActive : undefined}
          onClick={() => setMetric(key)}
        >{TREND_METRICS[key].title}</button>)}
      </div>

      <div className={styles.chartHeader}>
        <div>
          <h2>{shown.title} {periodWord} · {range}</h2>
          <p>{perGroup ? "Każda grupa JGP osobno" : "Wszystkie wybrane grupy razem"}{areaLabel ? ` · ${areaLabel}` : ""}{filtered ? ` · długość pobytu: ${durations.join(", ")}` : ""}.</p>
          {areaNote ? <p className={styles.areaNote}>{areaNote}</p> : null}
        </div>
        <div className={styles.controls}>
          {canBreakdown ? <MortalityDisplayControl value={displayMode} onChange={onDisplayModeChange!} /> : null}
          <div className={styles.periodToggle} role="group" aria-label="Okres na wykresie">
            <button type="button" aria-pressed={shownPeriod === "month"} disabled={filtered} title={filtered ? "Dane miesięczne nie mają podziału na długość pobytu" : undefined} onClick={() => setPeriod("month")}>Miesiące</button>
            <button type="button" aria-pressed={shownPeriod === "year"} onClick={() => setPeriod("year")}>Lata</button>
          </div>
        </div>
      </div>

      <GroupLineChart
        months={months}
        lines={lines}
        valueLabel={shown.unit}
        legend={perGroup}
        height={400}
        fitAxis={!perGroup && metric === "urgent"}
        note={shown.note[shownPeriod]}
        period={shownPeriod}
        ariaLabel={`Wykres liniowy: ${shown.title.toLowerCase()} ${periodWord} w latach ${range}`}
      />

      {gaps.length ? <ul className={styles.gaps} aria-label="Zmiany katalogu JGP">
        {gaps.map((gap) => <li key={gap.code}>
          Grupa <strong>{gap.jgpCode ?? gap.code}</strong> występuje w danych tylko w latach: {gap.years.join(", ")} (zmiana katalogu JGP). W latach bez tej grupy wykres pokazuje zero.
        </li>)}
      </ul> : null}
    </section>

    <details className="data-details">
      <summary>Tabela danych · lata</summary>
      {/* Priorytety kolumn (DESIGN.md 7.1): w wąskim kontenerze zostają rok, hospitalizacje i śmiertelność. */}
      <div className="table-wrap priority-table">
        <table>
          <thead><tr><th>Rok</th><th>Hospitalizacje</th><th className="col-p2">Zgony</th><th>Śmiertelność</th><th className="col-p3">Planowe</th><th className="col-p2">Nagłe</th></tr></thead>
          <tbody>
            {years.map((year, i) => {
              const point = yearlyRows[i];
              return <tr key={year}>
                <td>{year}</td>
                {point ? <>
                  <td>{integer(point.hospitalizations)}</td>
                  <td className="col-p2">{integer(point.deaths)}</td>
                  <td>{pct(point.hospitalizations ? (point.deaths / point.hospitalizations) * 100 : 0)}</td>
                  <td className="col-p3">{point.planned === null ? "—" : integer(point.planned)}</td>
                  <td className="col-p2">{integer(point.urgent)}</td>
                </> : <td colSpan={5}>brak wybranych grup w katalogu JGP</td>}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </details>
  </div>;
}
