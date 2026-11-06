import { describe, expect, it } from "vitest";
import { latestDatasetFixture, regionalTrendsFixtures, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";
import { admissionsFromDataset, mortalityFromDataset, productTrend, trendsForRegion, trendsForRegions } from "@/lib/staticData";

const query = { products: ["P1", "P3"], durations: [], method: "min" as const, minHosp: 0 };

describe("filtr obszaru", () => {
  it("bez obszaru liczy cały kraj", () => {
    expect(mortalityFromDataset(latestDatasetFixture, query).current).toMatchObject({ facilities: 3, hospitalizations: 80 });
  });

  it("zawęża Kto leczy do województwa razem z wartościami bazowymi", () => {
    const data = mortalityFromDataset(latestDatasetFixture, { ...query, areas: [{ kind: "region", owNfz: "12" }] });
    expect(data.rows.map((row) => row.nip)).toEqual(["333", "222"]);
    expect(data.current).toMatchObject({ facilities: 2, hospitalizations: 68 });
    expect(data.baseline).toMatchObject({ facilities: 2, hospitalizations: 68 });
  });

  it("zawęża Kto leczy i Tryb przyjęcia do miasta siedziby", () => {
    const areas = [{ kind: "city" as const, city: "WARSZAWA" }];
    expect(mortalityFromDataset(latestDatasetFixture, { ...query, areas }).rows.map((row) => row.providerName)).toEqual(["Szpital Alfa"]);
    const admissions = admissionsFromDataset(latestDatasetFixture, { ...query, areas });
    expect(admissions.rows).toHaveLength(1);
    expect(admissions.rows[0]).toMatchObject({ plannedAdmissions: 8, urgentAdmissions: 4 });
  });

  it("kilka obszarów naraz to ich suma (województwo i miasto z innego województwa)", () => {
    const areas = [{ kind: "region" as const, owNfz: "12" }, { kind: "city" as const, city: "WARSZAWA" }];
    expect(mortalityFromDataset(latestDatasetFixture, { ...query, areas }).current).toMatchObject({ facilities: 3, hospitalizations: 80 });
    expect(mortalityFromDataset(latestDatasetFixture, { ...query, areas: [areas[1]] }).current).toMatchObject({ facilities: 1, hospitalizations: 12 });
  });

  it("trend kilku województw sumuje pliki regionalne", () => {
    const both = productTrend(trendsForRegions(trendsFixture, [regionalTrendsFixtures["07"], regionalTrendsFixtures["12"]]), ["P1"], "min");
    const one = (ow: string) => productTrend(trendsForRegion(trendsFixture, regionalTrendsFixtures[ow]), ["P1"], "min");
    expect(both.yearly.map((point) => point?.hospitalizations ?? null)).toEqual(one("07").yearly.map((point, i) => (point?.hospitalizations ?? 0) + (one("12").yearly[i]?.hospitalizations ?? 0)));
  });

  it("buduje trend miesięczny jednego województwa", () => {
    const trend = productTrend(trendsForRegion(trendsFixture, regionalTrendsFixtures["12"]), ["P1"], "min");
    expect(trend.yearly.map((point) => point?.hospitalizations ?? null)).toEqual([0, 5, 0]);
    expect(trend.monthly.map((point) => `${point.year}-${point.month}:${point.hospitalizations}`)).toEqual(["2024-1:2", "2024-2:3"]);
  });

  it("suma trendów województw równa się trendowi krajowemu", () => {
    const national = productTrend(trendsFixture, [], "sim").yearly.map((point) => point?.hospitalizations);
    const sum = ["07", "12"].map((ow) => productTrend(trendsForRegion(trendsFixture, regionalTrendsFixtures[ow]), [], "sim").yearly.map((point) => point?.hospitalizations ?? 0));
    expect(sum[0].map((value, i) => value + sum[1][i])).toEqual(national);
  });
});
