import { describe, expect, it } from "vitest";
import { latestDatasetFixture, regionalTrendsFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";
import { admissionsFromDataset, mortalityFromDataset, productTrend, trendsForRegion } from "@/lib/staticData";

const query = { products: ["P1", "P3"], durations: [], method: "min" as const, minHosp: 0 };

describe("filtr obszaru", () => {
  it("bez obszaru liczy cały kraj", () => {
    expect(mortalityFromDataset(latestDatasetFixture, query).current).toMatchObject({ facilities: 3, hospitalizations: 80 });
  });

  it("zawęża Kto leczy do województwa razem z wartościami bazowymi", () => {
    const data = mortalityFromDataset(latestDatasetFixture, { ...query, area: { kind: "region", owNfz: "12" } });
    expect(data.rows.map((row) => row.nip)).toEqual(["333", "222"]);
    expect(data.current).toMatchObject({ facilities: 2, hospitalizations: 68 });
    expect(data.baseline).toMatchObject({ facilities: 2, hospitalizations: 68 });
  });

  it("zawęża Kto leczy i Tryb przyjęcia do miasta siedziby", () => {
    const area = { kind: "city" as const, city: "WARSZAWA" };
    expect(mortalityFromDataset(latestDatasetFixture, { ...query, area }).rows.map((row) => row.providerName)).toEqual(["Szpital Alfa"]);
    const admissions = admissionsFromDataset(latestDatasetFixture, { ...query, area });
    expect(admissions.rows).toHaveLength(1);
    expect(admissions.rows[0]).toMatchObject({ plannedAdmissions: 8, urgentAdmissions: 4 });
  });

  it("buduje trend miesięczny jednego województwa", () => {
    const trend = productTrend(trendsForRegion(trendsFixture, regionalTrendsFixture, "12"), ["P1"], "min");
    expect(trend.yearly.map((point) => point?.hospitalizations ?? null)).toEqual([0, 5, 0]);
    expect(trend.monthly.map((point) => `${point.year}-${point.month}:${point.hospitalizations}`)).toEqual(["2024-1:2", "2024-2:3"]);
  });

  it("suma trendów województw równa się trendowi krajowemu", () => {
    const national = productTrend(trendsFixture, [], "sim").yearly.map((point) => point?.hospitalizations);
    const sum = ["07", "12"].map((ow) => productTrend(trendsForRegion(trendsFixture, regionalTrendsFixture, ow), [], "sim").yearly.map((point) => point?.hospitalizations ?? 0));
    expect(sum[0].map((value, i) => value + sum[1][i])).toEqual(national);
  });
});
