import { describe, expect, it } from "vitest";
import { cartogramCells, cellColor, outlierCap, showsMortalityReference, darkLabel, scaleColor, monthYears, movingAverage, sumByYear, packPageData, unpackPageData, poolStats, providerPool, selectedIndex, sumSeries, yearChangePct } from "@/lib/jgpCard";
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

  it("liczy zmianę r/r", () => {
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

describe("movingAverage", () => {
  it("liczy średnią kroczącą z 3 miesięcy; na początku z dostępnych miesięcy", () => {
    expect(movingAverage([3, 6, 9, 12])).toEqual([3, 4.5, 6, 9]);
    expect(movingAverage([3, 6, 9, 12], 3, 3)).toEqual([null, null, 6, 9]);
    expect(movingAverage([])).toEqual([]);
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
    expect(packed.providerRows[0]).toEqual(["12|222", "Szpital Beta", "KATOWICE", 18, 2, 11.11, 100, withPeers.providers[0].series, 10, 700_000, [1], [[0, 10, 0], [0, 18, 0]], [1, 2], [null, 700_000]]);
    expect(unpackPageData(packed)).toEqual(withPeers);
  });
});

describe("monthYears i sumByYear (wykres „Ile?” w latach)", () => {
  const months = ["2023-11", "2023-12", "2024-01", "2024-02", "2024-03"];

  it("zwraca lata w kolejności i liczbę miesięcy danych w roku", () => {
    expect(monthYears(months)).toEqual({ years: ["2023", "2024"], monthCounts: [2, 3] });
    expect(monthYears([])).toEqual({ years: [], monthCounts: [] });
  });

  it("sumuje miesiące w latach", () => {
    expect(sumByYear(months, [1, 2, 3, 4, 5])).toEqual([3, 12]);
    expect(sumByYear([], [])).toEqual([]);
  });
});

describe("showsMortalityReference — linia średniej śmiertelności", () => {
  it("rysuje linię od 0,5%; niższej średniej (ułamek procenta, np. B19G) nie", () => {
    expect(showsMortalityReference(0.5)).toBe(true);
    expect(showsMortalityReference(11.5)).toBe(true);
    expect(showsMortalityReference(0.49)).toBe(false);
    expect(showsMortalityReference(0)).toBe(false);
  });
});

describe("outlierCap — skala osi bez skrajnych małych ośrodków", () => {
  it("1 hospitalizacja i 1 zgon (100%) nie wyznacza skali: koniec 15% nad największą wartością ośrodków z ≥ 10 hospitalizacjami", () => {
    // 40% × 1,15 = 46 → w górę do 50.
    expect(outlierCap([{ x: 1, y: 100 }, { x: 383, y: 40 }, { x: 12, y: 30 }])).toBe(50);
  });

  it("bez punktów ponad skalą albo bez ośrodków z ≥ 10 hospitalizacjami: brak przycięcia", () => {
    expect(outlierCap([{ x: 5, y: 45 }, { x: 383, y: 40 }])).toBeNull();
    expect(outlierCap([{ x: 1, y: 100 }, { x: 3, y: 33 }])).toBeNull();
    expect(outlierCap([])).toBeNull();
  });

  it("skala ma co najmniej 5%", () => {
    expect(outlierCap([{ x: 1, y: 100 }, { x: 50, y: 0 }])).toBe(5);
  });
});
