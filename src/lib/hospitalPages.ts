import pagesIndex from "../../build-data/hospitals/index.json";

/**
 * Szpitale z kartą `/szpitale/<NIP>-<OW>`: lista z `scripts/build_hospital_index.py` (sieć szpitali PSZ i próbka
 * świadczeniodawców z małą liczbą danych). Klucz świadczeniodawcy: „OW NFZ|NIP”. NIP z hospitalizacjami w kilku
 * OW NFZ ma kilka kart, dlatego adres ma NIP i OW.
 */
export const HOSPITAL_PAGE_KEYS: readonly string[] = (pagesIndex.pages as [string, string, string][]).map(([key]) => key);
const PAGE_KEYS = new Set(HOSPITAL_PAGE_KEYS);

/** Fragment adresu karty: „<NIP>-<OW>”, np. „6691044410-16”. */
export const hospitalSlug = (key: string) => {
  const [owNfz, nip] = key.split("|");
  return `${nip}-${owNfz}`;
};

/** Adres karty szpitala albo `null`, gdy szpital nie ma karty (wtedy bez linku). */
export function hospitalCardHref(owNfz: string, nip: string): string | null {
  return PAGE_KEYS.has(`${owNfz}|${nip}`) ? `/szpitale/${hospitalSlug(`${owNfz}|${nip}`)}` : null;
}

/** Klucz „OW|NIP” karty z fragmentu adresu „<NIP>-<OW>” albo `null`. */
export function hospitalPageKey(slug: string): string | null {
  const match = /^(\d{10})-(\d{2})$/.exec(slug);
  const key = match ? `${match[2]}|${match[1]}` : null;
  return key && PAGE_KEYS.has(key) ? key : null;
}
