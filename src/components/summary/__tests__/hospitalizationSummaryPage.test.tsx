/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { RegionsMap } from "@/lib/jgpCard";
import { HospitalizationSummaryPage } from "@/components/summary/HospitalizationSummaryPage";
import { buildHospitalizationSummary, type HospitalizationSummary } from "@/lib/hospitalizationSummary";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

afterEach(cleanup);

const map: RegionsMap = { version: 1, source: "", viewBox: [100, 100], regions: [["07", "Mazowieckie", "M0 0", [1, 1]], ["12", "Śląskie", "M0 0", [2, 2]]] };
const base = buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null);
const summary: HospitalizationSummary = {
  ...base,
  trendChanges: {
    up: [{ id: "zacma", name: "Usunięcie zaćmy", codes: ["B19", "B19G"], series: [1000, 1200, 1500], changePct: 50, mainCode: "B19G", family: true }],
    down: [{ id: "A66", name: "PADACZKA", codes: ["A66"], series: [2000, 1500, 1000], changePct: -50, mainCode: "A66", family: false }],
  },
  stays: [{ year: "2023", buckets: [10, 20, 30, 40] }, { year: "2025", buckets: [20, 20, 30, 30] }],
};
const withExtras = (): Partial<HospitalizationSummary> => ({
  regionTimeline: buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], map).regionTimeline,
  settlements: buildHospitalizationSummary(trendsFixture, [latestDatasetFixture], null, { A01: { "2024": 500, "2025": 900 }, F99: { "2025": 100 } }).settlements,
});

const renderPage = (overrides: Partial<HospitalizationSummary> = {}) => render(<HospitalizationSummaryPage summary={{ ...summary, ...overrides }} />);

describe("Karta „Hospitalizacje w Polsce”", () => {
  it("pokazuje w nagłówku zakres lat, cztery liczby i spis treści z kotwicami sekcji", () => {
    renderPage(withExtras());
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
    renderPage(withExtras());
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Ile hospitalizacji JGP?", "Ile NFZ płaci za hospitalizacje?", "Jak długo trwa pobyt i kto leczy?", "Jak przyjmowani są pacjenci i ilu umiera w szpitalu?",
      "Obszary leczenia: co leczą szpitale i za ile?", "Ile grup JGP rozlicza NFZ?", "Grupy JGP: najczęstsze i z największą kwotą", "Co rośnie, co maleje?",
    ]);
    // Link pod wykresem tylko tam, gdzie strona docelowa pokazuje tę samą miarę (katalog JGP).
    // Eksplorator otwiera jedną grupę, a karty liczą wszystkie, więc karty bez odpowiednika nie mają linku.
    const footerLinks = screen.getAllByRole("article").map((card) => card.querySelector("footer a")?.getAttribute("href") ?? null);
    expect(footerLinks.filter((href) => href?.startsWith("/analizy") || href?.startsWith("/szpitale"))).toEqual([]);
    expect(footerLinks.filter(Boolean).every((href) => href!.startsWith("/jgp"))).toBe(true);
    for (const id of ["summary-years", "summary-months", "summary-per-stay", "summary-stays", "summary-providers", "summary-admissions", "summary-mortality"]) {
      expect(document.querySelector(`[aria-labelledby="${id}"] footer a`)).toBeNull();
    }
    for (const card of screen.getAllByRole("article")) expect(card.textContent!.length).toBeGreaterThan(150);
    expect(screen.getByRole("article", { name: "Przyjęcia nagłe i planowe" })).toHaveTextContent("Planowe: przyjęcia na podstawie skierowania");
  });

  it("tryb przyjęcia i zgony są w jednej sekcji, obok siebie", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "Jak przyjmowani są pacjenci i ilu umiera w szpitalu?" });
    expect(within(section).getAllByRole("article").map((card) => card.getAttribute("aria-labelledby"))).toEqual(["summary-admissions", "summary-mortality"]);
  });

  it("długość pobytu i świadczeniodawcy są w jednym rzędzie; obszary i grupy mają własne sekcje z kwotami", () => {
    renderPage(withExtras());
    const cardsOf = (name: string) => within(screen.getByRole("region", { name })).getAllByRole("article").map((card) => card.getAttribute("aria-labelledby"));
    expect(cardsOf("Jak długo trwa pobyt i kto leczy?")).toEqual(["summary-stays", "summary-providers"]);
    expect(cardsOf("Obszary leczenia: co leczą szpitale i za ile?")).toEqual(["summary-sections", "summary-value-sections"]);
    expect(cardsOf("Ile grup JGP rozlicza NFZ?")).toEqual(["summary-jgp-active", "summary-jgp-cohorts"]);
    expect(cardsOf("Grupy JGP: najczęstsze i z największą kwotą")).toEqual(["summary-groups", "summary-value-groups"]);
  });

  it("pokazuje aktywne grupy JGP w latach oraz grupy stałe i nowe", () => {
    renderPage();
    const active = screen.getByRole("article", { name: "Aktywne grupy JGP w latach" });
    expect(active).toHaveTextContent("Aktywnych grup: 2 w 2025 r., 1 w 2023 r.");
    expect(within(active).getByRole("img", { name: "Aktywne grupy JGP w latach: 2023 — 1, 2024 — 2 (+1), 2025 — 2 (0)" })).toBeInTheDocument();
    const cohorts = screen.getByRole("article", { name: "Grupy stałe i nowe" });
    expect(cohorts).toHaveTextContent("1 z 3 grup było aktywnych w każdym roku 2023–2025.");
    // Remis (po 1 nowej grupie w 2024 i 2025 r.): pierwszy rok z największą liczbą.
    expect(cohorts).toHaveTextContent("Najwięcej nowych grup było w 2024 r.: 1. W tym samym roku przestało być aktywnych: 0.");
    expect(within(cohorts).getByText("Nowe w roku")).toBeInTheDocument();
  });

  it("pokazuje wzrosty po lewej i spadki po prawej; rodzina prowadzi do karty głównej grupy", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "Co rośnie, co maleje?" });
    expect(within(section).getAllByRole("article").map((card) => card.querySelector("h3")!.textContent)).toEqual(["Największe wzrosty", "Największe spadki"]);
    const cataract = within(screen.getByRole("article", { name: "Największe wzrosty" })).getByRole("link", { name: /Usunięcie zaćmy/ });
    expect(cataract).toHaveAttribute("href", "/jgp/B19G");
    expect(cataract).toHaveTextContent("Rodzina: B19, B19G · 1000 → 1500+50%");
    expect(within(screen.getByRole("article", { name: "Największe spadki" })).getByRole("link", { name: /Padaczka/ })).toHaveTextContent("−50%");
    expect(screen.queryByText(/Co zmieniło się w/)).not.toBeInTheDocument();
  });

  it("pokazuje sekcje z udziałem i zmianą", () => {
    renderPage();
    const sections = screen.getByRole("list", { name: /Sekcje katalogu JGP/ });
    expect(sections).toHaveTextContent("AUkład nerwowy90,0%+13%");
    expect(sections).toHaveTextContent("FUkład pokarmowy10,0%—");
  });

  it("opisuje długość pobytu udziałem pobytów długich i bez nocy", () => {
    renderPage();
    expect(screen.getByRole("article", { name: "Udział hospitalizacji według długości pobytu" })).toHaveTextContent("Pobyty 6 dni i dłuższe: 30,0% w 2025 r., 40,0% w 2023 r. Pobyty bez nocy (0 dni): 20,0% i 10,0%.");
  });

  it("pokazuje kwoty NFZ w latach ze zmianą r/r i średnią kwotę na hospitalizację; nie ma mapy województw", () => {
    renderPage(withExtras());
    const section = screen.getByRole("region", { name: "Ile NFZ płaci za hospitalizacje?" });
    expect(within(section).getByRole("img", { name: /Kwoty NFZ w latach \(tys\. zł\): 2024 — 1, 2025 — 1 \(\+100,0%\)/ })).toBeInTheDocument();
    // 2024: 500 zł / 12 hospitalizacji, 2025: 1000 zł / 10.
    expect(screen.getByRole("article", { name: "Średnia kwota na hospitalizację" })).toHaveTextContent("100 zł w 2025 r., 42 zł w 2024 r.");
    expect(screen.queryByRole("heading", { name: "Gdzie szpitale leczą najwięcej?" })).not.toBeInTheDocument();
  });

  it("pokazuje kwoty NFZ: sumę, sekcje i grupy z linkiem do karty", () => {
    renderPage(withExtras());
    expect(screen.getByRole("article", { name: "Kwoty według obszarów leczenia" })).toHaveTextContent("NFZ rozliczył 1 tys. zł za hospitalizacje JGP w 2025 r. (+100,0% od 2024 r.). Średnio 100 zł za hospitalizację.");
    // Średnia sekcji: A — 900 zł / 9 hospitalizacji.
    expect(screen.getByRole("list", { name: /według sekcji katalogu JGP/ })).toHaveTextContent("AUkład nerwowy1 tys. zł100 zł");
    const groups = screen.getByRole("list", { name: /Grupy JGP z największą kwotą/ });
    expect(within(groups).getAllByRole("link")[0]).toHaveAttribute("href", "/jgp/A01");
    expect(groups).not.toHaveTextContent("na hospitalizację");
    expect(within(groups).getAllByRole("link")[0]).toHaveAttribute("title", expect.stringContaining("100 zł na hospitalizację"));
    expect(within(groups).getAllByRole("link")[0]).toHaveTextContent("+80%");
  });

  it("bez kwot i danych o pobytach pomija te karty; kwoty też w spisie treści", () => {
    renderPage({ stays: [] });
    expect(screen.queryByRole("heading", { name: "Ile NFZ płaci za hospitalizacje?" })).not.toBeInTheDocument();
    for (const name of ["Kwoty według obszarów leczenia", "Grupy z największą kwotą rozliczeń", "Udział hospitalizacji według długości pobytu"]) {
      expect(screen.queryByRole("article", { name })).not.toBeInTheDocument();
    }
    // Sekcja pobytów zostaje z kartą świadczeniodawców.
    expect(screen.getByRole("article", { name: "Świadczeniodawcy rozliczający hospitalizacje" })).toBeInTheDocument();
    const toc = screen.getByRole("navigation", { name: "Części karty" });
    expect(within(toc).queryByRole("link", { name: "Ile płaci NFZ?" })).not.toBeInTheDocument();
  });
});
