"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdmissionTab } from "@/components/AdmissionTab";
import { ExplorerContextBar } from "@/components/explorer/ExplorerContextBar";
import { RegionView } from "@/components/explorer/RegionView";
import { KpiStrip } from "@/components/KpiStrip";
import { MortalityTab } from "@/components/MortalityTab";
import { TrendView } from "@/components/trends/TrendView";
import { DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT, type DashboardNavigation } from "@/lib/dashboardNavigation";
import { dashboardUrlSearch, legacyAnalysisRedirect, readDashboardUrlState, resolveDashboardYear, type DashboardActiveTab } from "@/lib/dashboardUrlState";
import type { MortalityDisplayMode } from "@/lib/mortality";
import { jgpHref } from "@/lib/portalLinks";
import { admissionsFromDataset, loadHospitalizationIndex, loadStaticDataset, mortalityFromDataset, referenceFromDataset } from "@/lib/staticData";
import type { AdmissionPayload, AxisMode, EstimationMethod, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";
import styles from "./Explorer.module.css";

const EMPTY_KPI = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const EMPTY_GEO_STATS = { regions: [], cities: [] };
const EMPTY_DATA: MortalityPayload = { rows: [], current: EMPTY_KPI, baseline: EMPTY_KPI, hasComparison: false, areaStats: EMPTY_GEO_STATS, baselineAreaStats: EMPTY_GEO_STATS };
const EMPTY_ADMISSION_DATA: AdmissionPayload = { rows: [], areaStats: EMPTY_GEO_STATS };

/** Widoki-pytania eksploratora (kolejność zakładek). */
export const EXPLORER_VIEWS: { tab: DashboardActiveTab; label: string; question: string }[] = [
  { tab: "trend", label: "W czasie", question: "Jak zmieniała się liczba hospitalizacji?" },
  { tab: "mortality", label: "Kto leczy", question: "Którzy świadczeniodawcy leczą i z jaką śmiertelnością?" },
  { tab: "admissions", label: "Tryb przyjęcia", question: "Ile przyjęć jest planowych, a ile nagłych?" },
  { tab: "regions", label: "Gdzie", question: "Jak hospitalizacje rozkładają się na województwa?" },
];

/**
 * Eksplorator /analizy: wspólny kontekst (zakres JGP, okres, więcej filtrów) i widoki-pytania.
 * Cały stan jest w adresie URL.
 */
export function AnalysisExplorer() {
  const [reference, setReference] = useState<ReferencePayload | null>(null);
  const [data, setData] = useState<MortalityPayload>(EMPTY_DATA);
  const [admissionData, setAdmissionData] = useState<AdmissionPayload>(EMPTY_ADMISSION_DATA);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [durations, setDurations] = useState<string[]>([]);
  const [method, setMethod] = useState<EstimationMethod>("min");
  const [minHosp, setMinHosp] = useState(0);
  const [axisMode, setAxisMode] = useState<AxisMode>("total");
  const [admissionAxisMode, setAdmissionAxisMode] = useState<AxisMode>("total");
  const [geoMode, setGeoMode] = useState<GeographyMode>("regions");
  const [highlightedRegions, setHighlightedRegions] = useState<string[]>([]);
  const [highlightedCities, setHighlightedCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardActiveTab>("trend");
  const [jgpDisplayMode, setJgpDisplayMode] = useState<MortalityDisplayMode>("combined");
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [years, setYears] = useState<string[]>([]);
  const [latestYear, setLatestYear] = useState("");
  const [year, setYear] = useState("");

  // Most z nagłówkiem portalu: nagłówek wybiera widok, eksplorator zgłasza aktywny widok.
  useEffect(() => {
    const handleNavigation = (event: Event) => setActiveTab((event as CustomEvent<DashboardNavigation>).detail.tab);
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, handleNavigation);
    return () => window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, handleNavigation);
  }, []);

  useEffect(() => {
    if (!urlStateReady) return;
    window.dispatchEvent(new CustomEvent<DashboardNavigation>(DASHBOARD_TAB_CHANGED_EVENT, { detail: { tab: activeTab } }));
  }, [activeTab, urlStateReady]);

  useEffect(() => {
    const redirect = legacyAnalysisRedirect(window.location.search);
    if (redirect) {
      window.location.replace(redirect);
      return;
    }
    const load = async () => {
      try {
        const index = await loadHospitalizationIndex();
        const initialYear = resolveDashboardYear(new URLSearchParams(window.location.search).get("y") ?? undefined, index.years, index.latestYear);
        const payload = referenceFromDataset(await loadStaticDataset(initialYear));
        const urlState = readDashboardUrlState(payload, window.location.search);
        setSelectedProducts(urlState.selectedProducts);
        setDurations(urlState.durations);
        setMethod(urlState.method);
        setMinHosp(urlState.minHosp);
        setAxisMode(urlState.axisMode);
        setAdmissionAxisMode(urlState.admissionAxisMode);
        setGeoMode(urlState.geoMode);
        setHighlightedRegions(urlState.highlightedRegions);
        setHighlightedCities(urlState.highlightedCities);
        setActiveTab(urlState.activeTab);
        setYears(index.years);
        setLatestYear(index.latestYear);
        setYear(initialYear);
        setReference(payload);
        setUrlStateReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd inicjalizacji aplikacji.");
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Zmiana roku: nowy słownik (katalog JGP i placówki zależą od roku). Wybór zostaje, jeśli istnieje w nowym roku.
  useEffect(() => {
    if (!reference || !urlStateReady || !year || reference.analysisYear === year) return;
    let cancelled = false;
    const switchYear = async () => {
      try {
        const payload = referenceFromDataset(await loadStaticDataset(year));
        if (cancelled) return;
        const productCodes = new Set(payload.products.map((product) => product.code));
        const durationValues = new Set(payload.durations);
        const cityValues = new Set(payload.cities);
        setSelectedProducts((current) => current.filter((code) => productCodes.has(code)));
        setDurations((current) => current.filter((value) => durationValues.has(value)));
        setHighlightedCities((current) => current.filter((value) => cityValues.has(value)));
        setReference(payload);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Błąd pobierania danych.");
        setLoading(false);
      }
    };
    void switchYear();
    return () => { cancelled = true; };
  }, [reference, urlStateReady, year]);

  useEffect(() => {
    if (!reference || !urlStateReady) return;
    // Czekamy, aż słownik nowego roku zastąpi poprzedni.
    if (year && reference.analysisYear !== year) return;

    let cancelled = false;
    const refreshData = async () => {
      try {
        const dataset = await loadStaticDataset(reference.analysisYear);
        if (cancelled) return;
        if (selectedProducts.length === 0) {
          setData(EMPTY_DATA);
          setAdmissionData(EMPTY_ADMISSION_DATA);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        const query = { products: selectedProducts, durations, method, minHosp };
        setData(mortalityFromDataset(dataset, query));
        setAdmissionData(admissionsFromDataset(dataset, query));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Błąd pobierania danych.");
        setLoading(false);
      }
    };
    void refreshData();
    return () => { cancelled = true; };
  }, [reference, urlStateReady, year, selectedProducts, durations, method, minHosp]);

  useEffect(() => {
    if (!reference || !urlStateReady) return;
    const search = dashboardUrlSearch(reference, {
      selectedProducts, durations, method, minHosp, axisMode, admissionAxisMode, geoMode,
      highlightedRegions, highlightedCities, activeTab, year,
    }, latestYear);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [reference, urlStateReady, selectedProducts, durations, method, minHosp, axisMode, admissionAxisMode, geoMode, highlightedRegions, highlightedCities, activeTab, year, latestYear]);

  if (!reference && loading) return <main className="center-state">Ładowanie analiz…</main>;
  if (!reference) return <main className="center-state error">{error ?? "Brak konfiguracji."}</main>;

  const range = years.length > 1 ? `${years[0]}–${years.at(-1)}` : reference.analysisYear;
  const activeView = EXPLORER_VIEWS.find((view) => view.tab === activeTab) ?? EXPLORER_VIEWS[0];
  // Strona grupy JGP, gdy wybrano jedną grupę, która ma już stronę.
  const singleProduct = selectedProducts.length === 1 ? reference.products.find((product) => product.code === selectedProducts[0]) : undefined;
  const groupPage = jgpHref(singleProduct?.jgpCode);

  return <main className={styles.explorer}>
    <header className={styles.header}>
      <div>
        <h1>Analizy hospitalizacji</h1>
        <p>Hospitalizacje rozliczone w grupach JGP · dane NFZ {range}</p>
      </div>
      {groupPage ? <Link className={styles.groupLink} href={groupPage}>Wszystko o grupie {singleProduct?.jgpCode} →</Link> : null}
    </header>

    <ExplorerContextBar
      view={activeTab}
      reference={reference}
      years={years}
      year={year || reference.analysisYear}
      setYear={setYear}
      selectedProducts={selectedProducts}
      setSelectedProducts={setSelectedProducts}
      method={method}
      setMethod={setMethod}
      minHosp={minHosp}
      setMinHosp={setMinHosp}
      durations={durations}
      setDurations={setDurations}
      geoMode={geoMode}
      setGeoMode={setGeoMode}
      highlightedRegions={highlightedRegions}
      setHighlightedRegions={setHighlightedRegions}
      highlightedCities={highlightedCities}
      setHighlightedCities={setHighlightedCities}
    />

    <nav className="tabs" aria-label="Widoki analizy">
      {EXPLORER_VIEWS.map((view) => <button
        key={view.tab}
        type="button"
        className={activeTab === view.tab ? "active" : undefined}
        aria-current={activeTab === view.tab ? "page" : undefined}
        onClick={() => setActiveTab(view.tab)}
      >{view.label}</button>)}
    </nav>
    <p className={styles.question}>{activeView.question}</p>

    {activeTab === "mortality" || activeTab === "admissions" ? <KpiStrip current={data.current} baseline={data.baseline} compare={data.hasComparison} /> : null}

    {activeTab === "trend" ? <TrendView productCodes={selectedProducts} method={method} />
      : activeTab === "regions" ? <RegionView productCodes={selectedProducts} year={reference.analysisYear} method={method} />
      : activeTab === "mortality" ? <MortalityTab
        reference={reference}
        data={data}
        loading={loading}
        error={error}
        selectedProducts={selectedProducts}
        axisMode={axisMode}
        setAxisMode={setAxisMode}
        geoMode={geoMode}
        highlightedRegions={highlightedRegions}
        highlightedCities={highlightedCities}
        displayMode={jgpDisplayMode}
        setDisplayMode={setJgpDisplayMode}
      /> : <AdmissionTab
        reference={reference}
        data={admissionData}
        loading={loading}
        error={error}
        selectedProducts={selectedProducts}
        axisMode={admissionAxisMode}
        setAxisMode={setAdmissionAxisMode}
        geoMode={geoMode}
        highlightedRegions={highlightedRegions}
        highlightedCities={highlightedCities}
        displayMode={jgpDisplayMode}
        setDisplayMode={setJgpDisplayMode}
      />}
  </main>;
}
