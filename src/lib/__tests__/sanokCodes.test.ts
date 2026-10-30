import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_CODES,
  buildCodeRows,
  buildQuarterSeries,
  buildTotalRow,
  formatCount,
  formatJgpName,
  formatQuarter,
  formatShare,
  listQuarters,
  loadSanokDataset,
  sumCounts,
} from "@/lib/sanokCodes";
import { sanokDataset } from "./fixtures/sanokDataset";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatJgpName", () => {
  it("zamienia wielkie litery na zdanie i zostawia skróty", () => {
    expect(formatJgpName("KORONAROGRAFIA I INNE ZABIEGI INWAZYJNE")).toBe("Koronarografia i inne zabiegi inwazyjne");
    expect(formatJgpName("OZW - LECZENIE INWAZYJNE")).toBe("OZW - leczenie inwazyjne");
    expect(formatJgpName("LECZENIE W OINK")).toBe("Leczenie w OINK");
    expect(formatJgpName("WSZCZEPIENIE CRT-D > 17 R.Ż.")).toBe("Wszczepienie CRT-D > 17 r.ż.");
  });

  it("nie zmienia skrótu wewnątrz innego słowa", () => {
    expect(formatJgpName("CHOROBA PWZ")).toBe("Choroba pwz");
  });
});

describe("buildCodeRows", () => {
  it("sumuje hospitalizacje i liczy udział pobytów 6+ dni dla każdej placówki", () => {
    const rows = buildCodeRows(sanokDataset);
    const e53g = rows.find((row) => row.code === "E53G")!;

    expect(e53g.counts).toEqual([4, 15]);
    expect(e53g.longStayShares[0]).toBeCloseTo(0.25);
    expect(e53g.longStayShares[1]).toBeCloseTo(13 / 15);
    expect(e53g.name).toBe("Niewydolność krążenia");
  });

  it("sortuje kody od najliczniejszego", () => {
    expect(buildCodeRows(sanokDataset).map((row) => row.code)).toEqual(["E27", "E53G", "E50"]);
  });

  it("daje null, gdy placówka nie ma hospitalizacji z danym kodem", () => {
    const e27 = buildCodeRows(sanokDataset).find((row) => row.code === "E27")!;
    expect(e27.counts).toEqual([30, 0]);
    expect(e27.longStayShares).toEqual([0, null]);
  });
});

describe("buildTotalRow", () => {
  it("sumuje wszystkie kody", () => {
    const total = buildTotalRow(sanokDataset);
    expect(total.code).toBe(ALL_CODES);
    expect(total.counts).toEqual([36, 19]);
    expect(sumCounts(total)).toBe(55);
    expect(total.longStayShares[1]).toBeCloseTo(17 / 19);
  });
});

describe("buildQuarterSeries", () => {
  it("zwraca serię kwartalną dla wybranego kodu", () => {
    const [pcisn, szpital] = buildQuarterSeries(sanokDataset, "E53G");
    expect(pcisn).toEqual([
      { quarter: "2024-Q1", count: 4, longStayShare: 0.25 },
      { quarter: "2024-Q2", count: 0, longStayShare: null },
    ]);
    expect(szpital.map((point) => point.count)).toEqual([10, 5]);
    expect(szpital[1].longStayShare).toBe(1);
  });

  it("dla wszystkich kodów sumuje każdy kwartał", () => {
    const [pcisn] = buildQuarterSeries(sanokDataset, ALL_CODES);
    expect(pcisn.map((point) => point.count)).toEqual([34, 2]);
  });
});

describe("formatowanie", () => {
  it("formatuje kwartały, liczby i udziały", () => {
    expect(listQuarters(sanokDataset)).toEqual(["2024-Q1", "2024-Q2"]);
    expect(formatQuarter("2024-Q3")).toBe("III kw. 2024");
    expect(formatCount(0)).toBe("–");
    expect(formatCount(12345).replace(/\s/g, " ")).toBe("12 345");
    expect(formatShare(null)).toBe("–");
    expect(formatShare(0.542)).toMatch(/^54,2\s?%$/);
  });
});

describe("loadSanokDataset", () => {
  it("zgłasza błąd, gdy pobranie się nie uda", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, body: null }));
    await expect(loadSanokDataset()).rejects.toThrow("Nie udało się pobrać danych (404).");
  });

  it("rozpakowuje plik gzip", async () => {
    const json = JSON.stringify(sanokDataset);
    const compressed = new Response(json).body!.pipeThrough(new CompressionStream("gzip"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: compressed }));
    await expect(loadSanokDataset()).resolves.toEqual(sanokDataset);
  });
});
