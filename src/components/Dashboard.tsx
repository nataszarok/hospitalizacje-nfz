"use client";

import { useEffect, useState } from "react";
import { AdmissionTab } from "@/components/AdmissionTab";
import { KpiStrip } from "@/components/KpiStrip";
import { MethodologyPanel } from "@/components/MethodologyPanel";
import { MortalityTab } from "@/components/MortalityTab";
import { Sidebar } from "@/components/Sidebar";
import type { AdmissionPayload, AxisMode, EstimationMethod, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";
import { dashboardUrlSearch, readDashboardUrlState, type DashboardActiveTab } from "@/lib/dashboardUrlState";
import { admissionsFromDataset, loadStaticDataset, mortalityFromDataset, referenceFromDataset } from "@/lib/staticData";

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
  const [urlStateReady, setUrlStateReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const dataset = await loadStaticDataset();
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
        setReference(payload);
        setUrlStateReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd inicjalizacji aplikacji.");
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!reference || !urlStateReady) return;

    let cancelled = false;
    const refreshData = async () => {
      try {
        const dataset = await loadStaticDataset();
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
  }, [reference, urlStateReady, selectedProducts, durations, method, minHosp]);

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
    });
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
  ]);

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
    />

    <main className="main">
      <header className="page-header">
        <h1>Hospitalizacje w Polsce</h1>
        <p>Analiza wolumenu, śmiertelności i trybu przyjęcia · NFZ {reference.analysisYear}</p>
      </header>
      <nav className="tabs" aria-label="Główna nawigacja">
        <button className={activeTab === "mortality" ? "active" : undefined} onClick={() => setActiveTab("mortality")}>Wolumen i śmiertelność</button>
        <button className={activeTab === "admissions" ? "active" : undefined} onClick={() => setActiveTab("admissions")}>Tryb przyjęcia</button>
        <button className={activeTab === "methodology" ? "active" : undefined} onClick={() => setActiveTab("methodology")}>Metodologia i dane</button>
      </nav>

      {activeTab !== "methodology" ? <KpiStrip current={data.current} baseline={data.baseline} compare={data.hasComparison} /> : null}

      {activeTab === "mortality" ? <MortalityTab
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
      /> : <MethodologyPanel year={reference.analysisYear} />}
    </main>
  </div>;
}
