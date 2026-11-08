/** Adres profilu świadczeniodawcy (klucz OW NFZ + NIP). */
export function hospitalHref(owNfz: string, nip: string) {
  return `/szpitale?hospital=${encodeURIComponent(`${owNfz}|${nip}`)}`;
}

/** Adres karty grupy JGP (każda grupa z danych ma kartę) albo `null` bez kodu. */
export function jgpHref(jgpCode: string | null | undefined) {
  return jgpCode ? `/jgp/${encodeURIComponent(jgpCode)}` : null;
}
