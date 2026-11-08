import { describe, expect, it } from "vitest";
import { productTrend } from "@/lib/staticData";
import { incompleteCoverage, monthlySeries, productCodesForJgp, trendSummary } from "@/lib/trends";
import { trendsFixture as trends } from "./fixtures/trendsFixture";

describe("trendSummary", () => {
  it("podsumowuje najnowszy rok i liczy zmianę rok do roku", () => {
    const summary = trendSummary(productTrend(trends, ["P1"], "sim"));
    expect(summary).toEqual({
      year: "2025", previousYear: "2024", hospitalizations: 12,
      changePct: ((12 - 9) / 9) * 100, deaths: 0, mortalityPct: 0, urgentPct: 0,
    });
  });

  it("liczy śmiertelność i udział przyjęć nagłych", () => {
    const summary = trendSummary(productTrend(trends, ["P3"], "sim"));
    expect(summary).toMatchObject({ year: "2025", previousYear: null, changePct: null, mortalityPct: 50, urgentPct: 100 });
  });

  it("nie liczy zmiany, gdy zestaw grup różni się między porównywanymi latami", () => {
    const trend = productTrend(trends, ["P1", "P3"], "sim");
    expect(trendSummary(trend, incompleteCoverage(trends, ["P1", "P3"]))?.changePct).toBeNull();
    // Bez informacji o katalogu zmiana byłaby liczona (i myląca).
    expect(trendSummary(trend)?.changePct).not.toBeNull();
  });

  it("dla grupy wycofanej z katalogu podsumowuje ostatni rok, w którym występuje", () => {
    const coverage = incompleteCoverage(trends, ["P2"]);
    // 2023 bez hospitalizacji: zmiany względem zera nie liczymy.
    expect(trendSummary(productTrend(trends, ["P2"], "sim"), coverage)).toMatchObject({ year: "2024", previousYear: "2023", hospitalizations: 4, changePct: null });
  });

  it("zwraca null, gdy żaden rok nie ma danych", () => {
    expect(trendSummary({ yearly: [null, null], monthly: [] })).toBeNull();
  });
});

describe("incompleteCoverage", () => {
  it("zwraca tylko wybrane produkty, których nie ma we wszystkich latach", () => {
    expect(incompleteCoverage(trends, ["P1", "P2"])).toEqual([{ code: "P2", jgpCode: "F04", name: "Usunięty po 2024", years: ["2023", "2024"] }]);
    expect(incompleteCoverage(trends, ["P1"])).toEqual([]);
  });
});

describe("productCodesForJgp", () => {
  it("znajduje produkty grupy JGP", () => {
    expect(productCodesForJgp(trends, "F04")).toEqual(["P2"]);
    expect(productCodesForJgp(trends, "ZZZ")).toEqual([]);
  });
});

describe("monthlySeries", () => {
  it("buduje pełną oś miesięcy: zera w miesiącach bez hospitalizacji, null w latach spoza katalogu", () => {
    const series = monthlySeries(productTrend(trends, ["P3"], "sim"), trends.years);
    expect(series).toHaveLength(36);
    expect(series[0]).toEqual({ date: "2023-01-01", year: "2023", month: 1, point: null });
    expect(series[24].point).toMatchObject({ hospitalizations: 0 });
    expect(series[26]).toMatchObject({ date: "2025-03-01", point: { hospitalizations: 2, urgent: 2 } });
  });
});
