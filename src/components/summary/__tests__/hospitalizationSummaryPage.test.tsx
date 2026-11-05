/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HospitalizationSummaryPage } from "@/components/summary/HospitalizationSummaryPage";
import { buildHospitalizationSummary, type HospitalizationSummary } from "@/lib/hospitalizationSummary";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

afterEach(cleanup);

const base = buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null);
const summary: HospitalizationSummary = {
  ...base,
  families: [{ id: "zacma", name: "Usunięcie zaćmy", codes: ["B19", "B19G"], note: "", series: [10, 12, 15], changePct: 50, mainCode: "B19G" }],
  changes: { up: [{ code: "A66", name: "PADACZKA", latest: 2_000, previous: 1_000, changePct: 100 }], down: [] },
};

const renderPage = (overrides: Partial<HospitalizationSummary> = {}) => render(<HospitalizationSummaryPage summary={{ ...summary, ...overrides }} />);

describe("Karta „Hospitalizacje w Polsce”", () => {
  it("pokazuje w nagłówku zakres lat, cztery liczby i spis treści z kotwicami sekcji", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hospitalizacje w Polsce");
    const kpis = screen.getByText("Hospitalizacje JGP 2025").closest("dl")!;
    expect(kpis).toHaveTextContent("Zgony w szpitalu10,0%");
    expect(kpis).toHaveTextContent("Świadczeniodawcy3");
    const toc = screen.getByRole("navigation", { name: "Części karty" });
    for (const link of within(toc).getAllByRole("link")) {
      expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    }
  });

  it("ma sekcje-pytania; każda karta ma opis i link do szczegółów", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Ile hospitalizacji JGP?", "Jak przyjmowani są pacjenci?", "Co leczą szpitale?", "Co rośnie, co maleje?", "Ilu pacjentów umiera w szpitalu?", "Kto leczy?",
    ]);
    for (const card of screen.getAllByRole("article")) {
      expect(card.querySelector("footer a")).not.toBeNull();
      expect(card.textContent!.length).toBeGreaterThan(150);
    }
    expect(screen.getByRole("article", { name: "Przyjęcia nagłe i planowe" })).toHaveTextContent("Planowe: przyjęcia na podstawie skierowania");
    expect(within(screen.getByRole("article", { name: "Odsetek hospitalizacji zakończonych zgonem" })).getByRole("link", { name: /Kto leczy/ })).toHaveAttribute("href", "/analizy?t=k");
  });

  it("linkuje rodziny do karty głównej grupy, a sekcje pokazuje z udziałem i zmianą", () => {
    renderPage();
    const families = screen.getByRole("article", { name: "Zmiana od 2023 r." });
    const cataract = within(families).getByRole("link", { name: /Usunięcie zaćmy/ });
    expect(cataract).toHaveAttribute("href", "/jgp/B19G");
    expect(cataract).toHaveTextContent("+50%");
    const sections = screen.getByRole("list", { name: /Sekcje katalogu JGP/ });
    expect(sections).toHaveTextContent("AUkład nerwowy90,0%+13%");
    expect(sections).toHaveTextContent("FUkład pokarmowy10,0%—");
  });

  it("pokazuje mapę tylko z danymi województw", () => {
    renderPage();
    expect(screen.queryByRole("heading", { name: "Gdzie szpitale leczą najwięcej?" })).not.toBeInTheDocument();
  });
});
