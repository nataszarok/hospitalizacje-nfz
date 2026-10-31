import { describe, expect, it } from "vitest";
import { buildJgpPageData } from "@/lib/jgpPage";
import { latestDatasetFixture, trendsFixture } from "./fixtures/trendsFixture";
import { extrasFixture } from "./fixtures/jgpCardFixture";

describe("buildJgpPageData", () => {
  it("łączy zakres lat z trendów i ranking świadczeniodawców z najnowszego roku", () => {
    const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01");
    expect(data).toMatchObject({
      jgpCode: "A01", name: "Stały produkt", productCodes: ["P1"], catalogYears: ["2023", "2024", "2025"],
      year: "2025", providerCount: 2, hospitalizations: 30,
    });
    expect(data?.topProviders).toMatchObject([
      { key: "12|222", owNfz: "12", nip: "222", name: "Szpital Beta", city: "KATOWICE", voivodeship: "Śląskie", hospitalizations: 18, deaths: 2, mortalityPct: 11.11, urgentPct: 100 },
      { key: "07|111", owNfz: "07", nip: "111", name: "Szpital Alfa", city: "WARSZAWA", voivodeship: "Mazowieckie", hospitalizations: 12, deaths: 1, mortalityPct: 8.33, urgentPct: 33.33 },
    ]);
  });

  it("liczy województwa z trendów najnowszego roku", () => {
    expect(buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")?.regions.map((row) => [row.name, row.hospitalizations]))
      .toEqual([["Śląskie", 18], ["Mazowieckie", 12]]);
  });

  it("używa metody sim i ogranicza liczbę wierszy", () => {
    const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "sim", 1);
    expect(data?.hospitalizations).toBe(34);
    expect(data?.topProviders.map((row) => row.key)).toEqual(["12|222"]);
    // Pełny ranking zostaje do wyróżnienia `?osrodek=` spoza czołówki.
    expect(data?.providers.map((row) => row.key)).toEqual(["12|222", "07|111"]);
  });

  it("pokazuje lata katalogu dla grupy spoza najnowszego roku", () => {
    expect(buildJgpPageData(trendsFixture, latestDatasetFixture, "F04")).toMatchObject({ catalogYears: ["2023", "2024"], providerCount: 0, topProviders: [] });
  });

  it("zwraca null dla nieznanej grupy", () => {
    expect(buildJgpPageData(trendsFixture, latestDatasetFixture, "ZZZ")).toBeNull();
  });

});

describe("buildJgpPageData — tryb przyjęcia i typ grupy", () => {
  it("zwraca strukturę trybu przyjęcia w latach z danymi i typ grupy", () => {
    const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")!;
    expect(data.procedural).toBe(false);
    expect(data.admissions).toEqual([
      { year: "2023", total: 8, planned: 8, urgent: 0, other: 0 },
      { year: "2024", total: 8, planned: 0, urgent: 5, other: 3 },
      { year: "2025", total: 9, planned: 9, urgent: 0, other: 0 },
    ]);
  });
});

describe("buildJgpPageData — plik grupy, wycena i podobne szpitale", () => {
  const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!;

  it("buduje miesiące i trend kraju z pliku grupy", () => {
    expect(data.months).toHaveLength(24);
    expect(data.months.slice(0, 2)).toEqual(["2024-01", "2024-02"]);
    expect(data.national.hospitalizations.slice(12, 15)).toEqual([8, 4, 18]);
    expect(data.national.deaths.slice(12, 15)).toEqual([1, 0, 2]);
    expect(data.national.urgent.slice(12, 15)).toEqual([0, 4, 18]);
    expect(data.previousHospitalizations).toBe(15);
  });

  it("dokłada serie, poprzedni rok i kwoty w zł do świadczeniodawców", () => {
    const [beta, alfa] = data.providers;
    expect(beta).toMatchObject({ key: "12|222", previousHospitalizations: 10, valuePln: 700_000 });
    expect(beta.series[14]).toBe(18);
    expect(alfa).toMatchObject({ key: "07|111", previousHospitalizations: 5, valuePln: 500_000 });
    expect(alfa.series.slice(12, 14)).toEqual([8, 4]);
  });

  it("łączy pary klasy A z dystansem do progu, tylko w obrębie grupy", () => {
    expect(data.providers.map((row) => row.peers)).toEqual([[1], [0]]);
  });

  it("dodaje wycenę i rozliczenia kraju w latach", () => {
    expect(data.valuation).toEqual({ year: "2025", points: 8207, daysFinanced: 30, extraDayPoints: 353 });
    expect(data.valuePln).toEqual([{ year: "2024", value: 900_000 }, { year: "2025", value: 1_200_000 }]);
  });

  it("bez pliku grupy zostawia puste serie i brak wyceny", () => {
    const plain = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")!;
    expect(plain).toMatchObject({ months: [], previousHospitalizations: null, valuation: null, valuePln: [] });
    expect(plain.providers[0]).toMatchObject({ series: [], previousHospitalizations: null, valuePln: null, peers: [] });
  });
});
