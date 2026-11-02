import { PEER_DISTANCE_A_LIMIT, clampPeerDistance } from "@/lib/peerDistance";
import type { EstimationMethod } from "@/lib/types";

export type HospitalView = "summary" | "comparison";

/** Stan strony /szpitale w adresie: `hospital` (klucz OW|NIP), `hv=c` (Porównanie), `m=sim`, `pd` (maks. dystans par). */
export interface HospitalUrlState {
  hospitalKey: string;
  view: HospitalView;
  method: EstimationMethod;
  /** Maksymalny dystans par w Porównaniu; domyślnie granica klasy A (bez parametru w adresie). */
  peerDistance: number;
}

export function readHospitalUrlState(search: string): HospitalUrlState {
  const params = new URLSearchParams(search);
  const view = params.get("hv");
  return {
    hospitalKey: params.get("hospital")?.trim() ?? "",
    // "s" to dawny link do zakładki Podobieństwo, która jest teraz Porównaniem.
    view: view === "c" || view === "s" ? "comparison" : "summary",
    method: params.get("m") === "sim" ? "sim" : "min",
    peerDistance: params.has("pd") ? clampPeerDistance(Number(params.get("pd"))) : PEER_DISTANCE_A_LIMIT,
  };
}

export function hospitalUrlSearch(state: HospitalUrlState) {
  const params = new URLSearchParams();
  if (state.hospitalKey) params.set("hospital", state.hospitalKey);
  if (state.view === "comparison") params.set("hv", "c");
  if (state.method === "sim") params.set("m", "sim");
  const peerDistance = clampPeerDistance(state.peerDistance);
  if (peerDistance !== PEER_DISTANCE_A_LIMIT) params.set("pd", String(peerDistance));
  const search = params.toString();
  return search ? `?${search}` : "";
}
