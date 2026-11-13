"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HospitalAnalysisTab } from "@/components/HospitalAnalysisTab";
import { HOSPITAL_VIEW_CHANGED_EVENT, type HospitalNavigation } from "@/lib/dashboardNavigation";
import { hospitalUrlSearch, readHospitalUrlState, type HospitalView } from "@/lib/hospitalUrlState";
import { PEER_DISTANCE_A_LIMIT } from "@/lib/peerDistance";
import { LoadingStatus, Skeleton } from "@/components/portal/Skeleton";
import { loadStaticDataset, peekStaticDataset, referenceFromDataset } from "@/lib/staticData";
import type { ProductOption } from "@/lib/types";

const noop = () => {};
// Profil i porównanie liczą wartości „<5” metodą konserwatywną (bez wyboru metody na stronie).
const METHOD = "min";

/**
 * Porównanie szpitala z podobnymi placówkami (`/szpitale/eksplorator`, w menu „Porównania”): panel z wyborem szpitala i podobieństwem par.
 * Dawny widok „Profil” zastąpiła karta szpitala `/szpitale/<NIP>-<OW>`; strona zawsze pokazuje porównanie (stare adresy z profilem też).
 * Dane z najnowszego roku — finanse i model par są liczone dla niego.
 */
const VIEW: HospitalView = "comparison";
export function HospitalsPage() {
  // `useSearchParams` wymaga granicy Suspense: statyczny HTML ma szkielet, stronę rysuje przeglądarka.
  return <Suspense fallback={<HospitalsSkeleton />}><HospitalsApp /></Suspense>;
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
        setPeerDistance(state.peerDistance);
        setReady(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Błąd pobierania danych."));
  }, [boot]);

  useEffect(() => {
    if (!ready) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${hospitalUrlSearch({ hospitalKey, view: VIEW, method: METHOD, peerDistance })}${window.location.hash}`);
    window.dispatchEvent(new CustomEvent<HospitalNavigation>(HOSPITAL_VIEW_CHANGED_EVENT, { detail: { view: VIEW } }));
  }, [ready, hospitalKey, peerDistance]);

  if (error) return <main className="center-state error">{error}</main>;
  // Szkielet strony zamiast komunikatu na środku: panel i nagłówek jak po załadowaniu, bez przeskoku.
  if (!ready) return <HospitalsSkeleton />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div>
          <div className="sidebar-eyebrow">NFZ · dane {year}</div>
          <div className="sidebar-title">Szpitale publiczne</div>
        </div>
      </div>

      {/* HospitalAnalysisTab wstawia tu wybór szpitala i podobieństwo par. */}
      <div id="hospital-sidebar-slot" />

      <div id="hospital-sidebar-bottom-slot" />
      <div className="sidebar-status"><span className="status-dot" />Dane statyczne</div>
    </aside>

    <main className="main">
      <header className="page-header">
        <h1>Porównanie szpitali</h1>
        <p>{HOSPITALS_LEAD} · dane NFZ {year}</p>
      </header>
      <HospitalAnalysisTab
        method={METHOD}
        products={products}
        hospitalKey={hospitalKey}
        setHospitalKey={setHospitalKey}
        hospitalSubtab={VIEW}
        setHospitalSubtab={noop}
        showViewSwitch={false}
        peerThreshold={75}
        setPeerThreshold={noop}
        peerDistance={peerDistance}
        setPeerDistance={setPeerDistance}
      />
    </main>
  </div>;
}

const HOSPITALS_LEAD = "Szpital na tle grupy podobnych placówek dobranych przez model par";

/** Szkielet strony na czas pierwszego pobrania danych: panel, nagłówek i miejsca na porównanie, jak po załadowaniu. */
function HospitalsSkeleton() {
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
        <h1>Porównanie szpitali</h1>
        <p>{HOSPITALS_LEAD}</p>
      </header>
      <LoadingStatus>Ładowanie porównania szpitali…</LoadingStatus>
      <Skeleton height={96} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={92} />)}
      </div>
      <Skeleton height={320} style={{ marginTop: 16 }} />
    </main>
  </div>;
}
