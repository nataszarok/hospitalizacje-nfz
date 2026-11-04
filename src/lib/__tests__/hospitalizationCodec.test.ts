import { describe, expect, it } from "vitest";
import { decodeJgpGroupFile, decodeRegionalTrends, decodeStaticDataset, decodeTrends, type JgpGroupFileColumns, type RegionalTrendsFile, type StaticDatasetFile, type TrendsFile } from "@/lib/hospitalizationCodec";
import type { StaticDataset } from "@/lib/staticData";

// Mały plik roku w formacie v2: dwóch świadczeniodawców, dwa produkty, słowniki czasu pobytu i trybu.
const yearFile: StaticDatasetFile = {
  version: 2,
  analysisYear: "2025",
  defaultProductCode: "P1",
  products: [["P1", "A01", "Stały produkt"], ["P2", "B02", "Drugi"]],
  regions: [["07", "Mazowieckie"], ["12", "Śląskie"]],
  facilities: [["07", "111", "Szpital Alfa", "WARSZAWA"], ["12", "222", "Szpital Beta", "KATOWICE"]],
  populations: [["07", 5_500_000], ["12", 4_400_000]],
  durations: ["0 dni", "1-2 dni"],
  admissions: ["2", "6"],
  facts: {
    facility: [1, 0],
    product: [0, 1],
    duration: [1, 0],
    admission: [0, 1],
    hSim: [6, 2], hMin: [3, 1], dSim: [1, 0], dMin: [1, 0],
  },
};

describe("decodeStaticDataset", () => {
  it("odtwarza krotki faktów ze słowników i kolumn (kolejność wierszy bez zmian)", () => {
    const decoded = decodeStaticDataset(yearFile);
    expect(decoded.facts).toEqual([
      ["12", "222", "P1", "1-2 dni", "2", 6, 3, 1, 1],
      ["07", "111", "P2", "0 dni", "6", 2, 1, 0, 0],
    ]);
    expect(decoded).not.toHaveProperty("durations");
    expect(decoded).not.toHaveProperty("admissions");
    expect(decoded.facilities).toBe(yearFile.facilities);
  });

  it("plik w dawnym formacie (krotki) zwraca bez zmian", () => {
    const legacy: StaticDataset = { ...decodeStaticDataset(yearFile), version: 1 };
    expect(decodeStaticDataset(legacy)).toBe(legacy);
  });
});

describe("decodeTrends i decodeRegionalTrends", () => {
  const monthly = { year: [0, 1], month: [12, 1], product: [0, 1], group: [2, 0], hSim: [5, 7], hMin: [4, 6], dSim: [1, 0], dMin: [1, 0] };
  const trends: TrendsFile = {
    version: 2,
    years: ["2024", "2025"],
    groups: ["p", "u", "o"],
    branches: ["07", "12"],
    products: [["P1", "A01", "Stały produkt", ["2024", "2025"]], ["P2", "B02", "Drugi", ["2025"]]],
    monthly,
    regional: { year: [1], branch: [1], product: [0], group: [1], hSim: [9], hMin: [8], dSim: [2], dMin: [2] },
  };

  it("odtwarza wiersze miesięczne i wiersze OW z rokiem, OW i grupą trybu jako tekstem", () => {
    const decoded = decodeTrends(trends);
    expect(decoded.monthly).toEqual([["2024", 12, 0, "o", 5, 4, 1, 1], ["2025", 1, 1, "p", 7, 6, 0, 0]]);
    expect(decoded.regional).toEqual([["2025", "12", 0, "u", 9, 8, 2, 2]]);
    expect(decoded).not.toHaveProperty("groups");
    expect(decoded).not.toHaveProperty("branches");
    expect(decodeTrends(decoded)).toBe(decoded);
  });

  it("plik jednego OW ma wiersze jak trend krajowy", () => {
    const file: RegionalTrendsFile = { version: 3, years: trends.years, groups: trends.groups, owNfz: "07", rows: monthly };
    const decoded = decodeRegionalTrends(file);
    expect(decoded).toEqual({ version: 3, years: ["2024", "2025"], owNfz: "07", rows: decodeTrends(trends).monthly });
    expect(decodeRegionalTrends(decoded)).toBe(decoded);
  });
});

describe("decodeJgpGroupFile", () => {
  const file: JgpGroupFileColumns = {
    version: 3, jgp: "A01", years: ["2024", "2025"], providers: ["07|111", "12|222"],
    rows: { provider: [1, 0], month: [12, 3], admission: [1, 0], hospitalizations: [4, 2], deaths: [1, 0] },
    valuePln: { national: { "2025": 1000 }, year: "2025", providers: [["07|111", 400]] },
  };

  it("odtwarza wiersze grupy z kolumn, reszta pliku bez zmian", () => {
    const decoded = decodeJgpGroupFile(file);
    expect(decoded.rows).toEqual([[1, 12, 1, 4, 1], [0, 3, 0, 2, 0]]);
    expect(decoded.providers).toBe(file.providers);
    expect(decoded.valuePln).toBe(file.valuePln);
    expect(decodeJgpGroupFile(decoded)).toBe(decoded);
  });
});
