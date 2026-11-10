import type { AnalysisArea } from "@/lib/area";
import { legacyAnalysisRedirect, readDashboardUrlState, resolveDashboardYear, type DashboardActiveTab, type DashboardUrlState } from "@/lib/dashboardUrlState";
import {
  admissionsFromDataset, mortalityFromDataset, peekHospitalizationIndex, peekStaticDataset, referenceFromDataset,
  type HospitalizationIndex, type StaticDataset,
} from "@/lib/staticData";
import type { AdmissionPayload, EstimationMethod, MortalityPayload, ReferencePayload } from "@/lib/types";

/** Wyniki eksploratora dla jednego zakresu (wykresy, tabele i pasek liczb). */
export interface ExplorerResults {
  /** Cały kraj: wykres świadczeniodawców wyróżnia obszar, nie odfiltrowuje go. */
  data: MortalityPayload;
  /** Liczby wybranego obszaru (karty nad wykresem); `null` bez obszaru. */
  areaData: MortalityPayload | null;
  admissionData: AdmissionPayload;
  /** Przyjęcia nagłe w obszarze (pasek liczb). */
  areaUrgent: number;
}

/**
 * Wyniki dla wybranych grup, długości pobytu, metody i obszarów. Wykresy świadczeniodawców pokazują cały kraj;
 * obszar jest wyróżnieniem, a karty liczb liczą tylko obszar.
 */
export function explorerResults(dataset: StaticDataset, { products, durations, method, areas }: {
  products: string[]; durations: string[]; method: EstimationMethod; areas: AnalysisArea[];
}): ExplorerResults {
  const query = { products, durations, method, minHosp: 0 };
  const data = mortalityFromDataset(dataset, query);
  const areaData = areas.length ? mortalityFromDataset(dataset, { ...query, areas }) : null;
  const admissionData = admissionsFromDataset(dataset, query);
  const areaAdmissions = areas.length ? admissionsFromDataset(dataset, { ...query, areas }) : admissionData;
  return { data, areaData, admissionData, areaUrgent: areaAdmissions.rows.reduce((sum, row) => sum + row.urgentAdmissions, 0) };
}

/** Stan startowy eksploratora: słownik roku, stan z adresu i lista lat. */
export interface ExplorerBoot {
  index: HospitalizationIndex;
  year: string;
  reference: ReferencePayload;
  urlState: DashboardUrlState;
  dataset: StaticDataset;
  /** Wyniki widoku z adresu; `null`, gdy nie wybrano grup. */
  results: ExplorerResults | null;
}

/** Długość pobytu z adresu dotyczy tylko widoku z adresu (poza „Gdzie”). */
export function bootDurations(urlState: DashboardUrlState): Partial<Record<DashboardActiveTab, string[]>> {
  return urlState.durations.length && urlState.activeTab !== "regions" ? { [urlState.activeTab]: urlState.durations } : {};
}

/** Stan startowy z listy lat, pliku roku i adresu (`search`). */
export function explorerBoot(index: HospitalizationIndex, dataset: StaticDataset, search: string): ExplorerBoot {
  const reference = referenceFromDataset(dataset);
  const urlState = readDashboardUrlState(reference, search);
  const durations = bootDurations(urlState)[urlState.activeTab] ?? [];
  return {
    index,
    year: dataset.analysisYear,
    reference,
    urlState,
    dataset,
    results: urlState.selectedProducts.length
      ? explorerResults(dataset, { products: urlState.selectedProducts, durations, method: urlState.method, areas: urlState.areas })
      : null,
  };
}

/**
 * Stan startowy, gdy lista lat i plik roku są już w pamięci (np. pobrane z wyprzedzeniem po najechaniu na link).
 * Wtedy eksplorator rysuje wyniki w pierwszym renderze: bez szkieletu i bez przeskoku. `null`: dane trzeba pobrać
 * (zawsze przy pierwszym wejściu na stronę z adresu, więc render po stronie serwera i w przeglądarce jest ten sam).
 */
export function peekExplorerBoot(search: string): ExplorerBoot | null {
  if (legacyAnalysisRedirect(search)) return null;
  const index = peekHospitalizationIndex();
  if (!index) return null;
  const year = resolveDashboardYear(new URLSearchParams(search).get("y") ?? undefined, index.years, index.latestYear);
  const dataset = peekStaticDataset(year);
  return dataset ? explorerBoot(index, dataset, search) : null;
}
