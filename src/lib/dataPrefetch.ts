import { HOSPITAL_EXPLORER_PATH } from "@/lib/dashboardNavigation";
import { financialResultsResource, jgpValuationsResource, peerPairsResource, rpwdlSummaryProfilesResource } from "@/lib/hospitalData";
import { loadPlotly } from "@/lib/plotlyLoader";
import { loadHospitalizationIndex, loadStaticDataset, loadTrends } from "@/lib/staticData";

/**
 * Pobieranie danych z wyprzedzeniem: gdy kursor najedzie na link (albo link dostanie fokus lub dotyk), zaczynamy
 * pobierać dane strony docelowej. Loadery z `staticData.ts` trzymają obietnice w pamięci, więc strona po kliknięciu
 * dostaje gotowe albo już pobierane dane i krócej pokazuje szkielet.
 * `/analizy`: lista lat, plik roku (`y` z adresu albo najnowszy), trendy dla widoku „W czasie” (bez `t`).
 * Porównanie szpitali (`/szpitale/eksplorator`): plik najnowszego roku, finanse, profile RPWDL, pary A/B i wyceny JGP.
 * Pliki trafiają do pamięci modułów (`staticData.ts`, `hospitalData.ts`), więc strona po kliknięciu rysuje wyniki
 * w pierwszym renderze, bez szkieletu.
 * Obie strony: biblioteka Plotly (ok. 3,5 MB). Bez niej po kliknięciu miejsce wykresu jest puste, aż Plotly się pobierze i uruchomi.
 */
export function prefetchForHref(href: string, origin = "http://localhost"): string | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  const quiet = (promise: Promise<unknown>) => { promise.catch(() => { /* strona pobierze dane sama i pokaże błąd */ }); };
  if (url.pathname === "/analizy" || url.pathname === HOSPITAL_EXPLORER_PATH) quiet(loadPlotly());
  if (url.pathname === "/analizy") {
    const year = url.searchParams.get("y") ?? undefined;
    quiet(loadHospitalizationIndex().then((index) => loadStaticDataset(year && index.years.includes(year) ? year : index.latestYear)));
    if (!url.searchParams.get("t")) quiet(loadTrends());
    return "analizy";
  }
  if (url.pathname === HOSPITAL_EXPLORER_PATH) {
    quiet(loadStaticDataset());
    quiet(financialResultsResource.load());
    quiet(rpwdlSummaryProfilesResource.load());
    // Strona ma tylko porównanie: zawsze pary A/B (ok. 3,5 MB) i wyceny.
    quiet(peerPairsResource.load());
    quiet(jgpValuationsResource.load());
    return "porownanie";
  }
  return null;
}
