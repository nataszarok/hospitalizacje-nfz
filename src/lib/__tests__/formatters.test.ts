import { describe, expect, it } from "vitest";
import { formatAtLeastCount, formatCityName, formatSigned, formatCompactCount, formatJgpName, formatPln, formatYearRange, plnScale, shortenName } from "@/lib/formatters";

describe("formatCityName", () => {
  it("formats city names for display without changing stored values", () => {
    expect(formatCityName("WARSZAWA")).toBe("Warszawa");
    expect(formatCityName("zielona góra")).toBe("Zielona Góra");
    expect(formatCityName("BIELSKO-BIAŁA")).toBe("Bielsko-Biała");
    expect(formatCityName("  ŁÓDŹ  ")).toBe("Łódź");
  });
});

describe("formatSigned", () => {
  it.each([
    [5.74, "", "+5,7"],
    [-1.25, " pp", "−1,3 pp"],
    [0, " pp", "0,0 pp"],
    [-9.1, "", "−9,1"],
  ])("%d%s → %s (polski minus, plus przy dodatnich)", (value, unit, expected) => {
    expect(formatSigned(value, unit)).toBe(expected);
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
  it("dobiera jednostkę i miejsca dziesiętne do wielkości kwoty (DESIGN.md 3.1)", () => {
    expect(formatPln(64_277_000_000)).toBe("64,3 mld zł");
    expect(formatPln(1_403_200_000)).toBe("1,4 mld zł");
    expect(formatPln(302_400_000)).toBe("302 mln zł");
    expect(formatPln(38_210_000)).toBe("38,2 mln zł");
    expect(formatPln(3_400_000)).toBe("3,4 mln zł");
    expect(formatPln(845_400)).toBe("845 tys. zł");
  });

  it("przechodzi do większej jednostki po zaokrągleniu (nigdy 1 000 w jednostce)", () => {
    expect(formatPln(999_600_000)).toBe("1,0 mld zł");
    expect(formatPln(999_700)).toBe("1,0 mln zł");
    expect(formatPln(99_960_000)).toBe("100 mln zł");
  });

  it("używa polskiego minusa", () => {
    expect(formatPln(-2_345_000_000)).toBe("−2,3 mld zł");
    expect(formatPln(-38_200_000)).toBe("−38,2 mln zł");
  });
});

describe("plnScale", () => {
  it("dobiera jedną jednostkę dla zestawu kwot według największej", () => {
    const scale = plnScale([820_000_000, 1_403_200_000]);
    expect(scale.unit).toBe("mld zł");
    expect(scale.format(820_000_000)).toBe("0,8");
    expect(scale.format(1_403_200_000)).toBe("1,4");
  });

  it("w mln poniżej 100 mln podaje 1 miejsce po przecinku", () => {
    const scale = plnScale([12_400_000, 38_600_000]);
    expect(scale.unit).toBe("mln zł");
    expect(scale.format(12_400_000)).toBe("12,4");
    expect(scale.format(38_600_000)).toBe("38,6");
  });

  it("w mln od 100 mln podaje pełne liczby dla całego zestawu", () => {
    const scale = plnScale([12_400_000, 302_400_000]);
    expect(scale.format(12_400_000)).toBe("12");
    expect(scale.format(302_400_000)).toBe("302");
  });
});
