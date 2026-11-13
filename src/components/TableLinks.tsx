import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { hospitalHref, jgpHref } from "@/lib/portalLinks";

/**
 * Szpital jako link do jego karty; szpital bez karty (nie ma strony) — ta sama treść w `<span>` z tą samą klasą, bez linku.
 * Jedno miejsce reguły „link tylko do istniejących kart” (katalog, mapa, tabele, strona główna).
 */
export function HospitalLink({ owNfz, nip, className, title, children }: { owNfz: string; nip: string; className?: string; title?: string; children: ReactNode }) {
  const href = hospitalHref(owNfz, nip);
  return href ? <Link className={className} href={href} title={title}>{children}</Link> : <span className={className} title={title}>{children}</span>;
}

/** Nazwa świadczeniodawcy z linkiem do jego karty; bez karty — sama nazwa. */
export function ProviderLink({ owNfz, nip, name }: { owNfz: string; nip: string; name: string }) {
  return hospitalHref(owNfz, nip) ? <HospitalLink owNfz={owNfz} nip={nip} className="table-link">{name}</HospitalLink> : <>{name}</>;
}

/** Kody JGP rozdzielone przecinkami; kod ze stroną grupy jest linkiem. */
export function JgpCodeLinks({ codes }: { codes: string[] }) {
  if (!codes.length) return <>—</>;
  return <>{codes.map((code, index) => {
    const href = jgpHref(code);
    return <Fragment key={`${code}-${index}`}>
      {index > 0 ? ", " : null}
      {href ? <Link className="table-link" href={href}>{code}</Link> : code}
    </Fragment>;
  })}</>;
}
