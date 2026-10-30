"use client";

import { useEffect, useState } from "react";
import { DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT, type DashboardNavigation } from "@/lib/dashboardNavigation";
import { AdmissionTab } from "@/components/AdmissionTab";
import { KpiStrip } from "@/components/KpiStrip";
import { HospitalAnalysisTab } from "@/components/HospitalAnalysisTab";
import { MethodologyPanel } from "@/components/MethodologyPanel";
import { MortalityTab } from "@/components/MortalityTab";
import { Sidebar } from "@/components/Sidebar";
import { TrendView } from "@/components/trends/TrendView";
import type { AdmissionPayload, AxisMode, EstimationMethod, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";
import { dashboardUrlSearch, readDashboardUrlState, resolveDashboardYear, type DashboardActiveTab } from "@/lib/dashboardUrlState";
import { admissionsFromDataset, loadHospitalizationIndex, loadStaticDataset, mortalityFromDataset, referenceFromDataset } from "@/lib/staticData";
import type { MortalityDisplayMode } from "@/lib/mortality";

const EMPTY_KPI = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const EMPTY_GEO_STATS = { regions: [], cities: [] };
const EMPTY_DATA: MortalityPayload = { rows: [], current: EMPTY_KPI, baseline: EMPTY_KPI, hasComparison: false, areaStats: EMPTY_GEO_STATS, baselineAreaStats: EMPTY_GEO_STATS };
const EMPTY_ADMISSION_DATA: AdmissionPayload = { rows: [], areaStats: EMPTY_GEO_STATS };


export function Dashboard() {
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
  const [activeTab, setActiveTab] = useState<DashboardActiveTab>("mortality");
  const [jgpDisplayMode, setJgpDisplayMode] = useState<MortalityDisplayMode>("combined");
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [hospitalKey, setHospitalKey] = useState("");
  const [hospitalSubtab, setHospitalSubtab] = useState<"summary"|"comparison">("summary");
  const [peerThreshold, setPeerThreshold] = useState(75);
  const [years, setYears] = useState<string[]>([]);
  const [latestYear, setLatestYear] = useState("");
  const [year, setYear] = useState("");

  // Most z nagłówkiem portalu: nagłówek wybiera zakładkę, dashboard zgłasza aktywną zakładkę.
  useEffect(() => {
    const handleNavigation = (event: Event) => {
      const { tab, hospitalSubtab: subtab } = (event as CustomEvent<DashboardNavigation>).detail;
      setActiveTab(tab);
      if (subtab) setHospitalSubtab(subtab);
    };
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, handleNavigation);
    return () => window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, handleNavigation);
  }, []);

  useEffect(() => {
    if (!urlStateReady) return;
    window.dispatchEvent(new CustomEvent<DashboardNavigation>(DASHBOARD_TAB_CHANGED_EVENT, {
      detail: { tab: activeTab, hospitalSubtab: hospitalSubtab === "comparison" ? "comparison" : "summary" },
    }));
  }, [activeTab, hospitalSubtab, urlStateReady]);

  useEffect(() => {
    const load = async () => {
      try {
        const index = await loadHospitalizationIndex();
        const initialYear = resolveDashboardYear(new URLSearchParams(window.location.search).get("y") ?? undefined, index.years, index.latestYear);
        const dataset = await loadStaticDataset(initialYear);
        const payload = referenceFromDataset(dataset);
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
        setHospitalKey(urlState.hospitalKey ?? "");
        setHospitalSubtab(urlState.hospitalSubtab ?? "summary");
        setPeerThreshold(urlState.peerThreshold ?? 75);
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
        const dataset = await loadStaticDataset(year);
        if (cancelled) return;
        const payload = referenceFromDataset(dataset);
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
    return () => {
      cancelled = true;
    };
  }, [reference, urlStateReady, year, selectedProducts, durations, method, minHosp]);

  useEffect(() => {
    if (!reference || !urlStateReady) return;
    const search = dashboardUrlSearch(reference, {
      selectedProducts,
      durations,
      method,
      minHosp,
      axisMode,
      admissionAxisMode,
      geoMode,
      highlightedRegions,
      highlightedCities,
      activeTab,
      hospitalKey,
      hospitalSubtab,
      peerThreshold,
      year,
    }, latestYear);
    const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    reference,
    urlStateReady,
    selectedProducts,
    durations,
    method,
    minHosp,
    axisMode,
    admissionAxisMode,
    geoMode,
    highlightedRegions,
    highlightedCities,
    activeTab,
    hospitalKey,
    hospitalSubtab,
    peerThreshold,
    year,
    latestYear,
  ]);

  // „W czasie” obejmuje wszystkie lata. Profil szpitala korzysta z najnowszego roku (finanse i model par są liczone dla niego); wybór roku dotyczy analiz.
  const dataYear = activeTab === "trend" && years.length
    ? `${years[0]}–${years.at(-1)}`
    : activeTab === "hospital" && latestYear ? latestYear : reference?.analysisYear;

  if (!reference && loading) return <main className="center-state">Ładowanie aplikacji…</main>;
  if (!reference) return <main className="center-state error">{error ?? "Brak konfiguracji."}</main>;

  return <div className="app-shell">
    <Sidebar
      reference={reference}
      selectedProducts={selectedProducts}
      setSelectedProducts={setSelectedProducts}
      durations={durations}
      setDurations={setDurations}
      method={method}
      setMethod={setMethod}
      minHosp={minHosp}
      setMinHosp={setMinHosp}
      geoMode={geoMode}
      setGeoMode={setGeoMode}
      highlightedRegions={highlightedRegions}
      setHighlightedRegions={setHighlightedRegions}
      highlightedCities={highlightedCities}
      setHighlightedCities={setHighlightedCities}
      activeTab={activeTab}
      years={years}
      year={year}
      setYear={setYear}
    />

    <main className="main">
      <header className="page-header">
        <h1>Analizy hospitalizacji i szpitali</h1>
        <p>Hospitalizacje, śmiertelność i tryb przyjęcia według grup JGP oraz profile szpitali · dane NFZ {dataYear}</p>
      </header>
      <nav className="tabs" aria-label="Główna nawigacja">
        <button className={activeTab === "trend" ? "active" : undefined} onClick={() => setActiveTab("trend")}>W czasie</button>
        <button className={activeTab === "mortality" ? "active" : undefined} onClick={() => setActiveTab("mortality")}>Liczba hospitalizacji a śmiertelność</button>
        <button className={activeTab === "admissions" ? "active" : undefined} onClick={() => setActiveTab("admissions")}>Tryb przyjęcia</button>
        <button className={activeTab === "hospital" ? "active" : undefined} onClick={() => setActiveTab("hospital")}>Profil szpitala</button>
        <button className={activeTab === "methodology" ? "active" : undefined} onClick={() => setActiveTab("methodology")}>Metodologia i dane</button>
      </nav>

      {activeTab === "mortality" || activeTab === "admissions" ? <KpiStrip current={data.current} baseline={data.baseline} compare={data.hasComparison} /> : null}

      {activeTab === "trend" ? <TrendView productCodes={selectedProducts} method={method} /> : activeTab === "mortality" ? <MortalityTab
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
      /> : activeTab === "admissions" ? <AdmissionTab
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
      /> : activeTab === "hospital" ? <HospitalAnalysisTab method={method} products={reference.products} hospitalKey={hospitalKey} setHospitalKey={setHospitalKey} hospitalSubtab={hospitalSubtab} setHospitalSubtab={setHospitalSubtab} peerThreshold={peerThreshold} setPeerThreshold={setPeerThreshold} /> : <MethodologyPanel year={reference.analysisYear} />}
    </main>
  </div>;
}
