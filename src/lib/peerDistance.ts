// Suwak dystansu w modelu par A/B. Progi pochodzą z modelu (distance_cutpoints):
// A_to_B ≈ 10,005, B_to_N ≈ 17,053. Pary klasy N nie trafiają do danych.
// Minimum, granica A i maksimum leżą na siatce kroku 0,05.
export const PEER_DISTANCE_MIN = 2.01;
export const PEER_DISTANCE_A_LIMIT = 10.01;
export const PEER_DISTANCE_MAX = 17.06;
export const PEER_DISTANCE_STEP = 0.05;

export type PeerGradeScope = "A" | "AB";

export function clampPeerDistance(value: number) {
  if (!Number.isFinite(value)) return PEER_DISTANCE_A_LIMIT;
  const bounded = Math.min(PEER_DISTANCE_MAX, Math.max(PEER_DISTANCE_MIN, value));
  const steps = Math.round((bounded - PEER_DISTANCE_MIN) / PEER_DISTANCE_STEP);
  return Number((PEER_DISTANCE_MIN + steps * PEER_DISTANCE_STEP).toFixed(2));
}

// Do granicy klasy A suwak zawęża pary A; powyżej niej dołącza pary B.
export function peerGradeScope(maxDistance: number): PeerGradeScope {
  return maxDistance > PEER_DISTANCE_A_LIMIT ? "AB" : "A";
}
