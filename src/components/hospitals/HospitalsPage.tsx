"use client";

import { Select } from "@mantine/core";
import { useEffect, useState } from "react";
import { HospitalAnalysisTab } from "@/components/HospitalAnalysisTab";
import { HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT, type HospitalNavigation } from "@/lib/dashboardNavigation";
import { hospitalUrlSearch, readHospitalUrlState, type HospitalView } from "@/lib/hospitalUrlState";
import { loadStaticDataset, referenceFromDataset } from "@/lib/staticData";
import type { EstimationMethod, ProductOption } from "@/lib/types";

const noop = () => {};

/**
 * Moduł „Szpitale publiczne”: profil i porównanie z podobnymi placówkami (/szpitale).
 * Dane z najnowszego roku — finanse i model par są liczone dla niego.
 */
export function HospitalsPage() {
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [hospitalKey, setHospitalKey] = useState("");
  const [view, setView] = useState<HospitalView>("summary");
  const [method, setMethod] = useState<EstimationMethod>("min");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = readHospitalUrlState(window.location.search);
    loadStaticDataset()
      .then((dataset) => {
        const reference = referenceFromDataset(dataset);
        setProducts(reference.products);
        setYear(reference.analysisYear);
        setHospitalKey(state.hospitalKey);
        setView(state.view);
        setMethod(state.method);
        setReady(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Błąd pobierania danych."));
  }, []);

  // Most z nagłówkiem portalu: „Szpitale” i „Porównania” przełączają widok bez przeładowania strony.
  useEffect(() => {
    const handle = (event: Event) => setView((event as CustomEvent<HospitalNavigation>).detail.view);
    window.addEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, handle);
    return () => window.removeEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, handle);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${hospitalUrlSearch({ hospitalKey, view, method })}${window.location.hash}`);
    window.dispatchEvent(new CustomEvent<HospitalNavigation>(HOSPITAL_VIEW_CHANGED_EVENT, { detail: { view } }));
  }, [ready, hospitalKey, view, method]);

  if (error) return <main className="center-state error">{error}</main>;
  if (!ready) return <main className="center-state">Ładowanie profili szpitali…</main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">H</div>
        <div>
          <div className="sidebar-eyebrow">NFZ · dane {year}</div>
          <div className="sidebar-title">Szpitale publiczne</div>
        </div>
      </div>

      {/* HospitalAnalysisTab wstawia tu wybór szpitala i widoku. */}
      <div id="hospital-sidebar-slot" />

      <section className="filter-section last">
        <div className="sidebar-kicker">Estymacja wartości ukrytych</div>
        <label className="field-label" htmlFor="method">Wartości &lt;5</label>
        <Select
          id="method"
          value={method}
          onChange={(value) => value && setMethod(value as EstimationMethod)}
          data={[
            { value: "sim", label: "Symulacyjna: losowanie 1–4" },
            { value: "min", label: "Konserwatywna: każde <5 = 1" },
          ]}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, shadow: "md" }}
          className="mantine-filter"
        />
      </section>
      <div id="hospital-sidebar-bottom-slot" />
      <div className="sidebar-status"><span className="status-dot" />Dane statyczne</div>
    </aside>

    <main className="main">
      <header className="page-header">
        <h1>{view === "comparison" ? "Porównanie szpitali" : "Profil szpitala"}</h1>
        <p>Oddziały, łóżka, świadczenia i finanse szpitala oraz porównanie z podobnymi placówkami · dane NFZ {year}</p>
      </header>
      <HospitalAnalysisTab
        method={method}
        products={products}
        hospitalKey={hospitalKey}
        setHospitalKey={setHospitalKey}
        hospitalSubtab={view}
        setHospitalSubtab={setView}
        peerThreshold={75}
        setPeerThreshold={noop}
      />
    </main>
  </div>;
}
