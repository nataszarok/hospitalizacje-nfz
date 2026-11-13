import { describe, expect, it } from "vitest";
import { ARTICLES, articleHref, findArticle } from "@/lib/articles";
import type { JgpCatalog, JgpCatalogRow } from "@/lib/jgpCatalog";
import { GALLBLADDER_CODES, buildJgpIntroFacts, longStayPoints } from "@/lib/jgpIntroArticle";

const row = (code: string, name: string, latest: number, procedural = false): JgpCatalogRow => ({
  code, name, procedural, previous: 0, latest, changePct: null, mortalityPct: 0, series: [], discontinued: false, added: false,
  ranges: [["2024", "2025"]], lastYearTotal: latest, valuePln: null, valueChangePct: null,
});

const catalogFixture: JgpCatalog = {
  years: ["2024", "2025"],
  latestYear: "2025",
  previousYear: "2024",
  rows: [
    row("G25F", "WYCIĘCIE PĘCHERZYKA ŻÓŁCIOWEGO < 66 R.Ż *", 40_000, true),
    row("G25E", "WYCIĘCIE PĘCHERZYKA ŻÓŁCIOWEGO > 65 R.Ż. *", 20_000, true),
    row("G26F", "CHOROBY DRÓG ŻÓŁCIOWYCH < 66 R.Ż.", 30_000),
    row("E10", "ZAWAŁ", 50_000),
  ],
  settlements: null,
  totals: { all: 4, groups: 4, latest: 140_000, previous: 0, added: 0, discontinued: 0 },
};

const valuations = {
  year: "2025",
  rows: [
    { kod_jgp: "G25F", kod_produktu: "5.51.01.0007044", pkt_hospitalizacja: 3979, pkt_hospitalizacja_planowa: 3661, dni_finansowane_grupa: null, pkt_osobodzien_ponad_ryczalt: null },
    { kod_jgp: "G26F", kod_produktu: "5.51.01.0007046", pkt_hospitalizacja: 3146, pkt_hospitalizacja_planowa: 2894, dni_finansowane_grupa: 17, pkt_osobodzien_ponad_ryczalt: 579 },
  ],
};

const highlights = { hospitalizations: 6_000_000, jgpGroups: 650 };

describe("buildJgpIntroFacts", () => {
  it("bierze sumy roku z pliku roku, a grupy przykładu z katalogu i z wycen", () => {
    const facts = buildJgpIntroFacts(catalogFixture, valuations, highlights);
    expect(facts).toMatchObject({ latestYear: "2025", valuationYear: "2025", groupsInLatestYear: 650, hospitalizationsInLatestYear: 6_000_000 });
    expect(Object.keys(facts.groups)).toEqual([...GALLBLADDER_CODES]);
    expect(facts.groups.G25F).toEqual({
      code: "G25F", name: "Wycięcie pęcherzyka żółciowego < 66 r.ż", productCode: "5.51.01.0007044",
      points: 3979, plannedPoints: 3661, daysFinanced: null, extraDayPoints: null, hospitalizations: 40_000,
    });
    expect(facts.groups.G26F).toMatchObject({ points: 3146, daysFinanced: 17, extraDayPoints: 579, hospitalizations: 30_000 });
  });

  it("grupa bez wiersza w katalogu i w wycenach: kod jako nazwa, brak liczb", () => {
    const facts = buildJgpIntroFacts(catalogFixture, valuations, highlights);
    expect(facts.groups.G26E).toEqual({
      code: "G26E", name: "G26E", productCode: null, points: null, plannedPoints: null, daysFinanced: null, extraDayPoints: null, hospitalizations: 0,
    });
  });
});

describe("longStayPoints", () => {
  it("dolicza punkty za każdy dzień ponad liczbę dni w wycenie", () => {
    expect(longStayPoints({ points: 3146, daysFinanced: 17, extraDayPoints: 579 }, 22)).toBe(3146 + 5 * 579);
    expect(longStayPoints({ points: 3146, daysFinanced: 17, extraDayPoints: 579 }, 4)).toBe(3146);
  });

  it("bez limitu dni albo stawki za dzień nie liczy", () => {
    expect(longStayPoints({ points: 3979, daysFinanced: null, extraDayPoints: null }, 22)).toBeNull();
  });
});

describe("articles", () => {
  it("każdy artykuł ma unikalny adres pod /artykuly", () => {
    const slugs = ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(articleHref("czym-sa-jgp")).toBe("/artykuly/czym-sa-jgp");
    expect(findArticle("czym-sa-jgp").title).toBe("Czym są grupy JGP?");
    expect(() => findArticle("brak")).toThrow();
  });
});
