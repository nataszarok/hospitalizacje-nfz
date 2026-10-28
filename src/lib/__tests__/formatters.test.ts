import { describe, expect, it } from "vitest";
import { formatCityName, formatCompactCount } from "@/lib/formatters";

describe("formatCityName", () => {
  it("formats city names for display without changing stored values", () => {
    expect(formatCityName("WARSZAWA")).toBe("Warszawa");
    expect(formatCityName("zielona góra")).toBe("Zielona Góra");
    expect(formatCityName("BIELSKO-BIAŁA")).toBe("Bielsko-Biała");
    expect(formatCityName("  ŁÓDŹ  ")).toBe("Łódź");
  });
});

describe("formatCompactCount", () => {
  it.each([
    [7_832_118, "7,8 mln"],
    [1_000_000, "1,0 mln"],
    [48_200, "48,2 tys."],
    [9_999, "9999"],
    [833, "833"],
    [0, "0"],
  ])("formatuje %d jako %s", (value, expected) => {
    expect(formatCompactCount(value).replace(/\u00a0/g, " ")).toBe(expected);
  });
});
