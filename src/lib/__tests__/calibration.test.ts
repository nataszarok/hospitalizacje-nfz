import { describe, expect, it } from "vitest";
import { calibrationSummaries, type CalibrationSummary } from "@/lib/calibration";

const summary = (year: string): CalibrationSummary => ({
  year, method: "cal-v4", cells: 1, groups: 1, groupsA: 1, groupsB: 0, groupsWithoutApi: 0,
  staysMin: 1, staysCal: 2, staysApi: 2, deathsMin: 0, deathsCal: 0, deathsApi: 0,
  groupsStaysEqualApi: 1, groupsDeathsEqualApi: 1, cellsBelowPatients: 0, groupsBelowPatients: 0,
});

describe("calibrationSummaries", () => {
  it("zwraca lata z kalibracją od najstarszego", () => {
    expect(calibrationSummaries({ "2024": summary("2024"), "2022": summary("2022") }).map((s) => s.year)).toEqual(["2022", "2024"]);
  });

  it("bez kalibracji zwraca pustą listę", () => {
    expect(calibrationSummaries(undefined)).toEqual([]);
  });
});
