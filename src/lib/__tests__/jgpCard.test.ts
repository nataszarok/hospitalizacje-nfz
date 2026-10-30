import { describe, expect, it } from "vitest";
import { cartogramCells, poolStats, providerPool, selectedIndex, sumSeries, topShare, yearChangePct } from "@/lib/jgpCard";
import { buildJgpPageData } from "@/lib/jgpPage";
import type { RegionRow } from "@/lib/regions";
import { extrasFixture } from "./fixtures/jgpCardFixture";
import { latestDatasetFixture, trendsFixture } from "./fixtures/trendsFixture";

const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, {
  ...extrasFixture,
  peerPairs: [],
})!;
const withPeers = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!;

describe("providerPool", () => {
  it("bez filtrów zwraca cały ranking", () => {
    expect(providerPool(data, { selectedKey: null, scope: "all", region: null }).map((row) => row.key)).toEqual(["12|222", "07|111"]);
  });

  it("filtruje po województwie (OW NFZ)", () => {
    expect(providerPool(data, { selectedKey: null, scope: "all", region: "07" }).map((row) => row.key)).toEqual(["07|111"]);
  });

  it("„podobne szpitale” = wybrany + jego pary; bez par — tylko wybrany", () => {
    expect(providerPool(withPeers, { selectedKey: "07|111", scope: "peers", region: null }).map((row) => row.key)).toEqual(["12|222", "07|111"]);
    expect(providerPool(data, { selectedKey: "07|111", scope: "peers", region: null }).map((row) => row.key)).toEqual(["07|111"]);
    // Bez wybranego szpitala zakres „podobne” nie działa.
    expect(providerPool(withPeers, { selectedKey: null, scope: "peers", region: null })).toHaveLength(2);
  });

  it("znajduje indeks wybranego szpitala", () => {
    expect(selectedIndex(data, "07|111")).toBe(1);
    expect(selectedIndex(data, "99|999")).toBe(-1);
    expect(selectedIndex(data, null)).toBe(-1);
  });
});

describe("liczby grupy", () => {
  it("sumuje serie miesięczne i liczy wskaźniki", () => {
    const total = sumSeries(data.providers, data.months.length);
    expect(total.slice(12, 15)).toEqual([8, 4, 18]);
    expect(poolStats(data.providers)).toMatchObject({ providers: 2, hospitalizations: 30, deaths: 3, mortalityPct: 10 });
  });

  it("liczy udział czołówki i zmianę r/r", () => {
    expect(topShare(data.providers, 1)).toBe(60);
    expect(yearChangePct(30, 15)).toBe(100);
    expect(yearChangePct(30, null)).toBeNull();
    expect(yearChangePct(30, 0)).toBeNull();
  });
});

describe("cartogramCells", () => {
  const region = (owNfz: string, per100k: number): RegionRow => ({ owNfz, name: owNfz, population: 1, hospitalizations: 1, per100k, deaths: 0, mortalityPct: 0, urgentPct: 0 });

  it("umieszcza województwa na siatce i dzieli je na 5 klas", () => {
    const codes = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"];
    const cells = cartogramCells(codes.map((code, i) => region(code, i + 1)));
    expect(cells).toHaveLength(16);
    expect(cells.find((cell) => cell.owNfz === "04")).toMatchObject({ column: 1, row: 2, shortName: "Lubuskie" });
    expect(cells.find((cell) => cell.owNfz === "01")?.level).toBe(1);
    expect(cells.find((cell) => cell.owNfz === "16")?.level).toBe(5);
  });

  it("pomija nieznane kody", () => {
    expect(cartogramCells([region("99", 5)])).toEqual([]);
  });
});
