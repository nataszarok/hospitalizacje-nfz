import { describe, expect, it } from "vitest";
import { formatAtLeastCount, formatCityName, formatCompactCount, formatJgpName, formatPln, formatYearRange, shortenName } from "@/lib/formatters";

describe("formatCityName", () => {
  it("formats city names for display without changing stored values", () => {
    expect(formatCityName("WARSZAWA")).toBe("Warszawa");
    expect(formatCityName("zielona góra")).toBe("Zielona Góra");
    expect(formatCityName("BIELSKO-BIAŁA")).toBe("Bielsko-Biała");
    expect(formatCityName("  ŁÓDŹ  ")).toBe("Łódź");
  });
});

describe("formatAtLeastCount", () => {
  it.each([
    [49_613_383, "ponad 49 mln"],
    [49_999_999, "ponad 49 mln"],
    [1_000_000, "ponad 1 mln"],
    [48_200, "ponad 48 tys."],
    [9_999, "9999"],
    [833, "833"],
    [0, "0"],
  ])("%d → %s (dolna granica, część jednostki obcięta)", (value, expected) => {
    expect(formatAtLeastCount(value)).toBe(expected);
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

describe("formatYearRange", () => {
  it("pokazuje jeden rok bez myślnika", () => {
    expect(formatYearRange("2025", "2025")).toBe("2025");
  });

  it("pokazuje zakres wielu lat z półpauzą", () => {
    expect(formatYearRange("2019", "2025")).toBe("2019–2025");
  });
});

describe("formatJgpName", () => {
  it("zamienia nazwę z katalogu NFZ na zdanie i zostawia liczby rzymskie", () => {
    expect(formatJgpName("USUNIĘCIE ZAĆMY - KATEGORIA II")).toBe("Usunięcie zaćmy - kategoria II");
    // Kilka gwiazdek na końcu nazwy (np. F30 w danych NFZ: „GRUBEGO* *”).
    expect(formatJgpName("KOMPLEKSOWE I DUŻE ZABIEGI JELITA GRUBEGO* *")).toBe("Kompleksowe i duże zabiegi jelita grubego");
    expect(formatJgpName("ŚREDNIE ZABIEGI GÓRNEGO ODCINKA *")).toBe("Średnie zabiegi górnego odcinka");
    expect(formatJgpName("PORÓD")).toBe("Poród");
    expect(formatJgpName("KORONAROGRAFIA I INNE ZABIEGI")).toBe("Koronarografia i inne zabiegi");
    expect(formatJgpName("USUNIĘCIE ZAĆMY - KATEGORIA I")).toBe("Usunięcie zaćmy - kategoria I");
    expect(formatJgpName("ZABIEGI (III STOPIEŃ)")).toBe("Zabiegi (III stopień)");
  });
});

describe("shortenName", () => {
  it("skraca długą nazwę na granicy słowa i dodaje wielokropek; krótką zostawia", () => {
    const long = "Endoprotezoplastyka pierwotna całkowita biodra z rekonstrukcją kostną, endoprotezoplastyka stawu biodrowego";
    expect(shortenName(long)).toBe("Endoprotezoplastyka pierwotna całkowita biodra…");
    expect(shortenName(long).length).toBeLessThanOrEqual(48);
    expect(shortenName("Poród")).toBe("Poród");
    // Bez spacji w drugiej połowie: cięcie w środku słowa.
    expect(shortenName("A".repeat(60), 10)).toBe(`${"A".repeat(9)}…`);
  });

  it("nie zostawia przecinka ani spójnika-myślnika przed wielokropkiem", () => {
    expect(shortenName("Zabiegi naprawcze, rekonstrukcyjne i inne", 20)).toBe("Zabiegi naprawcze…");
  });
});

describe("formatPln", () => {
  it("dobiera jednostkę do wielkości kwoty", () => {
    expect(formatPln(64_277_000_000)).toBe("64,3 mld zł");
    expect(formatPln(274_000_000)).toBe("274 mln zł");
    expect(formatPln(3_400_000)).toBe("3,4 mln zł");
    expect(formatPln(450_400)).toBe("450 tys. zł");
  });
});
