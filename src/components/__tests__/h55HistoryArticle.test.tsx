/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { H55HistoryArticle } from "@/components/articles/H55HistoryArticle";
import { ControlCoverageGrid, monthStatus, shadeLevel } from "@/components/articles/ControlCoverageGrid";
import { H55_SOURCES } from "@/components/articles/h55Sources";
import { metadata } from "@/app/artykuly/historia-h55/page";
import { buildH55ArticleData, monthKeys } from "@/lib/h55Article";
import { ARTICLES } from "@/lib/articles";
import { h55ArticleFixture } from "@/lib/__tests__/fixtures/h55Article";

// Wykresy Plotly w artykule: rysowanie bez Plotly (element dostaje tylko obsługę zdarzeń, jak po `react`).
vi.mock("@/lib/plotlyLoader", () => ({
  loadPlotly: async () => ({
    react: vi.fn(async (plot: HTMLElement) => { Object.assign(plot, { on: () => undefined, removeAllListeners: () => undefined }); }),
    restyle: vi.fn(async () => undefined),
  }),
}));
// Mapa w czasie pobiera pliki portalu (fetch): w testach artykułu bez mapy.
vi.mock("@/components/articles/ArticleTimelineMap", () => ({ ArticleTimelineMap: () => null }));
afterEach(cleanup);

import { H55_CONTROLS } from "@/lib/h55Controls";

// Kwoty: każdy świadczeniodawca kontroli rozliczył 1 mln zł w każdym roku 2019–2025.
const plnYears = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const valuePln = {
  national: Object.fromEntries(plnYears.map((year) => [year, 30_000_000])),
  providers: Object.fromEntries(plnYears.map((year) => [year, H55_CONTROLS.map((control): [string, number] => [control.provider, 1_000_000])])),
};
const data = buildH55ArticleData(h55ArticleFixture(), new Map([["05|krotka", ["SZPITAL W PRZYKŁADOWIE", "PRZYKŁADOWO"]]]), valuePln, { year: "2025", points: { hospitalizacja: 3955, planowa: 3639, zero_dni: 3639 } });

// Mantine czyta preferowany motyw z `matchMedia`; jsdom go nie ma.
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
// Mantine (Select) obserwuje rozmiar elementów; jsdom nie ma ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
// Wybór placówki (Mantine `Select`) wymaga MantineProvider, jak w layout.tsx.
const renderArticle = () => render(<MantineProvider><H55HistoryArticle data={data} /></MantineProvider>);

describe("Artykuł „H55. Historia jednego kodu”", () => {
  it("jest na liście artykułów i ma metadane z adresem", () => {
    expect(ARTICLES.map((article) => article.slug)).toContain("historia-h55");
    expect(metadata.openGraph).toMatchObject({ url: "/artykuly/historia-h55" });
  });

  it("ma tytuł, spis treści i sekcję „Ile kontrolerzy zobaczyli” z liczbami z danych", () => {
    renderArticle();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("H55. Historia jednego kodu");
    expect(screen.getAllByRole("link", { name: "Ile kontrolerzy zobaczyli" })[0]).toHaveAttribute("href", "#z-lotu-ptaka");
    const section = document.getElementById("z-lotu-ptaka")!;
    const series = data.totals.series;
    expect(section).toHaveTextContent(`${series.months} miesięcy`);
    expect(section).toHaveTextContent(`${series.studied} z nich`);
  });

  it("liczby krajowe z API statystyk NFZ; rok bez danych API (2025) tylko jako szacunek z otwartych danych", () => {
    renderArticle();
    const section = document.getElementById("koszt")!;
    expect(section).toHaveTextContent(/30\s971 w 2024 r\./);
    // Fixture nie ma szacunku za 2025 r.: tekst nie podaje wtedy żadnej liczby za ten rok (ani plakietki „szacunek”).
    expect(data.estimate).toBeNull();
    expect(section).not.toHaveTextContent("za 2025 r.");
    expect(within(section).queryByText("Szacunek")).not.toBeInTheDocument();
  });

  it("zaczyna się od faktów, bez nagłówka „O czym jest ten tekst”", () => {
    renderArticle();
    expect(screen.queryByText("O czym jest ten tekst")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("Co kryje się pod H55");
  });

  it("udział termolezji z API w tekście (bez osobnej tabeli)", () => {
    renderArticle();
    expect(document.getElementById("kod")).toHaveTextContent("97,1–99,5% hospitalizacji H55");
    expect(screen.queryByRole("table", { name: /procedurą 03\.96/ })).not.toBeInTheDocument();
  });

  it("tabela 17 kontroli: wiersz na kontrolę, okres i miesiące objęte kontrolą", () => {
    renderArticle();
    const table = screen.getByRole("table", { name: "19 kontroli H55 z lat 2023–2026" });
    // Na starcie dwa wiersze, reszta po kliknięciu „Pokaż wszystkie”.
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż wszystkie (19)" }));
    expect(within(table).getAllByRole("row")).toHaveLength(20);
    const miastko = within(table).getByRole("rowheader", { name: /Szpital Miejski w Miastku/ }).closest("tr")!;
    expect(miastko).toHaveTextContent("IV 2024 – III 2025");
    expect(within(table).getByRole("columnheader", { name: "Skutki (mln zł)" })).toBeInTheDocument();
    expect(miastko.querySelectorAll("td")[1]).toHaveTextContent("13,3");
    expect(miastko).toHaveTextContent("12 z 108");
    // IV 2024 – III 2025: 9/12 z 1 mln (2024) + 3/12 z 1 mln (2025) = 1 mln zł, część roku = szacunek; skutki 13,3 mln = 1326%.
    expect(miastko.querySelectorAll("td")[0]).toHaveTextContent(/^1,0/);
    expect(within(miastko).getByText("Szacunek")).toBeInTheDocument();
    expect(miastko).toHaveTextContent("1326%");
  });

  it("wczesna kontrola bez danych o kwotach za badane lata: „—” w kolumnie udziału", () => {
    renderArticle();
    const table = screen.getByRole("table", { name: "6 kontroli z H55 z lat 2019–2022" });
    const monki = within(table).getByRole("rowheader", { name: /SPZOZ w Mońkach/ }).closest("tr")!;
    expect(monki.querySelectorAll("td")[2]).toHaveTextContent("—");
  });

  it("tabela wycen: H55 i HK14 w punktach ze zmianą", () => {
    renderArticle();
    const table = screen.getByRole("table", { name: /Wycena termolezji/ });
    const row = within(table).getByRole("rowheader", { name: "Hospitalizacja" }).closest("tr")!;
    expect(row).toHaveTextContent("3955");
    expect(row).toHaveTextContent("2512");
    expect(row).toHaveTextContent("−36,5%");
  });

  it("przypisy są numerowane w kolejności pierwszego użycia w tekście", () => {
    const { container } = renderArticle();
    const first = [...container.querySelectorAll<HTMLAnchorElement>("main sup a")].map((link) => Number(link.getAttribute("href")!.replace("#przypis-", "")));
    const order = first.filter((n, i) => first.indexOf(n) === i);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("każdy przypis ze źródeł jest na liście, a odsyłacze prowadzą do istniejących przypisów", () => {
    const { container } = renderArticle();
    expect(container.querySelectorAll("#przypisy li")).toHaveLength(H55_SOURCES.length);
    for (const link of container.querySelectorAll<HTMLAnchorElement>("sup a")) {
      expect(container.querySelector(link.getAttribute("href")!)).not.toBeNull();
    }
  });
});

describe("ControlCoverageGrid", () => {
  const months = monthKeys(["2022", "2023"]);
  const values = months.map((month) => (month >= "2022-06" && month <= "2023-02" ? 25 : 0));

  it("status miesiąca: w okresie objętym kontrolą, poza nim, bez kontroli", () => {
    const row = { periods: [{ from: "2022-01", to: "2022-12" }] };
    expect(monthStatus(row, "2022-06")).toBe("studied");
    expect(monthStatus(row, "2023-01")).toBe("outside");
    expect(monthStatus({}, "2023-01")).toBe("none");
  });

  it("odcień kratki według liczby hospitalizacji: 1–9, 10–29, 30–79, 80+", () => {
    expect([1, 9, 10, 29, 30, 79, 80, 400].map(shadeLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("kratka na każdy miesiąc z H55; dymek z liczbą i statusem", () => {
    const { container } = render(<ControlCoverageGrid
      months={months} ariaLabel="siatka"
      groups={[{ title: "Grupa", rows: [{ key: "a", label: "Szpital A", values, periods: [{ from: "2022-01", to: "2022-12" }], summary: "7 z 9" }] }]}
    />);
    const cells = container.querySelectorAll("svg rect:not([width='0.08'])");
    expect(cells).toHaveLength(9);
    fireEvent.mouseEnter(cells[8]);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Szpital A");
    expect(tip).toHaveTextContent("luty 2023");
    expect(tip).toHaveTextContent("poza okresem objętym kontrolą");
    expect(screen.getByText("7 z 9")).toBeInTheDocument();
  });
});
