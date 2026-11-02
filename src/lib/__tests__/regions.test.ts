import { describe, expect, it } from "vitest";
import { cityBreakdown, regionalBreakdown } from "@/lib/regions";
import { latestDatasetFixture as dataset, trendsFixture as trends } from "./fixtures/trendsFixture";

describe("regionalBreakdown", () => {
  it("liczy województwa w wybranym roku i sortuje według liczby na 100 tys.", () => {
    const rows = regionalBreakdown(trends, ["P1"], "2025", "sim", dataset.regions, dataset.populations);
    expect(rows).toEqual([
      { owNfz: "12", name: "Śląskie", population: 4_300_000, hospitalizations: 20, per100k: (20 / 4_300_000) * 100_000, deaths: 3, mortalityPct: 15, urgentPct: 100 },
      { owNfz: "07", name: "Mazowieckie", population: 5_500_000, hospitalizations: 14, per100k: (14 / 5_500_000) * 100_000, deaths: 2, mortalityPct: (2 / 14) * 100, urgentPct: 0 },
    ]);
  });

  it("uwzględnia tylko wybrany rok, produkty i metodę", () => {
    expect(regionalBreakdown(trends, ["P1"], "2024", "min", dataset.regions, dataset.populations).map((row) => row.hospitalizations)).toEqual([8, 0]);
    expect(regionalBreakdown(trends, ["P1", "P3"], "2025", "min", dataset.regions, dataset.populations)[0]).toMatchObject({ owNfz: "12", hospitalizations: 68 });
  });

  it("zostawia województwa bez hospitalizacji i bez ludności z zerami", () => {
    const rows = regionalBreakdown(trends, ["P2"], "2025", "min", [...dataset.regions, ["99", "Testowe"]], dataset.populations);
    expect(rows.map((row) => [row.name, row.hospitalizations, row.per100k])).toEqual([["Mazowieckie", 0, 0], ["Śląskie", 0, 0], ["Testowe", 0, 0]]);
  });
});

describe("cityBreakdown", () => {
  it("sumuje hospitalizacje według miasta siedziby, od największej liczby", () => {
    const rows = cityBreakdown(dataset, ["P1", "P3"], "min");
    expect(rows.map((row) => [row.city, row.hospitalizations, row.providers])).toEqual([["GLIWICE", 50, 1], ["KATOWICE", 18, 1], ["WARSZAWA", 12, 1]]);
    expect(rows[2]).toMatchObject({ regions: ["07"], deaths: 1, urgentPct: (4 / 12) * 100 });
  });

  it("zawęża miasta do jednego OW NFZ", () => {
    expect(cityBreakdown(dataset, ["P1"], "sim", "12").map((row) => row.city)).toEqual(["KATOWICE"]);
    expect(cityBreakdown(dataset, ["P1"], "sim", "99")).toEqual([]);
  });
});
