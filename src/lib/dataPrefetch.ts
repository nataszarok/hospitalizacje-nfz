import { loadHospitalizationIndex, loadStaticDataset, loadTrends } from "@/lib/staticData";

/**
 * Pobieranie danych z wyprzedzeniem: gdy kursor najedzie na link (albo link dostanie fokus lub dotyk), zaczynamy
 * pobierać dane strony docelowej. Loadery z `staticData.ts` trzymają obietnice w pamięci, więc strona po kliknięciu
 * dostaje gotowe albo już pobierane dane i krócej pokazuje szkielet.
 * `/analizy`: lista lat, plik roku (`y` z adresu albo najnowszy), trendy dla widoku „W czasie” (bez `t`).
 * `/szpitale`: plik najnowszego roku oraz finanse i profile RPWDL (pamięć podręczna przeglądarki, `force-cache`).
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
  if (url.pathname === "/analizy") {
    const year = url.searchParams.get("y") ?? undefined;
    quiet(loadHospitalizationIndex().then((index) => loadStaticDataset(year && index.years.includes(year) ? year : index.latestYear)));
    if (!url.searchParams.get("t")) quiet(loadTrends());
    return "analizy";
  }
  if (url.pathname === "/szpitale") {
    quiet(loadStaticDataset());
    for (const file of ["/data/financial_results.json.gz", "/data/rpwdl_summary_profiles.json.gz"]) quiet(fetch(file, { cache: "force-cache" }));
    return "szpitale";
  }
  return null;
}
