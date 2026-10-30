import { JGP_PAGE_CODES } from "@/lib/jgpPage";

/** Adres profilu świadczeniodawcy (klucz OW NFZ + NIP). */
export function hospitalHref(owNfz: string, nip: string) {
  return `/szpitale?hospital=${encodeURIComponent(`${owNfz}|${nip}`)}`;
}

/** Adres strony grupy JGP albo `null`, gdy grupa nie ma jeszcze strony. */
export function jgpHref(jgpCode: string | null | undefined) {
  return jgpCode && (JGP_PAGE_CODES as readonly string[]).includes(jgpCode) ? `/jgp/${encodeURIComponent(jgpCode)}` : null;
}
