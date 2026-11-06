import { describe, expect, it } from "vitest";
import { durationChartData, incompleteCoverage, productCodesForJgp, trendChartLines, trendMonths, yearChangePct } from "@/lib/trends";
import { trendsFixture as trends } from "./fixtures/trendsFixture";

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

describe("wykres „W czasie”", () => {
  it("trendMonths: lata wybranych grup, ostatni rok tylko z miesiącami z pliku", () => {
    expect(trendMonths(trends, ["P3"])).toEqual(["2025-01", "2025-02", "2025-03"]);
    const months = trendMonths(trends, ["P1"]);
    expect(months).toHaveLength(27);
    expect([months[0], months[11], months[12], months.at(-1)]).toEqual(["2023-01", "2023-12", "2024-01", "2025-03"]);
    expect(trendMonths(trends, [])).toEqual([]);
  });

  it("trendChartLines: jedna seria razem albo seria na grupę; udziały z mianownikiem hospitalizacji", () => {
    const months = trendMonths(trends, ["P1", "P2"]);
    const [all] = trendChartLines(trends, ["P1", "P2"], "min", "hospitalizations", false, months);
    expect(all).toMatchObject({ key: "all", name: "Wybrane grupy JGP" });
    expect(all.values[0]).toBe(8);
    expect(all.values[12]).toBe(5 + 4);
    const perGroup = trendChartLines(trends, ["P1", "P2"], "min", "urgent", true, months);
    expect(perGroup.map((line) => line.name)).toEqual(["A01", "F04"]);
    expect(perGroup[0].values[12]).toBe(5);
    expect(perGroup[0].base?.[12]).toBe(5);
    expect(perGroup[1].values[12]).toBe(0);
  });

  it("yearChangePct: zmiana r/r wybranego roku, bez porównania przy zmianie katalogu", () => {
    const trend = { yearly: [{ year: "2024", hospitalizations: 100, deaths: 0, planned: 0, urgent: 0 }, { year: "2025", hospitalizations: 120, deaths: 0, planned: 0, urgent: 0 }], monthly: [] };
    expect(yearChangePct(trend, ["2024", "2025"], "2025")).toBeCloseTo(20);
    expect(yearChangePct(trend, ["2024", "2025"], "2024")).toBeNull();
    expect(yearChangePct(trend, ["2024", "2025"], "2025", [{ code: "P3", jgpCode: "F99", name: null, years: ["2025"] }])).toBeNull();
  });
});

describe("durationChartData", () => {
  const series = new Map([
    ["P1", [null, { year: "2024", hospitalizations: 12, deaths: 0, urgent: 6 }, { year: "2025", hospitalizations: 24, deaths: 2, urgent: 6 }]],
    ["P2", [null, { year: "2024", hospitalizations: 12, deaths: 1, urgent: 0 }, null]],
  ]);

  it("lata bez danych na początku pomija; wartość roku rozkłada na 12 miesięcy (suma roku bez zmian)", () => {
    const { months, lines } = durationChartData(series, ["2023", "2024", "2025"], "hospitalizations", false, new Map());
    expect(months[0]).toBe("2024-01");
    expect(months).toHaveLength(24);
    expect(lines[0].values.slice(0, 12).reduce((sum, value) => sum + value, 0)).toBeCloseTo(24);
    expect(lines[0].values.slice(12).reduce((sum, value) => sum + value, 0)).toBeCloseTo(24);
  });

  it("udział: licznik i mianownik rozłożone tak samo; Per JGP podpisany kodem JGP", () => {
    const { lines } = durationChartData(series, ["2023", "2024", "2025"], "urgent", true, new Map([["P1", "A01"], ["P2", "F04"]]));
    expect(lines.map((line) => line.name)).toEqual(["A01", "F04"]);
    expect(lines[0].values[0] / lines[0].base![0]).toBeCloseTo(0.5);
    expect(lines[1].values.slice(12)).toEqual(Array(12).fill(0));
  });
});
