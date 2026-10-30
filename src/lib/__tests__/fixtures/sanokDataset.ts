import type { SanokDataset } from "@/lib/sanokCodes";

export const sanokDataset: SanokDataset = {
  facilities: [
    { key: "pcisn", nip: "6772299255", name: "PCISN", description: "kardiologia inwazyjna" },
    { key: "szpital", nip: "6871640438", name: "SP ZOZ Sanok", description: "szpital powiatowy" },
  ],
  lengthsOfStay: ["0 dni", "1-2 dni", "3-5 dni", "6 i więcej dni"],
  codes: {
    E27: "KORONAROGRAFIA I INNE ZABIEGI INWAZYJNE",
    E50: "OSTRA LUB ZDEKOMPENSOWANA NIEWYDOLNOŚC KRĄŻENIA - LECZENIE W OINK",
    E53G: "NIEWYDOLNOŚĆ KRĄŻENIA",
  },
  facts: [
    ["2024-Q1", 0, "E27", 1, 30],
    ["2024-Q1", 0, "E53G", 1, 3],
    ["2024-Q1", 0, "E53G", 3, 1],
    ["2024-Q1", 1, "E53G", 2, 2],
    ["2024-Q1", 1, "E53G", 3, 8],
    ["2024-Q2", 1, "E53G", 3, 5],
    ["2024-Q2", 1, "E50", 3, 4],
    ["2024-Q2", 0, "E50", 2, 2],
  ],
};
