import { describe, expect, it } from "vitest";
import { buildJgpPageData, JGP_PAGE_CODES } from "@/lib/jgpPage";
import { latestDatasetFixture, trendsFixture } from "./fixtures/trendsFixture";

describe("buildJgpPageData", () => {
  it("łączy zakres lat z trendów i ranking świadczeniodawców z najnowszego roku", () => {
    const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01");
    expect(data).toMatchObject({
      jgpCode: "A01", name: "Stały produkt", productCodes: ["P1"], catalogYears: ["2023", "2024", "2025"],
      year: "2025", providerCount: 2, hospitalizations: 30,
    });
    expect(data?.topProviders).toEqual([
      { key: "12|222", owNfz: "12", nip: "222", name: "Szpital Beta", city: "KATOWICE", voivodeship: "Śląskie", hospitalizations: 18, deaths: 2, mortalityPct: (2 / 18) * 100, urgentPct: 100 },
      { key: "07|111", owNfz: "07", nip: "111", name: "Szpital Alfa", city: "WARSZAWA", voivodeship: "Mazowieckie", hospitalizations: 12, deaths: 1, mortalityPct: (1 / 12) * 100, urgentPct: (4 / 12) * 100 },
    ]);
  });

  it("liczy województwa z trendów najnowszego roku", () => {
    expect(buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")?.regions.map((row) => [row.name, row.hospitalizations]))
      .toEqual([["Śląskie", 18], ["Mazowieckie", 12]]);
  });

  it("używa metody sim i ogranicza liczbę wierszy", () => {
    const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "sim", 1);
    expect(data?.hospitalizations).toBe(34);
    expect(data?.topProviders.map((row) => row.key)).toEqual(["12|222"]);
  });

  it("pokazuje lata katalogu dla grupy spoza najnowszego roku", () => {
    expect(buildJgpPageData(trendsFixture, latestDatasetFixture, "F04")).toMatchObject({ catalogYears: ["2023", "2024"], providerCount: 0, topProviders: [] });
  });

  it("zwraca null dla nieznanej grupy", () => {
    expect(buildJgpPageData(trendsFixture, latestDatasetFixture, "ZZZ")).toBeNull();
  });

  it("ma co najmniej jedną grupę do wygenerowania", () => {
    expect(JGP_PAGE_CODES.length).toBeGreaterThan(0);
  });
});

describe("buildJgpPageData — tryb przyjęcia i typ grupy", () => {
  it("zwraca strukturę trybu przyjęcia w latach z danymi i typ grupy", () => {
    const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")!;
    expect(data.procedural).toBe(false);
    expect(data.admissions).toEqual([
      { year: "2023", total: 8, planned: 8, urgent: 0, other: 0 },
      { year: "2024", total: 8, planned: 0, urgent: 5, other: 3 },
      { year: "2025", total: 9, planned: 9, urgent: 0, other: 0 },
    ]);
  });
});
