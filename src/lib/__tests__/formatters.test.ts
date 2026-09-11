import { describe, expect, it } from "vitest";
import { formatCityName } from "@/lib/formatters";

describe("formatCityName", () => {
  it("formats city names for display without changing stored values", () => {
    expect(formatCityName("WARSZAWA")).toBe("Warszawa");
    expect(formatCityName("zielona góra")).toBe("Zielona Góra");
    expect(formatCityName("BIELSKO-BIAŁA")).toBe("Bielsko-Biała");
    expect(formatCityName("  ŁÓDŹ  ")).toBe("Łódź");
  });
});
