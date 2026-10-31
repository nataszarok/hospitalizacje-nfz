import type { JgpGroupFile, JgpPageExtras } from "@/lib/jgpPage";

/**
 * Plik grupy A01 dla `latestDatasetFixture` (P1: Alfa 07|111 i Beta 12|222).
 * 2025 (metoda min) sumuje się do faktów: Alfa 12, Beta 18.
 */
export const groupFileFixture: JgpGroupFile = {
  version: 2,
  jgp: "A01",
  years: ["2024", "2025"],
  providers: ["07|111", "12|222"],
  // [świadczeniodawca, miesiąc (rok × 12 + miesiąc − 1), tryb 0/1/2, hospitalizacje, zgony]
  rows: [
    [0, 0, 0, 5, 0],
    [1, 5, 1, 10, 1],
    [0, 12, 0, 8, 1],
    [0, 13, 1, 4, 0],
    [1, 14, 1, 18, 2],
  ],
  valuePln: {
    national: { "2024": 900_000, "2025": 1_200_000 },
    year: "2025",
    providers: [["07|111", 500_000], ["12|222", 700_000]],
  },
};

export const extrasFixture: JgpPageExtras = {
  groupFile: groupFileFixture,
  valuationYear: "2025",
  valuations: [{ kod_jgp: "A01", pkt_hospitalizacja: 8207, dni_finansowane_grupa: 30, pkt_osobodzien_ponad_ryczalt: 353 }],
  peerPairs: [
    { a: "07|111", b: "12|222", peer_grade_pred: "A", distance_score: 5 },
    // Pomijane: klasa B, za duży dystans, szpital spoza grupy.
    { a: "07|111", b: "12|333", peer_grade_pred: "A", distance_score: 4 },
    { a: "12|222", b: "07|111", peer_grade_pred: "B", distance_score: 2 },
    { a: "12|222", b: "07|111", peer_grade_pred: "A", distance_score: 12 },
  ],
};
