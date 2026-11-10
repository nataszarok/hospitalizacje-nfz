/** Adres profilu świadczeniodawcy (klucz OW NFZ + NIP). */
export function hospitalHref(owNfz: string, nip: string) {
  return `/szpitale?hospital=${encodeURIComponent(`${owNfz}|${nip}`)}`;
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
