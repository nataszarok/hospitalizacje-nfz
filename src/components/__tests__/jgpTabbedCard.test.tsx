/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JgpPage } from "@/components/jgp/JgpPage";
import { buildJgpPageData, hasTabbedCard } from "@/lib/jgpPage";
import { extrasFixture } from "@/lib/__tests__/fixtures/jgpCardFixture";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

// Wykresy Plotly zastępujemy przyciskami: test sprawdza linie i wybór ośrodka.
vi.mock("@/components/jgp/GroupLineChart", () => ({
  GroupLineChart: ({ lines, onSelect, onHover }: { lines: { key: string; name: string; values: number[]; tone?: string }[]; onSelect?: (key: string) => void; onHover?: (key: string | null) => void }) => <ul aria-label="Linie wykresu">
    {lines.map((line) => <li key={line.key} data-tone={line.tone ?? ""}>
      <button type="button" onClick={() => onSelect?.(line.key)} onMouseEnter={() => onHover?.(line.key)} onMouseLeave={() => onHover?.(null)}>{line.name}: {line.values.reduce((a, b) => a + b, 0)}</button>
    </li>)}
  </ul>,
}));
vi.mock("@/components/jgp/ProviderScatter", () => ({
  ProviderScatter: ({ points, ariaLabel, curves }: { points: { key: string; name: string; color?: string }[]; ariaLabel: string; curves?: unknown[] }) => <div role="group" aria-label={ariaLabel} data-curves={curves?.length ?? 0}>
    {points.map((point) => <span key={point.key}>{point.name}</span>)}
  </div>,
}));

const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!;
const open = (search = "") => window.history.replaceState(null, "", `/jgp/A01${search}`);
const renderCard = () => render(<JgpPage data={data} tabbed />);

beforeEach(() => open());
afterEach(cleanup);

describe("Karta w zakładkach — wybór grup", () => {
  it("nowa karta jest dla E10, H52 i H55", () => {
    expect(["E10", "H52", "H55", "A01"].map(hasTabbedCard)).toEqual([true, true, true, false]);
  });
});

describe("Karta w zakładkach — nagłówek i Przegląd", () => {
  it("nagłówek ma cztery liczby 2×2 i obszar", () => {
    const { container } = renderCard();
    const kpis = container.querySelector('dl[aria-label="Liczby grupy"]')!;
    expect(kpis.children).toHaveLength(4);
    expect(kpis).toHaveTextContent("Hospitalizacje 202530+100,0% r/r");
    expect(kpis).toHaveTextContent("Kwota świadczeń NFZ 20251,2 mln zł+33,3% r/r");
    expect(screen.getByText("cała Polska · kliknij województwo na mapie")).toBeInTheDocument();
  });

  it("Przegląd ma sekcje-pytania w kolejności Ile? → Gdzie? → Za ile? → Jak przyjmowani?", () => {
    renderCard();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.split(" ")[0])).toEqual(["Ile?", "Gdzie?", "Za", "Jak"]);
    expect(within(panel).getByRole("region", { name: /Za ile\?/ })).toHaveTextContent("Średnio na hospitalizację 2025");
    expect(within(panel).getByRole("region", { name: "Mapa ciepła: województwa w latach" })).toBeInTheDocument();
  });

  it("kliknięcie województwa w tabeli lat zawęża kartę i trafia do adresu", () => {
    renderCard();
    const heat = screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" });
    fireEvent.click(within(heat).getByRole("button", { name: "Mazowieckie" }));
    expect(window.location.search).toBe("?ow=07");
    expect(screen.getByRole("button", { name: "woj. mazowieckie ✕" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveTextContent("Ośrodki1");
  });
});

describe("Karta w zakładkach — Ośrodki", () => {
  it("zakładka zapisuje się w adresie jako widok=osrodki", () => {
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: /Ośrodki/ }));
    expect(window.location.search).toBe("?widok=osrodki");
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("list", { name: "Linie wykresu" })).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(["1. Szpital Beta: 28", "2. Szpital Alfa: 17"]);
  });

  it("najechanie na linię pokazuje pasek ośrodka, kliknięcie go wybiera; Szczegóły rozwijają porównanie", () => {
    open("?widok=osrodki");
    renderCard();
    expect(screen.getByText(/Najedź na linię albo wiersz rankingu/)).toBeInTheDocument();
    const alfa = screen.getByRole("button", { name: "2. Szpital Alfa: 17" });
    fireEvent.mouseEnter(alfa);
    expect(screen.getByText("kliknij, żeby wybrać")).toBeInTheDocument();
    fireEvent.click(alfa);
    fireEvent.mouseLeave(alfa);
    expect(window.location.search).toBe("?osrodek=07%7C111");
    expect(screen.queryByRole("region", { name: "Szczegóły wybranego ośrodka" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Szczegóły" }));
    expect(screen.getByRole("region", { name: "Szczegóły wybranego ośrodka" })).toHaveTextContent("Rozliczenia NFZ za A010,5 mln zł41,7% kraju");
    fireEvent.click(screen.getByRole("button", { name: "Usuń wybór" }));
    expect(window.location.search).toBe("?widok=osrodki");
  });

  it("link z wybranym ośrodkiem otwiera zakładkę Ośrodki", () => {
    open("?osrodek=12%7C222");
    renderCard();
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("list", { name: "Linie wykresu" }).querySelector('[data-tone="selected"]')).toHaveTextContent("Szpital Beta");
  });

  it("ranking: struktura, kliknięcie wiersza wybiera ośrodek", () => {
    open("?widok=osrodki");
    renderCard();
    expect(screen.getByRole("img", { name: /3 największe: 100,0%/ })).toBeInTheDocument();
    const rows = within(screen.getByRole("region", { name: /^Lista ośrodków/ })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[1]);
    expect(window.location.search).toBe("?osrodek=07%7C111");
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
  });

  it("Jak leczą?: wykres nagłych zawsze, lejek tylko przy co najmniej 30 zgonach", () => {
    open("?widok=osrodki");
    renderCard();
    expect(screen.getByRole("group", { name: /udział przyjęć nagłych/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Wykres lejkowy/ })).not.toBeInTheDocument();
    expect(screen.getByText(/mniej niż 30 zgonów/)).toBeInTheDocument();
  });
});
