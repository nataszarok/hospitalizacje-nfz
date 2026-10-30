"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProviderLink } from "@/components/TableLinks";
import { formatCityName } from "@/lib/formatters";
import type { JgpPageData, JgpProviderRow } from "@/lib/jgpPage";
import { hospitalHref } from "@/lib/portalLinks";
import styles from "./JgpPage.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const pct = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Parametr adresu wyróżniający świadczeniodawcę na stronie grupy (klucz OW NFZ + NIP). */
export const SELECTED_PROVIDER_PARAM = "osrodek";

// Strona jest statyczna, więc parametr odczytujemy w przeglądarce po załadowaniu.
function useSelectedProviderKey() {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setKey(new URLSearchParams(window.location.search).get(SELECTED_PROVIDER_PARAM)?.trim() || null);
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const clear = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(SELECTED_PROVIDER_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setKey(null);
  };
  return { key, clear };
}

function groupAverages(providers: JgpProviderRow[]) {
  const h = providers.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = providers.reduce((sum, row) => sum + row.deaths, 0);
  const urgent = providers.reduce((sum, row) => sum + (row.urgentPct / 100) * row.hospitalizations, 0);
  return { hospitalizations: h, mortalityPct: h ? (deaths / h) * 100 : 0, urgentPct: h ? (urgent / h) * 100 : 0 };
}

/** Opis wybranego świadczeniodawcy na tle grupy (adres `?osrodek=OW|NIP`). */
export function SelectedProviderBanner({ data }: { data: JgpPageData }) {
  const { key, clear } = useSelectedProviderKey();
  if (!key) return null;
  const index = data.providers.findIndex((row) => row.key === key);
  const [owNfz, nip] = key.split("|");
  if (index < 0) {
    return <section className={styles.selected} aria-label="Wybrany świadczeniodawca">
      <p>Wybrany świadczeniodawca nie ma hospitalizacji w grupie {data.jgpCode} w {data.year} r.</p>
      <div className={styles.selectedActions}>
        {owNfz && nip ? <Link href={hospitalHref(owNfz, nip)}>Profil szpitala →</Link> : null}
        <button type="button" onClick={clear}>Usuń wyróżnienie</button>
      </div>
    </section>;
  }
  const row = data.providers[index];
  const group = groupAverages(data.providers);
  return <section className={styles.selected} aria-label="Wybrany świadczeniodawca">
    <div className={styles.selectedHead}>
      <span className={styles.eyebrow}>Wybrany świadczeniodawca na tle grupy · {data.year}</span>
      <strong>{row.name}</strong>
      <span className={styles.muted}>{formatCityName(row.city)} · OW {row.voivodeship}</span>
    </div>
    <dl className={styles.selectedMetrics}>
      <div><dt>Miejsce w grupie</dt><dd>{index + 1} / {integer(data.providerCount)}</dd><span>według liczby hospitalizacji</span></div>
      <div><dt>Hospitalizacje</dt><dd>{integer(row.hospitalizations)}</dd><span>{pct(group.hospitalizations ? (row.hospitalizations / group.hospitalizations) * 100 : 0)} grupy</span></div>
      <div><dt>Śmiertelność</dt><dd>{pct(row.mortalityPct)}</dd><span>grupa: {pct(group.mortalityPct)}</span></div>
      <div><dt>Przyjęcia nagłe</dt><dd>{pct(row.urgentPct)}</dd><span>grupa: {pct(group.urgentPct)}</span></div>
    </dl>
    <p className={styles.note}>Śmiertelność nie jest oceną jakości leczenia: zależy od stanu pacjentów i profilu ośrodka.</p>
    <div className={styles.selectedActions}>
      <Link href={hospitalHref(row.owNfz, row.nip)}>Profil szpitala →</Link>
      <a href="#jgp-providers">Pozycja w rankingu ↓</a>
      <button type="button" onClick={clear}>Usuń wyróżnienie</button>
    </div>
  </section>;
}

/** Ranking świadczeniodawców; wybrany jest wyróżniony, także spoza pierwszej piętnastki. */
export function ProvidersTable({ data }: { data: JgpPageData }) {
  const { key } = useSelectedProviderKey();
  const selectedIndex = key ? data.providers.findIndex((row) => row.key === key) : -1;
  const shown = data.topProviders.map((row, index) => ({ row, rank: index + 1 }));
  if (selectedIndex >= data.topProviders.length) shown.push({ row: data.providers[selectedIndex], rank: selectedIndex + 1 });
  return <div className={styles.tableCard}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>#</th><th>Świadczeniodawca</th><th>Miasto</th><th>Województwo</th>
          <th className={styles.num}>Hospitalizacje</th><th className={styles.num}>Śmiertelność</th><th className={styles.num}>Nagłe</th>
        </tr>
      </thead>
      <tbody>
        {shown.map(({ row, rank }) => {
          const selected = row.key === key;
          return <tr key={row.key} className={selected ? styles.rowSelected : undefined} aria-current={selected ? "true" : undefined}>
            <td>{rank > data.topProviders.length ? `… ${rank}` : rank}</td>
            <td><ProviderLink owNfz={row.owNfz} nip={row.nip} name={row.name} /></td>
            <td>{formatCityName(row.city)}</td>
            <td>{row.voivodeship}</td>
            <td className={styles.num}>{integer(row.hospitalizations)}</td>
            <td className={styles.num}>{pct(row.mortalityPct)}</td>
            <td className={styles.num}>{pct(row.urgentPct)}</td>
          </tr>;
        })}
      </tbody>
    </table>
    <p className={styles.note}>
      {data.topProviders.length} z {integer(data.providerCount)} świadczeniodawców. Wartości &lt;5 liczone metodą konserwatywną (każde &lt;5 = 1).
      {" "}<Link href={`/analizy?t=k&jgp=${encodeURIComponent(data.jgpCode)}`}>Wszyscy świadczeniodawcy: wolumen a śmiertelność →</Link>
    </p>
  </div>;
}
