/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleIndexPage } from "@/components/articles/ArticleIndexPage";
import { ArticleToc } from "@/components/articles/ArticleToc";
import { JgpIntroArticle } from "@/components/articles/JgpIntroArticle";
import { ARTICLES } from "@/lib/articles";
import type { ExampleGroupFact, JgpIntroFacts } from "@/lib/jgpIntroArticle";

afterEach(cleanup);

const group = (code: string, name: string, values: Partial<ExampleGroupFact>): ExampleGroupFact => ({
  code, name, productCode: null, points: null, plannedPoints: null, daysFinanced: null, extraDayPoints: null, hospitalizations: 0, ...values,
});

const facts: JgpIntroFacts = {
  latestYear: "2025",
  valuationYear: "2025",
  groupsInLatestYear: 612,
  hospitalizationsInLatestYear: 6_012_345,
  groups: {
    G25F: group("G25F", "Wycięcie pęcherzyka żółciowego < 66 r.ż", { productCode: "5.51.01.0007044", points: 3979, plannedPoints: 3661, hospitalizations: 41_000 }),
    G25E: group("G25E", "Wycięcie pęcherzyka żółciowego > 65 r.ż.", { points: 4860, plannedPoints: 4471, hospitalizations: 20_500 }),
    G26F: group("G26F", "Choroby dróg żółciowych < 66 r.ż.", { points: 3146, plannedPoints: 2894, daysFinanced: 17, extraDayPoints: 579, hospitalizations: 30_000 }),
    G26E: group("G26E", "Choroby dróg żółciowych > 65 r.ż.", { points: 4204, daysFinanced: 17, extraDayPoints: 579, hospitalizations: 25_000 }),
  },
};

describe("JgpIntroArticle", () => {
  it("ma tytuł, spis treści z kotwicami i wypis pacjentki", () => {
    render(<JgpIntroArticle facts={facts} />);
    expect(screen.getByRole("heading", { level: 1, name: "Czym są grupy JGP?" })).toBeInTheDocument();
    const toc = screen.getByRole("navigation", { name: "Spis treści" });
    for (const link of within(toc).getAllByRole("link")) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), id).not.toBeNull();
    }
    const discharge = screen.getByRole("figure", { name: "Przykładowy wypis ze szpitala" });
    expect(discharge).toHaveTextContent("K80.2");
    expect(discharge).toHaveTextContent("51.239");
    expect(discharge).toHaveTextContent("Wypis przykładowy");
  });

  it("wstęp: liczby z kontekstem i czterech bohaterów z piktogramami", () => {
    render(<JgpIntroArticle facts={facts} />);
    const intro = screen.getByRole("heading", { level: 2, name: "O czym jest ten tekst" }).closest("section")!;
    expect(intro).toHaveTextContent("w 612 grupach");
    // Wycięcie pęcherzyka: G25E + G25F.
    expect(intro).toHaveTextContent("ponad 61 tys. operacji usunięcia pęcherzyka");
    const cast = within(intro).getByRole("list", { name: "Bohaterowie przykładu" });
    expect(within(cast).getAllByRole("listitem")).toHaveLength(4);
    expect(cast.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(4);
    // Nagłówek strony bez kafelków z liczbami.
    expect(document.querySelector("main > header")).not.toBeNull();
    expect(document.querySelector("main > header dl")).toBeNull();
  });

  it("wyceny pochodzą z danych: grupy pacjentów i tabela", () => {
    render(<JgpIntroArticle facts={facts} />);

    const patients = screen.getByRole("heading", { level: 2, name: "Trzech innych pacjentów" }).closest("section")!;
    expect(within(patients).getByRole("heading", { name: "Pan Józef, 71 lat" }).parentElement!.parentElement).toHaveTextContent("4860 pkt");
    // Pani Ewa: 22 dni, 17 w wycenie → 3146 + 5 × 579.
    expect(within(patients).getByRole("heading", { name: "Pani Ewa, 60 lat" }).parentElement!.parentElement).toHaveTextContent("6041 pkt");

    const table = screen.getByRole("table", { name: /Grupy z historii/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((tableRow) => within(tableRow).getAllByRole("link")[0].textContent)).toEqual(["G25F", "G25E", "G26F", "G26E"]);
    expect(rows[0]).toHaveTextContent("3979 pkt");
    expect(rows[0]).toHaveTextContent("3661 pkt");
    expect(within(rows[0]).getByRole("link", { name: "G25F" })).toHaveAttribute("href", "/jgp/G25F");
  });

  it("bez limitu dni w katalogu nie pokazuje wyliczenia długiego pobytu", () => {
    render(<JgpIntroArticle facts={{ ...facts, groups: { ...facts.groups, G26F: { ...facts.groups.G26F, daysFinanced: null } } }} />);
    expect(screen.queryByText(/w uproszczeniu/)).not.toBeInTheDocument();
  });

  it("bez odwołań do danych z 2010 r.; linki zewnętrzne tylko w przypisach, w nowej karcie", () => {
    render(<JgpIntroArticle facts={facts} />);
    expect(document.body).not.toHaveTextContent("2010");
    const footnotes = screen.getByRole("heading", { name: "Przypisy i źródła" }).closest("footer")!;
    const external = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("http"));
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(footnotes.contains(link)).toBe(true);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }
  });

  it("każdy odsyłacz prowadzi do istniejącego przypisu, a każde źródło jest użyte w tekście", () => {
    render(<JgpIntroArticle facts={facts} />);
    const refs = screen.getAllByRole("link", { name: /^Przypis \d+$/ });
    const targets = new Set(refs.map((link) => link.getAttribute("href")!.slice(1)));
    for (const id of targets) expect(document.getElementById(id), id).not.toBeNull();
    const items = screen.getByRole("heading", { name: "Przypisy i źródła" }).closest("footer")!.querySelectorAll("li");
    expect([...items].map((item) => item.id)).toEqual([...items].map((_, i) => `przypis-${i + 1}`));
    expect(targets.size).toBe(items.length);
  });
});

describe("ArticleToc", () => {
  it("ma wersję szeroką i zwiniętą (details) z tymi samymi kotwicami i liczbą części", () => {
    const items = [{ id: "a", label: "Pierwsza" }, { id: "b", label: "Druga" }];
    render(<ArticleToc items={items} />);
    const toc = screen.getByRole("navigation", { name: "Spis treści" });
    const details = toc.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(details.querySelector("summary")).toHaveTextContent("W tym tekście 2 części");
    const hrefs = (root: Element) => [...root.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs(details)).toEqual(["#a", "#b"]);
    expect(hrefs(toc)).toEqual(["#a", "#b", "#a", "#b"]);
  });
});

describe("Article.module.css — artykuł na telefonie (DESIGN.md 7.2)", () => {
  const css = readFileSync(join(process.cwd(), "src/components/articles/Article.module.css"), "utf8");
  const block = (query: string) => css.slice(css.indexOf(query), css.indexOf("}\n}", css.indexOf(query)) + 3);

  it("do 1100 px pokazuje zwinięty spis treści zamiast listy obok tekstu", () => {
    expect(css).toMatch(/\.tocNarrow \{ display: none; \}/);
    const narrow = block("@media (max-width: 1100px)");
    expect(narrow).toMatch(/\.tocWide \{ display: none; \}/);
    expect(narrow).toMatch(/\.tocNarrow \{ display: block; \}/);
    expect(narrow).toMatch(/\.layout \{ grid-template-columns: minmax\(0, 1fr\)/);
  });

  it("cele dotyku w spisie treści mają co najmniej 44 px; odsyłacze do przypisów mają powiększony obszar", () => {
    expect(css).toMatch(/\.tocNarrow summary \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.tocNarrow a \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.ref a \{[^}]*padding: 6px 3px; margin: -6px -1px/);
  });

  it("do 550 px definicje i pola wypisu mają jedną kolumnę", () => {
    const phone = block("@media (max-width: 550px)");
    expect(phone).toMatch(/\.discharge dl > div \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(phone).toMatch(/\.glossary > div \{ grid-template-columns: minmax\(0, 1fr\)/);
  });
});

describe("ArticleIndexPage", () => {
  it("pokazuje każdy artykuł z linkiem", () => {
    render(<ArticleIndexPage articles={ARTICLES} />);
    expect(screen.getByRole("heading", { level: 1, name: "Artykuły" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Czym są grupy JGP\?/ })).toHaveAttribute("href", "/artykuly/czym-sa-jgp");
    expect(screen.getAllByRole("listitem")).toHaveLength(ARTICLES.length);
  });
});
