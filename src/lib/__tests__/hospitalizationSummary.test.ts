import { describe, expect, it } from "vitest";
import { buildHospitalizationSummary, JGP_SECTION_LABELS, SUMMARY_FAMILIES } from "@/lib/hospitalizationSummary";
import type { TrendsDataset } from "@/lib/staticData";
import { latestDatasetFixture, trendsFixture } from "./fixtures/trendsFixture";

describe("buildHospitalizationSummary", () => {
  const summary = buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null);

  it("liczy lata: hospitalizacje, zgony i odsetek zgonów (metoda konserwatywna)", () => {
    expect(summary).toMatchObject({ firstYear: "2023", latestYear: "2025", previousYear: "2024", regions: null });
    expect(summary.summaryYears.map(({ year, hospitalizations, deaths }) => [year, hospitalizations, deaths])).toEqual([["2023", 8, 1], ["2024", 12, 1], ["2025", 10, 1]]);
    expect(summary.summaryYears[2].mortalityPct).toBeCloseTo(10);
  });

  it("liczy świadczeniodawców i udział 10% największych z pliku roku; rok bez pliku ma zero", () => {
    expect(summary.summaryYears[2]).toMatchObject({ providers: 3 });
    // 111: 12, 222: 18, 333: 50 → największy (10% z 3 = 1 podmiot) ma 50 z 80.
    expect(summary.summaryYears[2].top10Pct).toBeCloseTo(62.5);
    expect(summary.summaryYears[0]).toMatchObject({ providers: 0, top10Pct: 0 });
  });

  it("zwraca miesiące ostatniego i poprzedniego roku; miesiąc bez danych to null", () => {
    expect(summary.months).toEqual([
      { year: "2024", values: [9, 3, null, null, null, null, null, null, null, null, null, null] },
      { year: "2025", values: [9, null, 1, null, null, null, null, null, null, null, null, null] },
    ]);
  });

  it("grupuje hospitalizacje w sekcje katalogu (pierwsza litera kodu), od największej w ostatnim roku", () => {
    expect(summary.sections.map(({ letter, label, series }) => [letter, label, series])).toEqual([
      ["A", JGP_SECTION_LABELS.A, [8, 8, 9]],
      ["F", JGP_SECTION_LABELS.F, [0, 4, 1]],
    ]);
    expect(summary.sections[0].changePct).toBeCloseTo(12.5);
    expect(summary.sections[0].sharePct).toBeCloseTo(90);
    // Brak hospitalizacji w pierwszym roku: zmiany nie liczymy.
    expect(summary.sections[1].changePct).toBeNull();
  });

  it("sumuje rodziny po kodach obecnych w danych i linkuje do grupy z największą liczbą w ostatnim roku", () => {
    const trends: TrendsDataset = {
      ...trendsFixture,
      products: [["B1", "B19", "ZAĆMA STARA", ["2023", "2024"]], ["B2", "B19G", "ZAĆMA NOWA", ["2024", "2025"]], ["N1", "N01", "PORÓD", ["2023", "2024", "2025"]]],
      monthly: [
        ["2023", 1, 0, "p", 10, 10, 0, 0], ["2024", 1, 0, "p", 4, 4, 0, 0], ["2024", 1, 1, "p", 8, 8, 0, 0], ["2025", 1, 1, "p", 15, 15, 0, 0],
        ["2023", 1, 2, "u", 20, 20, 0, 0], ["2025", 1, 2, "u", 10, 10, 0, 0],
      ],
    };
    const families = buildHospitalizationSummary(trends, [latestDatasetFixture], null).families;
    const cataract = families.find((family) => family.id === "zacma")!;
    expect(cataract).toMatchObject({ codes: ["B19", "B19G"], series: [10, 12, 15], mainCode: "B19G" });
    expect(cataract.changePct).toBeCloseTo(50);
    expect(families.find((family) => family.id === "porod")).toMatchObject({ codes: ["N01"], series: [20, 0, 10], changePct: -50 });
    // Od największego wzrostu.
    expect(families[0].id).toBe("zacma");
    expect(families).toHaveLength(SUMMARY_FAMILIES.length);
  });
});
