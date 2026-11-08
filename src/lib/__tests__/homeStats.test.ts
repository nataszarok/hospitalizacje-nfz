import { describe, expect, it } from "vitest";
import { buildHomeStats } from "@/lib/homeStats";
import type { RegionsMap } from "@/lib/jgpCard";
import { latestDatasetFixture, trendsFixture } from "./fixtures/trendsFixture";

const map: RegionsMap = {
  version: 1,
  source: "test",
  viewBox: [100, 100],
  regions: [["07", "Mazowieckie", "M0 0h10v10z", [5, 5]], ["12", "Śląskie", "M20 20h10v10z", [25, 25]]],
};

describe("buildHomeStats", () => {
  const stats = buildHomeStats(trendsFixture, latestDatasetFixture, map);

  it("liczy hospitalizacje i tryb przyjęcia w każdym roku (metoda konserwatywna)", () => {
    expect(stats).toMatchObject({ latestYear: "2025", previousYear: "2024" });
    expect(stats.years.map(({ year, hospitalizations, months }) => [year, hospitalizations, months])).toEqual([["2023", 8, 1], ["2024", 12, 2], ["2025", 10, 2]]);
    const y2024 = stats.years[1];
    // 2024: nagłe 5, planowe 4, pozostałe 3 z 12.
    expect(y2024.urgentPct).toBeCloseTo(41.67, 1);
    expect(y2024.plannedPct).toBeCloseTo(33.33, 1);
    expect(y2024.otherPct).toBeCloseTo(25, 1);
  });

  it("pokazuje tylko grupy obecne w najnowszym roku, od największej", () => {
    expect(stats.topGroups.map((group) => [group.code, group.latest])).toEqual([["A01", 9], ["F99", 1]]);
    expect(buildHomeStats(trendsFixture, latestDatasetFixture, map, 1).topGroups).toHaveLength(1);
  });

  it("pomija w zmianach r/r małe grupy (poniżej 1000 hospitalizacji rok wcześniej)", () => {
    expect(stats.changes).toEqual({ up: [], down: [] });
  });

  it("liczy mapę województw na 100 tys. mieszkańców z najnowszego roku", () => {
    expect(stats.regions?.map).toBe(map);
    const cells = Object.fromEntries(stats.regions!.cells.map((cell) => [cell.owNfz, cell]));
    expect(cells["07"].hospitalizations).toBe(12);
    expect(cells["12"].hospitalizations).toBe(68);
    expect(stats.regions!.national).toBeCloseTo((80 / 9_800_000) * 100_000);
    expect(cells["12"].ratio).toBeGreaterThan(1);
  });

  it("nie rysuje mapy bez granic albo bez ludności", () => {
    expect(buildHomeStats(trendsFixture, latestDatasetFixture, null).regions).toBeNull();
    expect(buildHomeStats(trendsFixture, { ...latestDatasetFixture, populations: [] }, map).regions).toBeNull();
  });
});
