import { describe, expect, it } from "vitest";
import { cartogramCells, cellColor, movingAverage, OUTLIER_COLOR, poolAdmissions, poolStats, providerPool, scaleColor, selectedIndex, sumSeries, topShare, yearChangePct } from "@/lib/jgpCard";
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
    expect(providerPool(data, { selectedKey: null, scope: "all", regions: [] }).map((row) => row.key)).toEqual(["12|222", "07|111"]);
  });

  it("filtruje po województwie (OW NFZ)", () => {
    expect(providerPool(data, { selectedKey: null, scope: "all", regions: ["07"] }).map((row) => row.key)).toEqual(["07|111"]);
  });

  it("„podobne szpitale” = wybrany + jego pary; bez par — tylko wybrany", () => {
    expect(providerPool(withPeers, { selectedKey: "07|111", scope: "peers", regions: [] }).map((row) => row.key)).toEqual(["12|222", "07|111"]);
    expect(providerPool(data, { selectedKey: "07|111", scope: "peers", regions: [] }).map((row) => row.key)).toEqual(["07|111"]);
    // Bez wybranego szpitala zakres „podobne” nie działa.
    expect(providerPool(withPeers, { selectedKey: null, scope: "peers", regions: [] })).toHaveLength(2);
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

describe("providerPool — kilka województw", () => {
  it("łączy wybrane województwa", () => {
    expect(providerPool(data, { selectedKey: null, scope: "all", regions: ["07", "12"] }).map((row) => row.key)).toEqual(["12|222", "07|111"]);
    expect(providerPool(data, { selectedKey: null, scope: "all", regions: ["99"] })).toEqual([]);
  });
});

describe("movingAverage i poolAdmissions", () => {
  it("liczy średnią kroczącą z 3 miesięcy; na początku z dostępnych miesięcy", () => {
    expect(movingAverage([3, 6, 9, 12])).toEqual([3, 4.5, 6, 9]);
    expect(movingAverage([3, 6, 9, 12], 3, 3)).toEqual([null, null, 6, 9]);
    expect(movingAverage([])).toEqual([]);
  });

  it("sumuje tryb przyjęcia w latach dla wybranych ośrodków", () => {
    expect(poolAdmissions(data.providers)).toEqual([
      { year: "2024", total: 15, planned: 5, urgent: 10, other: 0 },
      { year: "2025", total: 30, planned: 8, urgent: 22, other: 0 },
    ]);
    expect(poolAdmissions(data.providers.filter((row) => row.owNfz === "07"))).toEqual([
      { year: "2024", total: 5, planned: 5, urgent: 0, other: 0 },
      { year: "2025", total: 12, planned: 8, urgent: 4, other: 0 },
    ]);
  });
});

describe("cartogramCells", () => {
  const region = (owNfz: string, per100k: number): RegionRow => ({ owNfz, name: owNfz, population: 1, hospitalizations: 1, per100k, deaths: 0, mortalityPct: 0, urgentPct: 0 });
  const codes = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"];

  it("umieszcza województwa na siatce i skaluje kolor liniowo od minimum do maksimum", () => {
    const { cells, scale } = cartogramCells(codes.map((code, i) => region(code, 10 + i)));
    expect(cells).toHaveLength(16);
    expect(scale).toEqual({ min: 10, max: 25 });
    expect(cells.find((cell) => cell.owNfz === "04")).toMatchObject({ column: 1, row: 2, shortName: "Lubuskie", scale: 0.2, outlier: false });
    expect(cells.find((cell) => cell.owNfz === "01")?.scale).toBe(0);
    expect(cells.find((cell) => cell.owNfz === "16")?.scale).toBe(1);
  });

  it("wartość odstająca nie spłaszcza skali pozostałych województw", () => {
    // Jak E10: lubuskie 75 przy pozostałych 16–31.
    const values = [22, 22, 20, 75, 23, 18, 17, 17, 17, 21, 25, 21, 31, 23, 24, 19];
    const { cells, scale } = cartogramCells(codes.map((code, i) => region(code, values[i])));
    expect(scale).toEqual({ min: 17, max: 31 });
    expect(cells.find((cell) => cell.owNfz === "04")).toMatchObject({ outlier: true, scale: 1 });
    expect(cells.find((cell) => cell.owNfz === "13")).toMatchObject({ outlier: false, scale: 1 });
    expect(cells.find((cell) => cell.owNfz === "01")?.scale).toBeCloseTo(5 / 14);
  });

  it("pomija nieznane kody", () => {
    expect(cartogramCells([region("99", 5)]).cells).toEqual([]);
  });

  it("kolor przechodzi od jasnego do średniego niebieskiego; wartość odstająca ma osobny, ciemniejszy kolor", () => {
    expect(scaleColor(0)).toBe("rgb(225, 233, 245)");
    expect(scaleColor(1)).toBe("rgb(40, 86, 163)");
    expect(scaleColor(2)).toBe(scaleColor(1));
    expect(cellColor({ scale: 1, outlier: true })).toBe(OUTLIER_COLOR);
    expect(cellColor({ scale: 1, outlier: false })).not.toBe(OUTLIER_COLOR);
  });
});
