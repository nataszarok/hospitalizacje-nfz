import Link from "next/link";
import { Fragment } from "react";
import { hospitalHref, jgpHref } from "@/lib/portalLinks";

/** Nazwa świadczeniodawcy z linkiem do jego profilu. */
export function ProviderLink({ owNfz, nip, name }: { owNfz: string; nip: string; name: string }) {
  return <Link className="table-link" href={hospitalHref(owNfz, nip)}>{name}</Link>;
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
