import { describe, expect, it } from "vitest";
import { activeRanges, availabilityLabel, biggestChanges, buildJgpCatalog, limitSeriesToActiveYears, settlementYears, type JgpCatalogRow } from "@/lib/jgpCatalog";
import { trendsFixture } from "./fixtures/trendsFixture";

describe("buildJgpCatalog", () => {
  const catalog = buildJgpCatalog(trendsFixture);

  it("liczy wiersz na grupę z hospitalizacjami w dwóch ostatnich latach i zmianą r/r", () => {
    expect(catalog).toMatchObject({ years: ["2023", "2024", "2025"], latestYear: "2025", previousYear: "2024" });
    const a01 = catalog.rows.find((row) => row.code === "A01")!;
    // A01 (min): 2024 — 5 + 3 = 8; 2025 — 9.
    expect(a01).toMatchObject({ name: "Stały produkt", previous: 8, latest: 9, procedural: false, discontinued: false, added: false });
    expect(a01.changePct).toBeCloseTo(12.5);
    expect(a01.series).toHaveLength(36);
    expect(a01.series[24]).toBe(9);
  });

  it("dodaje rozliczenia NFZ z ostatniego roku z kwotami i zmianę od pierwszego; bez kwot pola są puste", () => {
    const settlements = { A01: { "2024": 400, "2025": 500 }, F99: { "2025": 50 }, X01: { "2026": 1 } };
    const withValues = buildJgpCatalog(trendsFixture, settlements);
    expect(withValues.settlements).toEqual({ firstYear: "2024", year: "2025" });
    expect(withValues.rows.find((row) => row.code === "A01")).toMatchObject({ valuePln: 500, valueChangePct: 25 });
    // Grupa bez kwot w pierwszym roku: kwota jest, zmiany nie ma.
    expect(withValues.rows.find((row) => row.code === "F99")).toMatchObject({ valuePln: 50, valueChangePct: null });
    expect(withValues.rows.find((row) => row.code === "F04")).toMatchObject({ valuePln: null, valueChangePct: null });
    expect(catalog.settlements).toBeNull();
    expect(catalog.rows[0]).toMatchObject({ valuePln: null, valueChangePct: null });
  });

  it("wybiera lata kwot tylko z zakresu danych o hospitalizacjach", () => {
    expect(settlementYears({ A: { "2018": 1, "2026": 1 }, B: { "2020": 1, "2025": 1 } }, ["2019", "2020", "2025"])).toEqual({ firstYear: "2020", year: "2025" });
    expect(settlementYears({ A: { "2026": 1 } }, ["2025"])).toBeNull();
    expect(settlementYears(null, ["2025"])).toBeNull();
  });

  it("oznacza grupy wycofane i nowe; śmiertelność z najnowszego roku", () => {
    const f04 = catalog.rows.find((row) => row.code === "F04")!;
    const f99 = catalog.rows.find((row) => row.code === "F99")!;
    expect(f04).toMatchObject({ latest: 0, previous: 4, discontinued: true, changePct: -100 });
    expect(f99).toMatchObject({ latest: 1, previous: 0, added: true, changePct: null, mortalityPct: 100 });
    expect(catalog.totals).toEqual({ all: 3, groups: 2, latest: 10, previous: 12, added: 1, discontinued: 1 });
  });

  it("zapisuje okresy kodu w katalogu i hospitalizacje w ostatnim roku kodu", () => {
    const f04 = catalog.rows.find((row) => row.code === "F04")!;
    expect(f04).toMatchObject({ ranges: [["2023", "2024"]], lastYearTotal: 4 });
    expect(catalog.rows.find((row) => row.code === "F99")!.ranges).toEqual([["2025", "2025"]]);
  });

  it("mini-wykres pokazuje tylko miesiące, gdy kod istniał", () => {
    const f04 = catalog.rows.find((row) => row.code === "F04")!;
    const f99 = catalog.rows.find((row) => row.code === "F99")!;
    // F04: 2023 bez przycinania (pierwszy rok trendu), 2024 do ostatniej hospitalizacji (styczeń), 2025 bez kodu.
    expect(f04.series.slice(0, 12)).toEqual(Array(12).fill(0));
    expect(f04.series.slice(12, 24)).toEqual([4, ...Array(11).fill(null)]);
    expect(f04.series.slice(24)).toEqual(Array(12).fill(null));
    // F99: 2023–2024 bez kodu, 2025 od pierwszej hospitalizacji (marzec); najnowszego roku nie przycinamy z końca.
    expect(f99.series.slice(0, 26)).toEqual(Array(26).fill(null));
    expect(f99.series.slice(26)).toEqual([1, ...Array(9).fill(0)]);
  });

  it("sortuje od największej liczby hospitalizacji w najnowszym roku", () => {
    expect(catalog.rows.map((row) => row.code)).toEqual(["A01", "F99", "F04"]);
  });
});

describe("limitSeriesToActiveYears", () => {
  const years = ["2019", "2020", "2021", "2022"];
  const month = (values: Record<number, number>) => Array.from({ length: 12 }, (_, m) => values[m] ?? 0);

  it("zostawia przerwę w latach, gdy kodu nie było, i przycina rok powrotu", () => {
    const series = [...month({ 0: 5 }), ...month({}), ...month({ 6: 2, 8: 3 }), ...month({ 0: 1 })];
    const result = limitSeriesToActiveYears(series, years, new Set(["2019", "2021", "2022"]));
    // 2019: pierwszy rok trendu — bez przycinania, choć dalej kod znika.
    expect(result.slice(0, 12)).toEqual([5, ...Array(11).fill(null)]);
    expect(result.slice(12, 24)).toEqual(Array(12).fill(null));
    expect(result.slice(24, 36)).toEqual([...Array(6).fill(null), 2, 0, 3, 0, 0, 0]);
    expect(result.slice(36)).toEqual(month({ 0: 1 }));
  });

  it("nie przycina pierwszego i ostatniego roku trendu, gdy kod trwa przez cały zakres", () => {
    const series = [...month({}), ...month({ 3: 1 }), ...month({ 3: 1 }), ...month({})];
    expect(limitSeriesToActiveYears(series, years, new Set(years))).toEqual(series);
  });

  it("rok wejścia bez hospitalizacji jest w całości pusty", () => {
    const result = limitSeriesToActiveYears([...month({}), ...month({}), ...month({}), ...month({ 1: 4 })], years, new Set(["2021", "2022"]));
    expect(result.slice(0, 36)).toEqual(Array(36).fill(null));
    expect(result.slice(36)).toEqual(month({ 1: 4 }));
  });
});

describe("activeRanges i availabilityLabel", () => {
  const years = ["2017", "2018", "2019", "2020", "2021"];
  const label = (active: string[]) => availabilityLabel(activeRanges(years, new Set(active)), years);

  it("dzieli lata na okresy ciągłe", () => {
    expect(activeRanges(years, new Set(["2017", "2018", "2020", "2021"]))).toEqual([["2017", "2018"], ["2020", "2021"]]);
  });

  it("bez etykiety dla kodu z całego okresu; „od”, „do”, zakres i kilka okresów", () => {
    expect(label(years)).toBeNull();
    expect(label(["2019", "2020", "2021"])).toBe("od 2019");
    expect(label(["2017", "2018"])).toBe("do 2018");
    expect(label(["2018", "2019"])).toBe("2018–2019");
    expect(label(["2019"])).toBe("2019");
    expect(label(["2017", "2018", "2021"])).toBe("2017–2018, 2021");
  });
});

describe("biggestChanges", () => {
  const row = (code: string, previous: number, changePct: number | null, discontinued = false): JgpCatalogRow => ({
    code, name: code, procedural: false, previous, latest: 0, changePct, mortalityPct: 0, series: [], discontinued, added: false, ranges: [], lastYearTotal: 0, valuePln: null, valueChangePct: null,
  });

  it("wybiera wzrosty i spadki wśród grup z progiem poprzedniego roku", () => {
    const rows = [row("A", 2000, 50), row("B", 2000, -40), row("C", 500, 300), row("D", 3000, 10), row("E", 2000, null), row("F", 2000, -100, true)];
    const { up, down } = biggestChanges(rows, 1000, 2);
    expect(up.map((r) => r.code)).toEqual(["A", "D"]);
    expect(down.map((r) => r.code)).toEqual(["B", "D"]);
  });
});
