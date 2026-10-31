import { describe, expect, it } from "vitest";
import { cartogramCells, cellColor, darkLabel, scaleColor, movingAverage, packPageData, unpackPageData, poolAdmissions, poolStats, providerPool, selectedIndex, sumSeries, topShare, yearChangePct } from "@/lib/jgpCard";
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
    expect(poolAdmissions(data.providers, data.admissionYears)).toEqual([
      { year: "2024", total: 15, planned: 5, urgent: 10, other: 0 },
      { year: "2025", total: 30, planned: 8, urgent: 22, other: 0 },
    ]);
    expect(poolAdmissions(data.providers.filter((row) => row.owNfz === "07"), data.admissionYears)).toEqual([
      { year: "2024", total: 5, planned: 5, urgent: 0, other: 0 },
      { year: "2025", total: 12, planned: 8, urgent: 4, other: 0 },
    ]);
  });
});

describe("cartogramCells", () => {
  // Ludność 100 tys. w każdym województwie: średnia Polski = średnia wartości.
  const region = (owNfz: string, per100k: number): RegionRow => ({ owNfz, name: owNfz, population: 100_000, hospitalizations: per100k, per100k, deaths: 0, mortalityPct: 0, urgentPct: 0 });
  const codes = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"];

  it("liczy odchylenie od średniej Polski w skali logarytmicznej: ½ × = −1, średnia = 0, 2 × = 1", () => {
    const values = [12, 20, 80, ...Array(13).fill(20)];
    const { cells, scale } = cartogramCells(codes.map((code, i) => region(code, values[i])));
    const national = (12 + 80 + 14 * 20) / 16;
    expect(scale.national).toBeCloseTo(national);
    const byCode = new Map(cells.map((cell) => [cell.owNfz, cell]));
    expect(byCode.get("04")).toMatchObject({ column: 1, row: 2, shortName: "Lubuskie" });
    expect(byCode.get("01")?.position).toBeCloseTo(Math.log2(12 / national));
    expect(byCode.get("02")?.position).toBeCloseTo(Math.log2(20 / national));
    // 80 to ponad 2 × średniej: koniec skali.
    expect(byCode.get("03")).toMatchObject({ position: 1 });
    expect(byCode.get("03")?.ratio).toBeCloseTo(80 / national);
  });

  it("skala zależy od proporcji, nie od poziomu: E10 (≈ 20) i grupa z wartościami ≈ 150 dają te same kolory", () => {
    const e10 = [22.3, 21.9, 20.3, 75.2, 23, 17.7, 16.8, 17.4, 16.6, 21.2, 25, 20.9, 30.7, 23.3, 24.3, 18.5];
    const low = cartogramCells(codes.map((code, i) => region(code, e10[i]))).cells;
    const high = cartogramCells(codes.map((code, i) => region(code, e10[i] * 7))).cells;
    high.forEach((cell, i) => expect(cell.position).toBeCloseTo(low[i].position, 10));
    const lubuskie = low.find((cell) => cell.owNfz === "04")!;
    const swietokrzyskie = low.find((cell) => cell.owNfz === "13")!;
    // Lubuskie (ponad 3 × średniej) ma koniec skali; świętokrzyskie (1,3 ×) jest wyraźnie jaśniejsze.
    expect(lubuskie.position).toBe(1);
    expect(swietokrzyskie.position).toBeGreaterThan(0.3);
    expect(swietokrzyskie.position).toBeLessThan(0.5);
  });

  it("pomija nieznane kody", () => {
    expect(cartogramCells([region("99", 5)]).cells).toEqual([]);
  });

  it("kolory: jedna barwa niebieska od jasnej (½ ×) przez średnią do granatowej (2 ×)", () => {
    expect(scaleColor(-1)).toBe("rgb(225, 233, 245)");
    expect(scaleColor(0)).toBe("rgb(110, 145, 204)");
    expect(scaleColor(1)).toBe("rgb(16, 42, 92)");
    expect(scaleColor(5)).toBe(scaleColor(1));
    expect(cellColor({ position: 0 })).toBe(scaleColor(0));
    expect(darkLabel({ position: -0.9 })).toBe(true);
    expect(darkLabel({ position: 0.6 })).toBe(false);
  });
});

describe("packPageData / unpackPageData", () => {
  it("pakuje ranking do krotek i odtwarza identyczne dane strony", () => {
    const packed = packPageData(withPeers);
    expect(packed).not.toHaveProperty("providers");
    expect(packed.providerRows[0]).toEqual(["12|222", "Szpital Beta", "KATOWICE", 18, 2, 11.11, 100, withPeers.providers[0].series, 10, 700_000, [1], [[0, 10, 0], [0, 18, 0]]]);
    expect(unpackPageData(packed)).toEqual(withPeers);
  });
});
