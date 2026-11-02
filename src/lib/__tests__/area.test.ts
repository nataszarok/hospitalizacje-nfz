import { describe, expect, it } from "vitest";
import { areaFromValue, areaLabel, areaMatcher, areaToValue, COUNTRY_AREA, dominantRegionForCity, sameArea, validArea } from "@/lib/area";
import { latestDatasetFixture } from "@/lib/__tests__/fixtures/trendsFixture";
import { referenceFromDataset } from "@/lib/staticData";

const reference = referenceFromDataset(latestDatasetFixture);

describe("obszar analizy", () => {
  it("zamienia obszar na wartość pola wyboru i z powrotem", () => {
    for (const area of [COUNTRY_AREA, { kind: "region", owNfz: "07" }, { kind: "city", city: "KATOWICE" }] as const) {
      expect(areaFromValue(areaToValue(area))).toEqual(area);
    }
    expect(areaFromValue("ow:")).toEqual(COUNTRY_AREA);
    expect(areaFromValue(null)).toEqual(COUNTRY_AREA);
    expect(sameArea({ kind: "region", owNfz: "07" }, areaFromValue("ow:07"))).toBe(true);
  });

  it("odrzuca obszar spoza słownika roku", () => {
    expect(validArea({ kind: "region", owNfz: "99" }, reference)).toEqual(COUNTRY_AREA);
    expect(validArea({ kind: "city", city: "GDYNIA" }, reference)).toEqual(COUNTRY_AREA);
    expect(validArea({ kind: "city", city: "KATOWICE" }, reference)).toEqual({ kind: "city", city: "KATOWICE" });
  });

  it("opisuje obszar po polsku", () => {
    expect(areaLabel(COUNTRY_AREA, reference)).toBe("cała Polska");
    expect(areaLabel({ kind: "region", owNfz: "12" }, reference)).toBe("woj. śląskie");
    expect(areaLabel({ kind: "city", city: "KATOWICE" }, reference)).toBe("Katowice");
  });

  it("dopasowuje świadczeniodawców do województwa i miasta siedziby", () => {
    expect(areaMatcher(latestDatasetFixture, COUNTRY_AREA)).toBeNull();
    const region = areaMatcher(latestDatasetFixture, { kind: "region", owNfz: "12" })!;
    expect([region("12", "222"), region("07", "111")]).toEqual([true, false]);
    // Nazwa miasta w słowniku ma spację na końcu — dopasowanie po przycięciu.
    const city = areaMatcher(latestDatasetFixture, { kind: "city", city: "WARSZAWA" })!;
    expect([city("07", "111"), city("12", "222")]).toEqual([true, false]);
  });

  it("wskazuje województwo, w którym świadczeniodawcy z miasta mają najwięcej hospitalizacji", () => {
    expect(dominantRegionForCity(latestDatasetFixture, "KATOWICE", ["P1"], "min")).toBe("12");
    expect(dominantRegionForCity(latestDatasetFixture, "GLIWICE", ["P1"], "min")).toBeNull();
    expect(dominantRegionForCity(latestDatasetFixture, "GLIWICE", ["P3"], "min")).toBe("12");
  });
});
