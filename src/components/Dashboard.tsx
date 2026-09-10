"use client";

import { useCallback, useEffect, useState } from "react";
import { AdmissionTab } from "@/components/AdmissionTab";
import { KpiStrip } from "@/components/KpiStrip";
import { MethodologyPanel } from "@/components/MethodologyPanel";
import { MortalityTab } from "@/components/MortalityTab";
import { Sidebar } from "@/components/Sidebar";
import type { AdmissionPayload, AxisMode, EstimationMethod, GeographyMode, MortalityPayload, ReferencePayload } from "@/lib/types";

const EMPTY_KPI = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const EMPTY_GEO_STATS = { regions: [], cities: [] };
const EMPTY_DATA: MortalityPayload = { rows: [], current: EMPTY_KPI, baseline: EMPTY_KPI, hasComparison: false, areaStats: EMPTY_GEO_STATS, baselineAreaStats: EMPTY_GEO_STATS };
const EMPTY_ADMISSION_DATA: AdmissionPayload = { rows: [] };

type ActiveTab = "mortality" | "admissions" | "methodology";

export function Dashboard() {
  const [reference, setReference] = useState<ReferencePayload | null>(null);
  const [data, setData] = useState<MortalityPayload>(EMPTY_DATA);
  const [admissionData, setAdmissionData] = useState<AdmissionPayload>(EMPTY_ADMISSION_DATA);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [durations, setDurations] = useState<string[]>([]);
  const [method, setMethod] = useState<EstimationMethod>("min");
  const [minHosp, setMinHosp] = useState(0);
  const [axisMode, setAxisMode] = useState<AxisMode>("total");
  const [geoMode, setGeoMode] = useState<GeographyMode>("regions");
  const [highlightedRegions, setHighlightedRegions] = useState<string[]>([]);
  const [highlightedCities, setHighlightedCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("mortality");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/reference", { cache: "no-store" });
        if (!response.ok) throw new Error("Nie udało się pobrać słowników.");
        const payload = await response.json() as ReferencePayload;
        setReference(payload);
        setSelectedProducts(payload.defaultProductCode ? [payload.defaultProductCode] : payload.products.slice(0, 1).map((product) => product.code));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd inicjalizacji aplikacji.");
        setLoading(false);
      }
    };
    void load();
  }, []);

  const reload = useCallback(async () => {
    if (selectedProducts.length === 0) {
      setData(EMPTY_DATA);
      setAdmissionData(EMPTY_ADMISSION_DATA);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        products: selectedProducts.join(","),
        durations: durations.join(","),
        method,
        minHosp: String(minHosp),
      });
      const [mortalityResponse, admissionResponse] = await Promise.all([
        fetch(`/api/mortality?${params}`, { cache: "no-store" }),
        fetch(`/api/admissions?${params}`, { cache: "no-store" }),
      ]);
      if (!mortalityResponse.ok) throw new Error("Nie udało się pobrać danych analizy.");
      if (!admissionResponse.ok) throw new Error("Nie udało się pobrać danych trybu przyjęcia.");
      const [mortalityPayload, admissionPayload] = await Promise.all([
        mortalityResponse.json() as Promise<MortalityPayload>,
        admissionResponse.json() as Promise<AdmissionPayload>,
      ]);
      setData(mortalityPayload);
      setAdmissionData(admissionPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania danych.");
    } finally {
      setLoading(false);
    }
  }, [selectedProducts, durations, method, minHosp]);

  useEffect(() => { if (reference) void reload(); }, [reference, reload]);

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
        geoMode={geoMode}
        highlightedRegions={highlightedRegions}
        highlightedCities={highlightedCities}
      /> : <MethodologyPanel year={reference.analysisYear} />}
    </main>
  </div>;
}
