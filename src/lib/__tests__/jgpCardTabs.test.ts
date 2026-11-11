import { describe, expect, it } from "vitest";
import { defaultCardYear, funnelCurves, funnelHalfWidth, limitToCatalogYears, funnelStatus, movingRatio, providerYearTotals, ratioSeries, structureShares, topProvidersOfPeriod, activeSpan } from "@/lib/jgpCard";
import type { JgpPageData, JgpProviderRow } from "@/lib/jgpPage";

const row = (hospitalizations: number, yearly: [number, number, number][] = []): JgpProviderRow => ({
  key: `07|${hospitalizations}`, owNfz: "07", nip: String(hospitalizations), name: `S${hospitalizations}`, city: "", voivodeship: "07",
  hospitalizations, deaths: 0, mortalityPct: 0, urgentPct: 0, series: [], previousHospitalizations: null, valuePln: null, peers: [], yearly, yearlyDeaths: [], yearlyValuePln: [],
});

describe("structureShares — struktura ośrodków nad rankingiem", () => {
  it("dzieli hospitalizacje na 3 największe, miejsca 4–10 i pozostałe", () => {
    const rows = [50, 20, 10, 5, 5, 2, 2, 2, 2, 1, 1].map((h) => row(h));
    expect(structureShares(rows)).toEqual([
      { label: "3 największe", count: 3, share: 80 },
      { label: "miejsca 4–10", count: 7, share: 19 },
      { label: "pozostałe 1", count: 1, share: 1 },
    ]);
  });

  it("pomija puste części przy małej grupie", () => {
    expect(structureShares([row(3), row(1)])).toEqual([{ label: "3 największe", count: 2, share: 100 }]);
  });
});

describe("providerYearTotals", () => {
  it("sumuje tryby przyjęcia w każdym roku", () => {
    expect(providerYearTotals(row(0, [[1, 2, 3], [0, 0, 0]]))).toEqual([6, 0]);
  });
});

describe("lejek śmiertelności", () => {
  it("granica zwęża się z liczbą hospitalizacji", () => {
    expect(funnelHalfWidth(5, 100, 1.96)).toBeCloseTo(4.27, 2);
    expect(funnelHalfWidth(5, 1000, 1.96)).toBeLessThan(funnelHalfWidth(5, 100, 1.96));
  });

  it("ocenia ośrodek względem granic 95% i 99,8%", () => {
    expect(funnelStatus(6, 5, 100)).toBe("w granicach");
    expect(funnelStatus(10, 5, 400)).toBe("powyżej 99,8%");
    expect(funnelStatus(7, 5, 400)).toBe("w granicach");
    expect(funnelStatus(7.5, 5, 400)).toBe("powyżej 95%");
    expect(funnelStatus(1, 5, 400)).toBe("poniżej 99,8%");
  });

  it("krzywe mają tyle punktów co oś X i nie schodzą poniżej zera", () => {
    const c = funnelCurves(2, 10, 1000, 20);
    expect(c.x).toHaveLength(21);
    expect(c.inner[0]).toHaveLength(21);
    expect(Math.min(...c.outer[1])).toBeGreaterThanOrEqual(0);
    expect(c.outer[0][0]).toBeGreaterThan(c.inner[0][0]);
  });
});

import { dataForYear } from "@/lib/jgpCard";
import { familyFor } from "@/lib/jgpGroupInfo";
import type { JgpProfilesFile } from "@/lib/jgpDescription";
import { buildJgpPageData } from "@/lib/jgpPage";
import { extrasFixture, groupFileFixture } from "@/lib/__tests__/fixtures/jgpCardFixture";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

describe("rodziny i opisy grup (E10, H52, H55)", () => {
  it("E10, H52 i H55 mają rodzinę", () => {
    for (const code of ["E10", "H52", "H55"]) expect(familyFor(code)?.codes).toContain(code);
    expect(familyFor("H52")?.id).toBe(familyFor("H55")?.id);
    expect(familyFor("A01")).toBeNull();
  });

  it("dane strony liczą udziały wariantów rodziny w latach z trendów", () => {
    // Te same dane co A01, ale produkty nazwane jak warianty OZW.
    const trends = { ...trendsFixture, products: trendsFixture.products.map((p, i) => i === 0 ? ["P1", "E10", "OZW - DIAGNOSTYKA INWAZYJNA *", p[3]] : i === 1 ? ["P2", "E11", "OZW - LECZENIE INWAZYJNE DWUETAPOWE > 3 DNI *", p[3]] : p) as typeof trendsFixture.products };
    const latest = { ...latestDatasetFixture, products: [["P1", "E10", "OZW - DIAGNOSTYKA INWAZYJNA *"]] as typeof latestDatasetFixture.products };
    const profiles: JgpProfilesFile = { version: 1, source: "test", icd10: { "I21.4": "Ostry zawał serca podwsierdziowy" }, icd9: {}, groups: { E10: ["2024", 90, 100, 4, [["I21.4", 57]], []] } };
    expect(buildJgpPageData(trends, latest, "E10")!.description).toBeNull();
    const data = buildJgpPageData(trends, latest, "E10", "min", 15, { profiles })!;
    expect(data.description?.sentences[0]).toBe("Najczęstsze rozpoznania główne: ostry zawał serca podwsierdziowy (I21.4, 57%).");
    expect(data.description?.sentences.at(-1)).toBe("Należy do rodziny „Ostry zespół wieńcowy (OZW)”; pozostałe warianty: E11, E12G, E15, E16 i E17G.");
    expect(data.family?.name).toBe("Ostry zespół wieńcowy (OZW)");
    expect(data.family?.variants.map((variant) => [variant.code, variant.values])).toEqual([["E10", [8, 8, 9]], ["E11", [0, 4, null]]]);
    expect(data.family?.variants[1].name).toBe("OZW - LECZENIE INWAZYJNE DWUETAPOWE > 3 DNI");
  });
});

describe("dataForYear — karta dla wcześniejszego roku", () => {
  const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!;

  it("najnowszy rok zwraca dane bez zmian", () => {
    expect(dataForYear(data, 1)).toBe(data);
  });

  it("2024: ranking, zgony, tryb i rozliczenia ośrodków z pliku grupy (kwoty tego roku)", () => {
    const year = dataForYear(data, 0);
    expect(year.year).toBe("2024");
    expect(year.providers.map((row) => [row.name, row.hospitalizations, row.deaths, row.urgentPct, row.valuePln])).toEqual([
      ["Szpital Beta", 10, 1, 100, null],
      ["Szpital Alfa", 5, 0, 0, 300_000],
    ]);
    expect(year.hospitalizations).toBe(15);
    expect(year.previousHospitalizations).toBeNull();
    expect(year.regions.find((row) => row.owNfz === "07")?.hospitalizations).toBe(8);
  });

  it("ośrodek tylko z wcześniejszego roku jest w rankingu tego roku, a nie w najnowszym", () => {
    const groupFile = { ...groupFileFixture, providers: [...groupFileFixture.providers, "12|333"], rows: [...groupFileFixture.rows, [2, 3, 0, 7, 0]] as typeof groupFileFixture.rows };
    const withFormer = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, { ...extrasFixture, groupFile, allYearProviders: true })!;
    expect(withFormer.providerCount).toBe(2);
    expect(withFormer.topProviders.map((row) => row.name)).toEqual(["Szpital Beta", "Szpital Alfa"]);
    // Najnowszy rok na karcie: bez ośrodka, który miał hospitalizacje tylko wcześniej.
    expect(dataForYear(withFormer, 1).providers.map((row) => row.name)).toEqual(["Szpital Beta", "Szpital Alfa"]);
    expect(dataForYear(withFormer, 0).providers.map((row) => [row.name, row.hospitalizations])).toEqual([["Szpital Beta", 10], ["Szpital Gamma", 7], ["Szpital Alfa", 5]]);
    const without = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, { ...extrasFixture, groupFile })!;
    expect(without.providers.map((row) => row.name)).not.toContain("Szpital Gamma");
  });
});

describe("ratioSeries i movingRatio — udziały miesięczne w „Ile?”", () => {
  it("udział miesiąca w procentach; brak hospitalizacji = brak punktu", () => {
    expect(ratioSeries([1, 0, 2], [10, 0, 4])).toEqual([10, null, 50]);
  });

  it("udział 3M to suma licznika / suma mianownika, nie średnia udziałów", () => {
    const shares = movingRatio([1, 0, 2, 0], [10, 0, 4, 2]);
    expect(shares[0]).toBe(10);
    expect(shares[2]).toBeCloseTo((3 / 14) * 100);
    expect(shares[3]).toBeCloseTo((2 / 6) * 100);
    expect(movingRatio([0], [0])).toEqual([null]);
  });
});

describe("limitToCatalogYears — lata grupy w katalogu", () => {
  // Grupa wycofana po 2018 r.: plik grupy ma lata 2017–2020, katalog tylko 2017–2018.
  const months = ["2017", "2018", "2019", "2020"].flatMap((year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));
  const provider: JgpProviderRow = {
    ...row(0, [[1, 4, 0], [2, 3, 0], [0, 0, 0], [0, 0, 0]]),
    series: months.map((month) => month < "2019" ? 1 : 0),
    yearlyDeaths: [1, 0, 0, 0],
    yearlyValuePln: [null, null, null, null],
  };
  const data = {
    jgpCode: "E03", name: "", procedural: true, productCodes: ["P"], catalogYears: ["2017", "2018"], year: "2020",
    providerCount: 0, hospitalizations: 0, topProviders: [provider], providers: [provider], regions: [], regionYears: [],
    admissions: [], admissionYears: ["2017", "2018", "2019", "2020"], months,
    national: { hospitalizations: months.map(() => 1), deaths: months.map(() => 0), urgent: months.map(() => 0) },
    previousHospitalizations: null, valuation: null, valuePln: [], family: null, description: null,
  } as JgpPageData;

  it("obcina lata, miesiące i serie do lat grupy", () => {
    const limited = limitToCatalogYears(data);
    expect(limited.admissionYears).toEqual(["2017", "2018"]);
    expect(limited.months).toHaveLength(24);
    expect(limited.national.hospitalizations).toHaveLength(24);
    expect(limited.providers[0].series).toHaveLength(24);
    expect(limited.providers[0].yearly).toEqual([[1, 4, 0], [2, 3, 0]]);
    expect(limited.topProviders[0]).toBe(limited.providers[0]);
    expect(limited.year).toBe("2020");
  });

  it("rok domyślny to ostatni rok grupy, a jego liczby pochodzą z lat ośrodka", () => {
    const limited = limitToCatalogYears(data);
    expect(defaultCardYear(limited)).toBe("2018");
    const year = dataForYear(limited, limited.admissionYears.indexOf(defaultCardYear(limited)));
    expect(year.hospitalizations).toBe(5);
    expect(year.previousHospitalizations).toBe(5);
  });

  it("grupa obecna we wszystkich latach zostaje bez zmian", () => {
    const full = { ...data, catalogYears: data.admissionYears, year: "2020" };
    expect(limitToCatalogYears(full)).toBe(full);
    expect(defaultCardYear(full)).toBe("2020");
  });
});

describe("topProvidersOfPeriod — linie ośrodków w „Ile?”", () => {
  const months = ["2023-01", "2023-02", "2024-01", "2024-02", "2025-01", "2025-02"];
  const provider = (name: string, series: number[]) => ({ ...row(0), key: name, name, series });
  // A: lokalny wzrost w 2023 (jak Koszalin w H52); B, C: duże w ostatnich latach; D: zawsze mały; Z: bez hospitalizacji.
  const a = provider("A", [500, 400, 5, 5, 1, 1]);
  const b = provider("B", [20, 20, 60, 60, 50, 50]);
  const c = provider("C", [30, 30, 40, 40, 45, 45]);
  const d = provider("D", [1, 1, 1, 1, 1, 1]);
  const z = provider("Z", [0, 0, 0, 0, 0, 0]);

  it("bierze największe ośrodki z każdego roku, razem bez powtórzeń; kolejność według sumy okresu", () => {
    // Top 1: 2023 → A, 2024 → B, 2025 → B.
    expect(topProvidersOfPeriod([b, c, a, d, z], months, 1).map((item) => item.name)).toEqual(["A", "B"]);
    // Top 2: 2023 → A, C; 2024 → B, C; 2025 → B, C.
    expect(topProvidersOfPeriod([b, c, a, d, z], months, 2).map((item) => item.name)).toEqual(["A", "B", "C"]);
  });

  it("pomija ośrodki bez hospitalizacji", () => {
    expect(topProvidersOfPeriod([z, d], months, 5).map((item) => item.name)).toEqual(["D"]);
  });
});

describe("activeSpan — okres aktywności ośrodka", () => {
  it("od pierwszej do ostatniej niezerowej wartości; zera w środku zostają w okresie", () => {
    expect(activeSpan([0, 0, 117, 0, 250, 0, 0])).toEqual([2, 4]);
    expect(activeSpan([5])).toEqual([0, 0]);
    expect(activeSpan([0, 0])).toBeNull();
  });
});
