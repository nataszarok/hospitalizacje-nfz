import type { RegionalTrendsDataset, StaticDataset, TrendsDataset } from "@/lib/staticData";

/** Trzy lata; P2 (F04) znika po 2024, P3 (F99) pojawia się w 2025. */
export const trendsFixture: TrendsDataset = {
  version: 1,
  years: ["2023", "2024", "2025"],
  products: [
    ["P1", "A01", "Stały produkt", ["2023", "2024", "2025"]],
    ["P2", "F04", "Usunięty po 2024", ["2023", "2024"]],
    ["P3", "F99", "Nowy w 2025", ["2025"]],
  ],
  monthly: [
    ["2023", 1, 0, "p", 10, 8, 1, 1],
    ["2024", 1, 0, "u", 6, 5, 2, 1],
    ["2024", 2, 0, "o", 3, 3, 0, 0],
    ["2024", 1, 1, "p", 4, 4, 0, 0],
    ["2025", 1, 0, "p", 12, 9, 0, 0],
    ["2025", 3, 2, "u", 2, 1, 1, 1],
  ],
  regional: [
    ["2024", "07", 0, "p", 9, 8, 1, 1],
    ["2025", "07", 0, "p", 14, 12, 2, 1],
    ["2025", "12", 0, "u", 20, 18, 3, 2],
    ["2025", "12", 2, "p", 50, 50, 0, 0],
  ],
};

export const latestDatasetFixture: StaticDataset = {
  version: 1,
  analysisYear: "2025",
  defaultProductCode: "P1",
  products: [["P1", "A01", "Stały produkt"], ["P3", "F99", "Nowy w 2025"]],
  regions: [["07", "Mazowieckie"], ["12", "Śląskie"]],
  facilities: [["07", "111", "Szpital Alfa", "WARSZAWA "], ["12", "222", "Szpital Beta", "KATOWICE"], ["12", "333", "Szpital Gamma", "GLIWICE"]],
  populations: [["07", 5_500_000], ["12", 4_300_000]],
  facts: [
    ["07", "111", "P1", "0-1", "6", 10, 8, 1, 1],
    ["07", "111", "P1", "2-3", "2", 4, 4, 1, 0],
    ["12", "222", "P1", "0-1", "3", 20, 18, 3, 2],
    ["12", "333", "P3", "0-1", "6", 50, 50, 0, 0],
  ],
};

/** Trend miesięczny według OW NFZ; sumuje się do `trendsFixture.monthly`. */
export const regionalTrendsFixture: RegionalTrendsDataset = {
  version: 1,
  years: ["2023", "2024", "2025"],
  rows: [
    ["2023", 1, "07", 0, "p", 10, 8, 1, 1],
    ["2024", 1, "07", 0, "u", 4, 3, 1, 1],
    ["2024", 1, "12", 0, "u", 2, 2, 1, 0],
    ["2024", 2, "12", 0, "o", 3, 3, 0, 0],
    ["2024", 1, "07", 1, "p", 4, 4, 0, 0],
    ["2025", 1, "07", 0, "p", 12, 9, 0, 0],
    ["2025", 3, "12", 2, "u", 2, 1, 1, 1],
  ],
};
