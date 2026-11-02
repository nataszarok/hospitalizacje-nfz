import { describe, expect, it } from "vitest";
import { funnelCurves, funnelHalfWidth, funnelStatus, providerYearTotals, structureShares } from "@/lib/jgpCard";
import type { JgpProviderRow } from "@/lib/jgpPage";

const row = (hospitalizations: number, yearly: [number, number, number][] = []): JgpProviderRow => ({
  key: `07|${hospitalizations}`, owNfz: "07", nip: String(hospitalizations), name: `S${hospitalizations}`, city: "", voivodeship: "07",
  hospitalizations, deaths: 0, mortalityPct: 0, urgentPct: 0, series: [], previousHospitalizations: null, valuePln: null, peers: [], yearly,
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
