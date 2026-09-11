"use client";

import { Select } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { HospitalRankingChart } from "@/components/HospitalRankingChart";
import { getJgpSection, getJgpSectionLabel } from "@/lib/jgpSections";
import type { EstimationMethod, HospitalRankingPayload, ProductOption, ReferencePayload } from "@/lib/types";

const EMPTY_RANKING: HospitalRankingPayload = { rows: [], totalHospitalizations: 0, facilities: 0 };

function groupProductsBySection(products: ProductOption[]) {
  const groups = new Map<string, ProductOption[]>();

  for (const product of products) {
    const section = getJgpSection(product.jgpCode);
    if (!section) continue;

    const current = groups.get(section) ?? [];
    current.push(product);
    groups.set(section, current);
  }

  return groups;
}

export function FindHospitalTab({ reference, durations, method, minHosp }: {
  reference: ReferencePayload;
  durations: string[];
  method: EstimationMethod;
  minHosp: number;
}) {
  const productsBySection = useMemo(() => groupProductsBySection(reference.products), [reference.products]);
  const availableSections = useMemo(
    () => [...productsBySection.keys()].sort((a, b) => a.localeCompare(b, "pl")),
    [productsBySection],
  );

  const defaultProduct = reference.products.find((product) => product.code === reference.defaultProductCode);
  const defaultSection = getJgpSection(defaultProduct?.jgpCode) ?? availableSections[0] ?? "";
  const [section, setSection] = useState(defaultSection);
  const [data, setData] = useState<HospitalRankingPayload>(EMPTY_RANKING);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!availableSections.includes(section)) setSection(availableSections[0] ?? "");
  }, [availableSections, section]);

  const sectionProducts = productsBySection.get(section) ?? [];
  const selectedProductCodes = useMemo(
    () => [...new Set(sectionProducts.map((product) => product.code))],
    [sectionProducts],
  );
  const selectedProductCodesKey = selectedProductCodes.join("|");

  const jgpCodesInSection = useMemo(
    () => [...new Set(sectionProducts.map((product) => product.jgpCode?.trim()).filter((code): code is string => Boolean(code)))]
      .sort((a, b) => a.localeCompare(b, "pl", { numeric: true })),
    [sectionProducts],
  );

  useEffect(() => {
    if (selectedProductCodes.length === 0) {
      setData(EMPTY_RANKING);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          products: selectedProductCodes.join(","),
          durations: durations.join(","),
          method,
          minHosp: String(minHosp),
        });
        const response = await fetch(`/api/find-hospital?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Nie udało się pobrać rankingu szpitali.");

        const payload = await response.json() as HospitalRankingPayload;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania rankingu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [selectedProductCodesKey, durations, method, minHosp]);

  const sectionOptions = availableSections.map((value) => ({
    value,
    label: getJgpSectionLabel(value),
  }));

  return <div className={loading ? "content loading" : "content"}>
    <section className="chart-section find-hospital-section">
      <div className="chart-header">
        <div>
          <h2>Znajdź szpital</h2>
          <p>Wybierz sekcję JGP, aby zobaczyć świadczeniodawców z największą łączną liczbą hospitalizacji dla wszystkich grup w tej sekcji.</p>
        </div>
      </div>

      <div className="find-hospital-controls find-hospital-controls-single">
        <div>
          <label className="find-hospital-label" htmlFor="jgp-section">Sekcja JGP</label>
          <Select
            id="jgp-section"
            data={sectionOptions}
            value={section}
            onChange={(value) => value && setSection(value)}
            searchable
            allowDeselect={false}
            className="mantine-filter"
            comboboxProps={{ withinPortal: true, shadow: "md" }}
          />
        </div>
      </div>

      <div className="find-hospital-selection">
        <strong>{section || "—"}</strong>
        <span>{getJgpSectionLabel(section).replace(`${section} — `, "")} · {jgpCodesInSection.length} {jgpCodesInSection.length === 1 ? "kod JGP" : "kodów JGP"}</span>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      <div className="find-hospital-summary">
        <div><span>Świadczeniodawcy</span><strong>{data.facilities.toLocaleString("pl-PL")}</strong></div>
        <div><span>Hospitalizacje</span><strong>{Math.round(data.totalHospitalizations).toLocaleString("pl-PL")}</strong></div>
        <div><span>Największy ośrodek</span><strong title={data.rows[0]?.providerName}>{data.rows[0]?.providerName ?? "—"}</strong></div>
      </div>

      {data.rows.length > 0 ? <>
        <div className="find-hospital-chart-caption">Top 15 świadczeniodawców według łącznej liczby hospitalizacji w sekcji {section}</div>
        <HospitalRankingChart rows={data.rows} />
      </> : <div className="empty-chart">Brak świadczeniodawców dla wybranej sekcji i filtrów.</div>}
    </section>

    <details className="data-details" open>
      <summary>Ranking świadczeniodawców · {getJgpSectionLabel(section)}</summary>
      <div className="table-wrap">
        <table className="hospital-ranking-table">
          <thead><tr><th>#</th><th>Świadczeniodawca</th><th>Województwo</th><th>Miasto</th><th>Hospitalizacje</th><th>Udział</th></tr></thead>
          <tbody>{data.rows.map((row, index) => <tr key={`${row.owNfz}-${row.nip}`}>
            <td>{index + 1}</td>
            <td title={row.providerName}>{row.providerName}</td>
            <td>{row.voivodeship}</td>
            <td>{row.city || "—"}</td>
            <td>{Math.round(row.hospitalizations).toLocaleString("pl-PL")}</td>
            <td>{row.sharePct.toFixed(1)}%</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </div>;
}
