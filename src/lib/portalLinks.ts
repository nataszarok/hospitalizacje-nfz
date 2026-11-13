import { HOSPITAL_EXPLORER_PATH } from "@/lib/dashboardNavigation";
import { hospitalCardHref } from "@/lib/hospitalPages";

/**
 * Adres szpitala (klucz OW NFZ + NIP): karta `/szpitale/<NIP>-<OW>` albo `null`, gdy szpital nie ma karty.
 * Szpital bez karty nie ma strony, więc widoki pokazują jego nazwę bez linku.
 */
export function hospitalHref(owNfz: string, nip: string): string | null {
  return hospitalCardHref(owNfz, nip);
}

/** Porównanie szpitala z podobnymi placówkami (strona porównania z wyborem szpitala w panelu). */
export function hospitalComparisonHref(owNfz: string, nip: string) {
  return `${HOSPITAL_EXPLORER_PATH}?hospital=${encodeURIComponent(`${owNfz}|${nip}`)}&hv=c`;
}

/** Adres karty grupy JGP (każda grupa z danych ma kartę) albo `null` bez kodu. */
export function jgpHref(jgpCode: string | null | undefined) {
  return jgpCode ? `/jgp/${encodeURIComponent(jgpCode)}` : null;
}

/** Widoki eksploratora `/analizy` (parametr `t`; bez parametru: W czasie). */
const EXPLORER_TABS = { trend: null, mortality: "k", admissions: "a", regions: "g" } as const;

/** Adres widoku eksploratora dla grupy JGP, z rokiem i województwami (obszar `ow`). */
export function explorerHref(jgpCode: string, view: keyof typeof EXPLORER_TABS, { year, regions = [] }: { year?: string; regions?: string[] } = {}) {
  const params = new URLSearchParams();
  const tab = EXPLORER_TABS[view];
  if (tab) params.set("t", tab);
  params.set("jgp", jgpCode);
  if (year) params.set("y", year);
  for (const ow of regions) params.append("ow", ow);
  return `/analizy?${params.toString()}`;
}
