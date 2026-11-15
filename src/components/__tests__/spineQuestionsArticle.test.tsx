/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpineQuestionsArticle, questionsText } from "@/components/articles/SpineQuestionsArticle";
import { SPINE_QUESTION_COUNT, SPINE_QUESTION_SECTIONS, SPINE_QUESTION_SOURCES } from "@/components/articles/spineQuestions";
import { findArticle } from "@/lib/articles";
import type { JgpGroupFile } from "@/lib/jgpPage";
import { KOSZALIN, providerGroupsSeries } from "@/lib/spineQuestions";

const file = (jgp: string, rows: JgpGroupFile["rows"]): JgpGroupFile => ({ version: 3, jgp, years: ["2023", "2024"], providers: ["01|1", KOSZALIN], rows });
const koszalin = providerGroupsSeries([
  file("H52", [[1, 15, 0, 96, 0], [1, 16, 0, 11, 0], [0, 16, 0, 50, 0]]),
  file("H53", [[1, 15, 0, 5, 0], [1, 16, 0, 74, 0]]),
], KOSZALIN);

afterEach(cleanup);

describe("SpineQuestionsArticle", () => {
  it("ma tytuł, wstęp z liczbą pytań i spis treści z kotwicami", () => {
    render(<SpineQuestionsArticle koszalin={koszalin} />);
    expect(screen.getByRole("heading", { level: 1, name: "Zabiegi na kręgosłupie: pytania do NFZ" })).toBeInTheDocument();
    expect(screen.getByText(questionsText(SPINE_QUESTION_COUNT), { exact: false })).toBeInTheDocument();
    const toc = screen.getByRole("navigation", { name: "Spis treści" });
    for (const link of within(toc).getAllByRole("link")) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("numeruje pytania w sposób ciągły przez wszystkie części", () => {
    render(<SpineQuestionsArticle koszalin={koszalin} />);
    const lists = SPINE_QUESTION_SECTIONS.map((section) => document.querySelector(`#${section.id} ol`) as HTMLOListElement);
    let expected = 1;
    lists.forEach((list, i) => {
      expect(list.start, SPINE_QUESTION_SECTIONS[i].id).toBe(expected);
      expected += list.querySelectorAll(":scope > li").length;
    });
    expect(expected - 1).toBe(SPINE_QUESTION_COUNT);
  });

  it("każde pytanie ma fakty z przypisem, a każdy przypis prowadzi do źródła", () => {
    render(<SpineQuestionsArticle koszalin={koszalin} />);
    for (const section of SPINE_QUESTION_SECTIONS) for (const item of section.questions) {
      expect(item.question.endsWith("?"), item.question).toBe(true);
      expect(item.sources.length, item.question).toBeGreaterThan(0);
    }
    const refs = document.querySelectorAll("sup a[href^='#przypis-']");
    expect(refs.length).toBeGreaterThan(SPINE_QUESTION_COUNT - 1);
    for (const ref of refs) expect(document.getElementById(ref.getAttribute("href")!.slice(1))).not.toBeNull();
    expect(document.querySelectorAll("#przypisy li")).toHaveLength(SPINE_QUESTION_SOURCES.length);
    // Numer przypisu = kolejność pierwszego użycia w tekście.
    const firstUse = [...new Set([...refs].map((ref) => Number(ref.getAttribute("href")!.slice("#przypis-".length))))];
    expect(firstUse).toEqual(SPINE_QUESTION_SOURCES.map((_, i) => i + 1));
  });

  it("część o modelu kontroli zaczyna się od tezy", () => {
    render(<SpineQuestionsArticle koszalin={koszalin} />);
    const model = screen.getByRole("region", { name: "Czy obecny model kontroli ma sens" });
    expect(model).toHaveTextContent("Więcej kontrolerów nie zmieni tego mechanizmu");
  });

  it("część o Koszalinie ma wykres H52 i H53", () => {
    render(<SpineQuestionsArticle koszalin={koszalin} />);
    const section = screen.getByRole("region", { name: "Koszalin: H52 i H53" });
    expect(within(section).getByRole("figure")).toHaveTextContent("Ile hospitalizacji H52 i H53 rozliczył szpital w Koszalinie?");
  });

  it("pytanie 1: kwoty H52, H53 i H55 w punktach, przypis przy ostatnim punkcie", () => {
    render(<SpineQuestionsArticle koszalin={koszalin} />);
    const first = document.querySelector("#skala ol > li")!;
    const points = first.querySelectorAll("ul > li");
    expect([...points].map((point) => point.textContent!.slice(0, 3))).toEqual(["H52", "H53", "H55"]);
    expect(points[2].querySelector("sup")).not.toBeNull();
    expect(first.querySelector("p sup")).toBeNull();
  });

  it("odmienia liczbę pytań", () => {
    expect(questionsText(1)).toBe("1 pytanie");
    expect(questionsText(24)).toBe("24 pytania");
    expect(questionsText(25)).toBe("25 pytań");
    expect(questionsText(12)).toBe("12 pytań");
  });

  it("jest na liście artykułów", () => {
    expect(findArticle("pytania-zabiegi-kregoslup").kicker).toBe("Pytania");
  });
});

describe("providerGroupsSeries", () => {
  it("sumuje miesiące jednego świadczeniodawcy w każdej grupie", () => {
    expect(koszalin.months).toHaveLength(24);
    expect(koszalin.months[16]).toBe("2024-05");
    expect(koszalin.groups.H52[15]).toBe(96);
    expect(koszalin.groups.H52[16]).toBe(11);
    expect(koszalin.groups.H53[16]).toBe(74);
    expect(koszalin.groups.H52.reduce((a, b) => a + b, 0)).toBe(107);
  });

  it("zwraca zera, gdy świadczeniodawcy nie ma w pliku, i odrzuca pliki z innymi latami", () => {
    expect(providerGroupsSeries([file("H52", [])], "99|9").groups.H52.every((v) => v === 0)).toBe(true);
    expect(() => providerGroupsSeries([file("H52", []), { ...file("H53", []), years: ["2024"] }], KOSZALIN)).toThrow();
  });
});
