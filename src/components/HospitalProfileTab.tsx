"use client";

import { Select } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { HospitalProfileChart } from "@/components/HospitalProfileChart";
import { HospitalProfileDistributionChart } from "@/components/HospitalProfileDistributionChart";
import { getJgpSection } from "@/lib/jgpSections";
import type { EstimationMethod, HospitalProfilePayload, ReferencePayload } from "@/lib/types";

const EMPTY_PROFILE: HospitalProfilePayload = { provider: null, rows: [], totalHospitalizations: 0, jgpGroups: 0 };

export function HospitalProfileTab({ reference, durations, method }: {
  reference: ReferencePayload;
  durations: string[];
  method: EstimationMethod;
}) {
  const hospitalOptions = useMemo(() => reference.hospitals.map((hospital) => ({
    value: `${hospital.owNfz}|${hospital.nip}`,
    label: hospital.label,
  })), [reference.hospitals]);

  const [hospitalKey, setHospitalKey] = useState<string | null>(null);
  const [data, setData] = useState<HospitalProfilePayload>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hospitalKey) {
      setData(EMPTY_PROFILE);
      return;
    }
    const [owNfz, nip] = hospitalKey.split("|");
    if (!owNfz || !nip) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          owNfz,
          nip,
          durations: durations.join(","),
          method,
        });
        const response = await fetch(`/api/hospital-profile?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Nie udało się pobrać profilu szpitala.");
        const payload = await response.json() as HospitalProfilePayload;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Błąd pobierania profilu szpitala.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [hospitalKey, durations, method]);

  const sectionSummary = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of data.rows) {
      const section = getJgpSection(row.jgpCode);
      if (!section) continue;
      totals.set(section, (totals.get(section) ?? 0) + row.hospitalizations);
    }
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.rows]);

  return <div className={loading ? "content loading" : "content"}>
    <section className="chart-section hospital-profile-section">
      <div className="chart-header">
        <div>
          <h2>Profil szpitala</h2>
          <p>Wyszukaj świadczeniodawcę i zobacz strukturę jego hospitalizacji zagregowaną do kodów JGP.</p>
        </div>
      </div>

      <div className="hospital-profile-search">
        <label className="find-hospital-label" htmlFor="hospital-profile-select">Świadczeniodawca</label>
        <Select
          id="hospital-profile-select"
          data={hospitalOptions}
          value={hospitalKey}
          onChange={setHospitalKey}
          placeholder="Wpisz nazwę szpitala"
          searchable
          clearable
          nothingFoundMessage="Brak wyników"
          className="mantine-filter"
          comboboxProps={{ withinPortal: true, shadow: "md" }}
        />
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {!hospitalKey ? <div className="hospital-profile-placeholder">Wybierz szpital, aby wyświetlić jego profil JGP.</div> : <>
        <div className="hospital-profile-heading">
          <div>
            <strong>{data.provider?.providerName ?? "—"}</strong>
            <span>{[data.provider?.city, data.provider?.voivodeship].filter(Boolean).join(" · ")}</span>
          </div>
        </div>

        <div className="hospital-profile-summary">
          <div><span>Hospitalizacje</span><strong>{Math.round(data.totalHospitalizations).toLocaleString("pl-PL")}</strong></div>
          <div><span>Aktywne grupy JGP</span><strong>{data.jgpGroups.toLocaleString("pl-PL")}</strong></div>
          <div><span>Największa sekcja</span><strong>{sectionSummary[0]?.[0] ?? "—"}</strong></div>
        </div>

        {data.rows.length > 0 ? <>
          <div className="find-hospital-chart-caption">Łączna liczba hospitalizacji według sekcji JGP</div>
          <HospitalProfileChart rows={data.rows} />

          <div className="hospital-profile-chart-separator" />
          <div className="find-hospital-chart-caption">Rozkład wolumenu kodów JGP · każda obserwacja to liczba hospitalizacji zagregowana do jednego kodu JGP</div>
          <HospitalProfileDistributionChart rows={data.rows} />
        </> : <div className="empty-chart">Brak hospitalizacji dla wybranego szpitala i filtrów.</div>}
      </>}
    </section>

    {hospitalKey && data.rows.length > 0 ? <details className="data-details" open>
      <summary>Struktura hospitalizacji według JGP</summary>
      <div className="table-wrap">
        <table className="hospital-profile-table">
          <thead><tr><th>#</th><th>Kod JGP</th><th>Nazwa JGP</th><th>Hospitalizacje</th><th>Udział</th></tr></thead>
          <tbody>{data.rows.map((row, index) => <tr key={row.jgpCode}>
            <td>{index + 1}</td>
            <td><strong>{row.jgpCode}</strong></td>
            <td>{row.jgpName ?? "—"}</td>
            <td>{Math.round(row.hospitalizations).toLocaleString("pl-PL")}</td>
            <td>{row.sharePct.toFixed(1)}%</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details> : null}
  </div>;
}
