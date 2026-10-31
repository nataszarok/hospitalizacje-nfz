import { describe, expect, it } from "vitest";
import { biggestChanges, buildJgpCatalog, type JgpCatalogRow } from "@/lib/jgpCatalog";
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

  it("oznacza grupy wycofane i nowe; śmiertelność z najnowszego roku", () => {
    const f04 = catalog.rows.find((row) => row.code === "F04")!;
    const f99 = catalog.rows.find((row) => row.code === "F99")!;
    expect(f04).toMatchObject({ latest: 0, previous: 4, discontinued: true, changePct: -100 });
    expect(f99).toMatchObject({ latest: 1, previous: 0, added: true, changePct: null, mortalityPct: 100 });
    expect(catalog.totals).toEqual({ groups: 2, latest: 10, previous: 12, added: 1, discontinued: 1 });
  });

  it("sortuje od największej liczby hospitalizacji w najnowszym roku", () => {
    expect(catalog.rows.map((row) => row.code)).toEqual(["A01", "F99", "F04"]);
  });
});

describe("biggestChanges", () => {
  const row = (code: string, previous: number, changePct: number | null, discontinued = false): JgpCatalogRow => ({
    code, name: code, procedural: false, previous, latest: 0, changePct, mortalityPct: 0, series: [], discontinued, added: false,
  });

  it("wybiera wzrosty i spadki wśród grup z progiem poprzedniego roku", () => {
    const rows = [row("A", 2000, 50), row("B", 2000, -40), row("C", 500, 300), row("D", 3000, 10), row("E", 2000, null), row("F", 2000, -100, true)];
    const { up, down } = biggestChanges(rows, 1000, 2);
    expect(up.map((r) => r.code)).toEqual(["A", "D"]);
    expect(down.map((r) => r.code)).toEqual(["B", "D"]);
  });
});
