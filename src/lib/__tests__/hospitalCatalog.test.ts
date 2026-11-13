import { describe, expect, it } from "vitest";
import { biggestHospitalChanges, buildHospitalCatalog, CATALOG_DOT_RADIUS, catalogCityPoints, catalogDotRadius, catalogFacilityDots, latestNetResult, type HospitalCatalogRow } from "@/lib/hospitalCatalog";
import type { FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";

const index: FacilityYearsIndex = {
  version: 1,
  years: ["2024", "2025"],
  facilities: [["16", "111", "SZPITAL ALFA ", "KOSZALIN"], ["07", "222", "Szpital Beta", "WARSZAWA"], ["07", "333", "Pusty", "RADOM"], ["12", "444", "Nowy", "KATOWICE"]],
  active: [3, 3, 0, 2],
};
// Dwie sekcje (litery JGP): hospitalizacje placówki sumują się z obu.
const sections: FacilityYearsSection[] = [
  { version: 2, products: ["P1"], rows: { product: [0, 0, 0, 0], facility: [0, 0, 1, 1], year: [0, 1, 0, 1], hMin: [1000, 1500, 2000, 1000], hSim: [0, 0, 0, 0], dMin: [10, 30, 40, 20], dSim: [0, 0, 0, 0] } },
  { version: 2, products: ["P2"], rows: { product: [0, 0], facility: [0, 3], year: [1, 1], hMin: [500, 50], hSim: [0, 0], dMin: [10, 0], dSim: [0, 0] } },
];

const catalog = buildHospitalCatalog({
  index, sections,
  psz: new Map([["111", 2]]), pszLevels: ["I stopnia", "II stopnia", "III stopnia"],
  profiles: [{ oz_nfz: "16", nip: "111", core: { beds: 557 } }],
  financial: [{ nip: "111", years: [{ year: 2024, revenue: 1, net_result: -2, net_margin: null }, { year: 2025, revenue: 1, net_result: 15_100_000, net_margin: null }] }],
  regions: { "16": "zachodniopomorskie", "07": "mazowieckie" },
});

describe("buildHospitalCatalog", () => {
  it("jeden wiersz na świadczeniodawcę z hospitalizacjami, od największej liczby w najnowszym roku", () => {
    expect(catalog.rows.map((row) => row.key)).toEqual(["16|111", "07|222", "12|444"]);
    const [alfa, beta, nowy] = catalog.rows;
    expect(alfa).toMatchObject({ name: "SZPITAL ALFA", series: [1000, 2000], latest: 2000, previous: 1000, changePct: 100, mortalityPct: 2, beds: 557, psz: 2, net: { year: 2025, value: 15_100_000 } });
    expect(beta).toMatchObject({ changePct: -50, psz: null, beds: null, net: null });
    // Bez hospitalizacji w poprzednim roku zmiana r/r jest nieznana.
    expect(nowy.changePct).toBeNull();
  });

  it("liczy sumy nagłówka: świadczeniodawcy w najnowszym roku, sieć PSZ, hospitalizacje i łóżka", () => {
    expect(catalog.totals).toEqual({ providers: 3, inPsz: 1, inPszLatest: 2000, latest: 3050, previous: 3000, beds: 557 });
    expect(catalog.latestYear).toBe("2025");
    expect(catalog.previousYear).toBe("2024");
  });
});

describe("biggestHospitalChanges i latestNetResult", () => {
  it("zmiany tylko dla szpitali z progiem hospitalizacji w poprzednim roku", () => {
    const { up, down } = biggestHospitalChanges(catalog.rows, 1000);
    expect(up.map((row) => row.key)).toEqual(["16|111", "07|222"]);
    expect(down.map((row) => row.key)).toEqual(["07|222", "16|111"]);
  });

  it("wynik netto z najnowszego roku, w którym jest kwota", () => {
    expect(latestNetResult({ nip: "1", years: [{ year: 2025, revenue: null, net_result: null, net_margin: null }, { year: 2024, revenue: null, net_result: -3, net_margin: null }] })).toEqual({ year: 2024, value: -3 });
    expect(latestNetResult(undefined)).toBeNull();
  });
});

describe("catalogCityPoints", () => {
  const row = (key: string, city: string, latest: number, psz: number | null = null): HospitalCatalogRow => ({
    key, owNfz: "07", nip: key, name: key, city, psz, series: [0, latest], latest, previous: 0, changePct: null, mortalityPct: null, beds: null, net: null,
  });
  const cities: [string, string, number, number, number, string][] = [["WARSZAWA", "07", 600, 400, 1, "2021"], ["RADOM", "07", 620, 500, 1, "2021"]];

  it("sumuje szpitale miasta, od największego miasta; sieć PSZ, gdy choć jeden szpital jest w sieci", () => {
    const { points, missing } = catalogCityPoints([row("a", "WARSZAWA", 100), row("b", "WARSZAWA", 300, 1), row("c", "RADOM", 50), row("d", "WIEŚ", 20), row("e", "RADOM", 0)], cities);
    expect(points.map((point) => [point.city, point.hospitalizations, point.inPsz, point.rows.map((item) => item.key)])).toEqual([
      ["WARSZAWA", 400, true, ["b", "a"]],
      ["RADOM", 50, false, ["c"]],
    ]);
    // Siedziba spoza słownika miast nie ma punktu; szpital bez hospitalizacji w najnowszym roku pomijamy.
    expect(missing).toBe(1);
  });
});

describe("catalogFacilityDots", () => {
  const row = (key: string, city: string, latest: number): HospitalCatalogRow => ({
    key, owNfz: "07", nip: key, name: key, city, psz: null, series: [0, latest], latest, previous: 0, changePct: null, mortalityPct: null, beds: null, net: null,
  });
  const cities: [string, string, number, number, number, string][] = [["WARSZAWA", "07", 600, 400, 1, "2021"], ["PIASECZNO", "07", 604, 400, 1, "2021"]];

  it("kropka na szpital: największy w punkcie miasta, pozostałe wokół; bez nachodzenia także między miastami", () => {
    const { dots, missing } = catalogFacilityDots([row("a", "WARSZAWA", 400), row("b", "WARSZAWA", 100), row("c", "PIASECZNO", 100), row("d", "WIEŚ", 50), row("e", "WARSZAWA", 0)], cities, (value) => Math.sqrt(value) / 2);
    expect(dots.map((dot) => dot.row.key).sort()).toEqual(["a", "b", "c"]);
    expect(missing).toBe(1);
    for (const [i, a] of dots.entries()) for (const b of dots.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
  });
});

describe("catalogDotRadius", () => {
  it("od minimum do maksimum, pierwiastek wartości; bez hospitalizacji — bez kropki", () => {
    expect(catalogDotRadius(0, 84_000)).toBe(0);
    expect(catalogDotRadius(1, 84_000)).toBeCloseTo(CATALOG_DOT_RADIUS.min, 1);
    expect(catalogDotRadius(84_000, 84_000)).toBe(CATALOG_DOT_RADIUS.max);
    // Placówka 4× większa nie ma kropki 4× większej w polu: 21 tys. ma promień ok. połowy drogi od minimum do maksimum.
    expect(catalogDotRadius(21_000, 84_000)).toBeCloseTo(CATALOG_DOT_RADIUS.min + (CATALOG_DOT_RADIUS.max - CATALOG_DOT_RADIUS.min) / 2);
  });
});
