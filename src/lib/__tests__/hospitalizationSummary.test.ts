import { describe, expect, it } from "vitest";
import { buildHospitalizationSummary, JGP_SECTION_LABELS } from "@/lib/hospitalizationSummary";
import type { RegionsMap } from "@/lib/jgpCard";
import type { StaticDataset, TrendsDataset } from "@/lib/staticData";
import { latestDatasetFixture, trendsFixture } from "./fixtures/trendsFixture";

describe("buildHospitalizationSummary", () => {
  const summary = buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null);

  it("liczy lata: hospitalizacje, zgony i odsetek zgonów (metoda konserwatywna)", () => {
    expect(summary).toMatchObject({ firstYear: "2023", latestYear: "2025", previousYear: "2024", regions: null });
    expect(summary.summaryYears.map(({ year, hospitalizations, deaths }) => [year, hospitalizations, deaths])).toEqual([["2023", 8, 1], ["2024", 12, 1], ["2025", 10, 1]]);
    expect(summary.summaryYears[2].mortalityPct).toBeCloseTo(10);
  });

  it("liczy świadczeniodawców i udział 10% największych z pliku roku; rok bez pliku ma zero", () => {
    expect(summary.summaryYears[2]).toMatchObject({ providers: 3 });
    // 111: 12, 222: 18, 333: 50 → największy (10% z 3 = 1 podmiot) ma 50 z 80.
    expect(summary.summaryYears[2].top10Pct).toBeCloseTo(62.5);
    expect(summary.summaryYears[0]).toMatchObject({ providers: 0, top10Pct: 0 });
  });

  it("zwraca miesiące pierwszego, poprzedniego i ostatniego roku; miesiąc bez danych to null", () => {
    expect(summary.months).toEqual([
      { year: "2023", values: [8, null, null, null, null, null, null, null, null, null, null, null] },
      { year: "2024", values: [9, 3, null, null, null, null, null, null, null, null, null, null] },
      { year: "2025", values: [9, null, 1, null, null, null, null, null, null, null, null, null] },
    ]);
  });

  it("grupuje hospitalizacje w sekcje katalogu (pierwsza litera kodu), od największej w ostatnim roku", () => {
    expect(summary.sections.map(({ letter, label, series }) => [letter, label, series])).toEqual([
      ["A", JGP_SECTION_LABELS.A, [8, 8, 9]],
      ["F", JGP_SECTION_LABELS.F, [0, 4, 1]],
    ]);
    expect(summary.sections[0].changePct).toBeCloseTo(12.5);
    expect(summary.sections[0].sharePct).toBeCloseTo(90);
    // Brak hospitalizacji w pierwszym roku: zmiany nie liczymy.
    expect(summary.sections[1].changePct).toBeNull();
  });

  it("szuka największych zmian od pierwszego roku: rodziny liczy razem, pomija grupy poniżej progu", () => {
    const trends: TrendsDataset = {
      ...trendsFixture,
      products: [
        ["B1", "B19", "ZAĆMA STARA", ["2023", "2024"]], ["B2", "B19G", "ZAĆMA NOWA", ["2024", "2025"]], ["N1", "N01", "PORÓD", ["2023", "2024", "2025"]],
        ["A1", "A48", "UDAR", ["2023", "2024", "2025"]], ["S1", "S57", "MAŁA GRUPA", ["2023", "2025"]],
      ],
      monthly: [
        ["2023", 1, 0, "p", 0, 1000, 0, 0], ["2024", 1, 1, "p", 0, 1200, 0, 0], ["2025", 1, 1, "p", 0, 1500, 0, 0],
        ["2023", 1, 2, "u", 0, 2000, 0, 0], ["2025", 1, 2, "u", 0, 1000, 0, 0],
        ["2023", 1, 3, "u", 0, 4000, 0, 0], ["2025", 1, 3, "u", 0, 4400, 0, 0],
        ["2023", 1, 4, "u", 0, 999, 0, 0], ["2025", 1, 4, "u", 0, 5000, 0, 0],
      ],
    };
    const { up, down } = buildHospitalizationSummary(trends, [latestDatasetFixture], null).trendChanges;
    // Zaćma: B19 (2023) i B19G (2025) jako jedna rodzina; link do kodu z największą liczbą w ostatnim roku.
    expect(up.map(({ id, changePct }) => [id, Math.round(changePct!)])).toEqual([["zacma", 50], ["A48", 10]]);
    expect(up[0]).toMatchObject({ family: true, codes: ["B19", "B19G"], series: [1000, 1200, 1500], mainCode: "B19G" });
    expect(up[1]).toMatchObject({ family: false, name: "UDAR", mainCode: "A48" });
    expect(down.map(({ id, changePct }) => [id, changePct])).toEqual([["porod", -50]]);
  });

  it("liczy hospitalizacje w przedziałach długości pobytu z plików roku", () => {
    const dataset: StaticDataset = {
      ...latestDatasetFixture,
      facts: [
        ["07", "111", "P1", "0 dni", "6", 9, 4, 0, 0], ["07", "111", "P1", "6 i więcej dni", "2", 3, 3, 0, 0],
        ["12", "222", "P1", "0 dni", "3", 2, 1, 0, 0], ["12", "222", "P1", "nieznany", "3", 5, 5, 0, 0],
      ],
    };
    expect(buildHospitalizationSummary(trendsFixture, [dataset], null).stays).toEqual([{ year: "2025", buckets: [5, 0, 0, 3] }]);
  });

  it("sumuje kwoty NFZ w latach, w sekcjach i grupach ostatniego roku z kwotami", () => {
    const settlements = { A01: { "2024": 500, "2025": 900 }, F04: { "2024": 300 }, F99: { "2025": 100 }, X01: { "2026": 50 } };
    const value = buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null, settlements).settlements!;
    expect(value).toMatchObject({ year: "2025", firstYear: "2024" });
    // Rok spoza danych o hospitalizacjach (2026) pomijamy.
    expect(value.totals).toEqual([{ year: "2024", valuePln: 800 }, { year: "2025", valuePln: 1000 }]);
    expect(value.sections.map(({ code, valuePln, hospitalizations }) => [code, valuePln, hospitalizations])).toEqual([["A", 900, 9], ["F", 100, 1]]);
    expect(value.groups[0]).toMatchObject({ code: "A01", label: "Stały produkt", valuePln: 900, perStayPln: 100, sharePct: 90, changePct: 80 });
    // Sekcja liczy też grupę, której już nie ma (F04 w 2024 r.): 300 → 100.
    expect(value.sections[1].changePct).toBeCloseTo(-66.67, 1);
    // Grupa bez kwot w pierwszym roku nie ma zmiany.
    expect(value.groups.find((row) => row.code === "F99")!.changePct).toBeNull();
    expect(buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null).settlements).toBeNull();
  });

  it("liczy mapę województw w latach na 100 tys. mieszkańców; bez granic mapy jej nie ma", () => {
    const map: RegionsMap = { version: 1, source: "", viewBox: [100, 100], regions: [["07", "Mazowieckie", "M0 0", [1, 1]], ["12", "Śląskie", "M0 0", [2, 2]]] };
    const timeline = buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], map).regionTimeline!;
    expect(timeline.regions).toEqual(latestDatasetFixture.regions);
    expect(timeline.years.map((y) => y.year)).toEqual(["2023", "2024", "2025"]);
    expect(timeline.years[0].per100k).toEqual([0, 0]);
    const [mazowieckie, slaskie] = timeline.years[2].per100k;
    expect(mazowieckie).toBeCloseTo((12 / 5_500_000) * 100_000);
    expect(slaskie).toBeCloseTo((68 / 4_300_000) * 100_000);
    expect(timeline.years[2].national).toBeCloseTo((80 / 9_800_000) * 100_000);
    expect(summary.regionTimeline).toBeNull();
  });
});
