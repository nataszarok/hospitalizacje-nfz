import type { EstimationMethod } from "@/lib/types";

export type HospitalView = "summary" | "comparison";

/** Stan strony /szpitale w adresie: `hospital` (klucz OW|NIP), `hv=c` (Porównanie), `m=sim`. */
export interface HospitalUrlState {
  hospitalKey: string;
  view: HospitalView;
  method: EstimationMethod;
}

export function readHospitalUrlState(search: string): HospitalUrlState {
  const params = new URLSearchParams(search);
  const view = params.get("hv");
  return {
    hospitalKey: params.get("hospital")?.trim() ?? "",
    // "s" to dawny link do zakładki Podobieństwo, która jest teraz Porównaniem.
    view: view === "c" || view === "s" ? "comparison" : "summary",
    method: params.get("m") === "sim" ? "sim" : "min",
  };
}

export function hospitalUrlSearch(state: HospitalUrlState) {
  const params = new URLSearchParams();
  if (state.hospitalKey) params.set("hospital", state.hospitalKey);
  if (state.view === "comparison") params.set("hv", "c");
  if (state.method === "sim") params.set("m", "sim");
  const search = params.toString();
  return search ? `?${search}` : "";
}
