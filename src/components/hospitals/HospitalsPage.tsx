"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HospitalAnalysisTab } from "@/components/HospitalAnalysisTab";
import { HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT, type HospitalNavigation } from "@/lib/dashboardNavigation";
import { hospitalUrlSearch, readHospitalUrlState, type HospitalView } from "@/lib/hospitalUrlState";
import { PEER_DISTANCE_A_LIMIT } from "@/lib/peerDistance";
import { LoadingStatus, Skeleton } from "@/components/portal/Skeleton";
import { loadStaticDataset, peekStaticDataset, referenceFromDataset } from "@/lib/staticData";
import type { ProductOption } from "@/lib/types";

const noop = () => {};
// Profil i porównanie liczą wartości „<5” metodą konserwatywną (bez wyboru metody na stronie).
const METHOD = "min";

/**
 * Moduł „Szpitale publiczne”: profil i porównanie z podobnymi placówkami (/szpitale).
 * Dane z najnowszego roku — finanse i model par są liczone dla niego.
 */
export function HospitalsPage() {
  // `useSearchParams` wymaga granicy Suspense: statyczny HTML ma szkielet, stronę rysuje przeglądarka.
  return <Suspense fallback={<HospitalsSkeleton comparison={false} />}><HospitalsApp /></Suspense>;
}

function HospitalsApp() {
  // Adres z routera, nie z `window.location`: przy przejściu linkiem `window.location` ma w pierwszym renderze
  // jeszcze stary adres (np. „/” zamiast „/szpitale?hv=c”).
  const searchParams = useSearchParams();
  // Plik roku już w pamięci (pobrany z wyprzedzeniem po najechaniu na link): strona bez szkieletu w pierwszym renderze.
  const [boot] = useState(() => {
    if (typeof window === "undefined") return null;
    const dataset = peekStaticDataset();
    return dataset ? { reference: referenceFromDataset(dataset), state: readHospitalUrlState(`?${searchParams.toString()}`) } : null;
  });
  const [ready, setReady] = useState(Boolean(boot));
  const [year, setYear] = useState(boot?.reference.analysisYear ?? "");
  const [products, setProducts] = useState<ProductOption[]>(boot?.reference.products ?? []);
  const [hospitalKey, setHospitalKey] = useState(boot?.state.hospitalKey ?? "");
  const [view, setView] = useState<HospitalView>(boot?.state.view ?? "summary");
  const [peerDistance, setPeerDistance] = useState(boot?.state.peerDistance ?? PEER_DISTANCE_A_LIMIT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (boot) return;
    const state = readHospitalUrlState(window.location.search);
    loadStaticDataset()
      .then((dataset) => {
        const reference = referenceFromDataset(dataset);
        setProducts(reference.products);
        setYear(reference.analysisYear);
        setHospitalKey(state.hospitalKey);
        setView(state.view);
        setPeerDistance(state.peerDistance);
        setReady(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Błąd pobierania danych."));
  }, [boot]);

  // Most z nagłówkiem portalu: „Szpitale” i „Porównania” przełączają widok bez przeładowania strony.
  useEffect(() => {
    const handle = (event: Event) => setView((event as CustomEvent<HospitalNavigation>).detail.view);
    window.addEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, handle);
    return () => window.removeEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, handle);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${hospitalUrlSearch({ hospitalKey, view, method: METHOD, peerDistance })}${window.location.hash}`);
    window.dispatchEvent(new CustomEvent<HospitalNavigation>(HOSPITAL_VIEW_CHANGED_EVENT, { detail: { view } }));
  }, [ready, hospitalKey, view, peerDistance]);

  if (error) return <main className="center-state error">{error}</main>;
  // Szkielet strony zamiast komunikatu na środku: panel i nagłówek jak po załadowaniu, bez przeskoku.
  if (!ready) return <HospitalsSkeleton comparison={view === "comparison"} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div>
          <div className="sidebar-eyebrow">NFZ · dane {year}</div>
          <div className="sidebar-title">Szpitale publiczne</div>
        </div>
      </div>

      {/* HospitalAnalysisTab wstawia tu wybór szpitala i widoku. */}
      <div id="hospital-sidebar-slot" />

      <div id="hospital-sidebar-bottom-slot" />
      <div className="sidebar-status"><span className="status-dot" />Dane statyczne</div>
    </aside>

    <main className="main">
      <header className="page-header">
        <h1>{view === "comparison" ? "Porównanie szpitali" : "Profil szpitala"}</h1>
        <p>{HOSPITALS_LEAD} · dane NFZ {year}</p>
      </header>
      <HospitalAnalysisTab
        method={METHOD}
        products={products}
        hospitalKey={hospitalKey}
        setHospitalKey={setHospitalKey}
        hospitalSubtab={view}
        setHospitalSubtab={setView}
        peerThreshold={75}
        setPeerThreshold={noop}
        peerDistance={peerDistance}
        setPeerDistance={setPeerDistance}
      />
    </main>
  </div>;
}

const HOSPITALS_LEAD = "Oddziały, łóżka, świadczenia i finanse szpitala oraz porównanie z podobnymi placówkami";

/** Szkielet strony na czas pierwszego pobrania danych: panel, nagłówek i miejsca na profil, jak po załadowaniu. */
function HospitalsSkeleton({ comparison }: { comparison: boolean }) {
  return <div className="app-shell" aria-busy="true">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div>
          <div className="sidebar-eyebrow">NFZ</div>
          <div className="sidebar-title">Szpitale publiczne</div>
        </div>
      </div>
      <Skeleton height={92} />
      <Skeleton height={84} style={{ marginTop: 12 }} />
    </aside>
    <main className="main">
      <header className="page-header">
        <h1>{comparison ? "Porównanie szpitali" : "Profil szpitala"}</h1>
        <p>{HOSPITALS_LEAD}</p>
      </header>
      <LoadingStatus>Ładowanie profili szpitali…</LoadingStatus>
      <Skeleton height={96} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={92} />)}
      </div>
      <Skeleton height={320} style={{ marginTop: 16 }} />
    </main>
  </div>;
}
