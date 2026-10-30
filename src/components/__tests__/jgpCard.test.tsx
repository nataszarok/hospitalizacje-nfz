/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JgpPage } from "@/components/jgp/JgpPage";
import { buildJgpPageData } from "@/lib/jgpPage";
import { extrasFixture } from "@/lib/__tests__/fixtures/jgpCardFixture";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

// Wykresy Plotly zastępujemy prostymi listami: test sprawdza dane, które dostają.
vi.mock("@/components/jgp/GroupLineChart", () => ({
  GroupLineChart: ({ lines }: { lines: { key: string; name: string; values: number[]; tone?: string }[] }) => <ul aria-label="Linie wykresu">
    {lines.map((line) => <li key={line.key} data-tone={line.tone ?? ""}>{line.name}: {line.values.reduce((a, b) => a + b, 0)}</li>)}
  </ul>,
}));
vi.mock("@/components/jgp/ProviderScatter", () => ({
  ProviderScatter: ({ points, ariaLabel, onSelect }: { points: { key: string; name: string; y: number; selected?: boolean }[]; ariaLabel: string; onSelect?: (key: string) => void }) => <div role="group" aria-label={ariaLabel}>
    {points.map((point) => <button key={point.key} type="button" aria-pressed={point.selected ?? false} onClick={() => onSelect?.(point.key)}>{point.name}</button>)}
  </div>,
}));
vi.mock("@/components/trends/TrendView", () => ({ TrendView: () => <div>trend z pliku trendów</div> }));

const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!;
const open = (search = "") => window.history.replaceState(null, "", `/jgp/A01${search}`);
const rankingRows = () => within(within(screen.getByRole("region", { name: /Kto leczy najwięcej/ })).getAllByRole("table")[0]).getAllByRole("row").slice(1);

beforeEach(() => open());
afterEach(cleanup);

describe("Karta grupy — pasek liczb i wycena", () => {
  it("pokazuje liczby grupy z wyceną i rozliczeniami w zł", () => {
    const { container } = render(<JgpPage data={data} />);
    const band = container.querySelector('dl[aria-label="Liczby grupy"]')!;
    expect(band).toHaveTextContent("Hospitalizacje 202530+100,0% r/r");
    expect(band).toHaveTextContent("Wycena 20258207 pkt");
    expect(band).toHaveTextContent("Rozliczenia NFZ 20251,2 mln zł2024: 0,9 mln zł");
  });

  it("sekcja wyceny pokazuje punkty, dni ryczałtu i kwoty w latach", () => {
    render(<JgpPage data={data} />);
    const section = screen.getByRole("region", { name: "Wycena i wartość rozliczeń" });
    expect(section).toHaveTextContent("8207 pkt");
    expect(section).toHaveTextContent("ponad nie: 353 pkt za osobodzień");
    expect(within(section).getByRole("img")).toHaveAccessibleName("Rozliczenia NFZ za A01: 2024 0,90 mln zł, 2025 1,20 mln zł");
  });
});

describe("Karta grupy — W czasie", () => {
  it("domyślnie pokazuje Polskę, po przełączeniu linie ośrodków", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByRole("list", { name: "Linie wykresu" })).toHaveTextContent("Cała Polska: 45");
    fireEvent.click(screen.getByRole("button", { name: "Zgony" }));
    expect(screen.getByRole("list", { name: "Linie wykresu" })).toHaveTextContent("Cała Polska: 4");
    fireEvent.click(screen.getByRole("button", { name: "Top 2 ośrodków" }));
    expect(within(screen.getByRole("list", { name: "Linie wykresu" })).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(["1. Szpital Beta: 28", "2. Szpital Alfa: 17"]);
  });
});

describe("Karta grupy — wybrany szpital i filtry", () => {
  it("przełącznik „Podobne szpitale” porównuje z parami z modelu i zapisuje to w adresie", () => {
    open("?osrodek=07%7C111");
    render(<JgpPage data={data} />);
    const banner = screen.getByRole("region", { name: "Wybrany świadczeniodawca" });
    expect(banner).toHaveTextContent("Rozliczenia NFZ za A010,50 mln zł41,7% kraju");
    fireEvent.click(within(banner).getByRole("button", { name: "Podobne szpitale (1)" }));
    expect(window.location.search).toContain("porownanie=podobne");
    expect(screen.getByRole("button", { name: "Podobne do: Szpital Alfa ✕" })).toBeInTheDocument();
    expect(banner).toHaveTextContent("wśród podobnych szpitali");
  });

  it("kliknięcie województwa zawęża ranking i wykresy, drugi klik albo ✕ zdejmuje filtr", () => {
    render(<JgpPage data={data} />);
    expect(rankingRows()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Mazowieckie/ }));
    expect(window.location.search).toBe("?ow=07");
    expect(rankingRows().map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(["Szpital Alfa"]);
    expect(screen.getByRole("group", { name: /Wykres punktowy: 1 ośrodków, liczba hospitalizacji i śmiertelność/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Linie wykresu" })).toHaveTextContent("Wybrane ośrodki (1): 17");
    fireEvent.click(screen.getByRole("button", { name: "woj. mazowieckie ✕" }));
    expect(rankingRows()).toHaveLength(2);
    expect(window.location.search).toBe("");
  });

  it("kliknięcie punktu na wykresie wyróżnia ośrodek na całej karcie", () => {
    render(<JgpPage data={data} />);
    const scatter = screen.getByRole("group", { name: /liczba hospitalizacji i śmiertelność/ });
    fireEvent.click(within(scatter).getByRole("button", { name: "Szpital Alfa" }));
    expect(window.location.search).toBe("?osrodek=07%7C111");
    expect(screen.getByRole("region", { name: "Wybrany świadczeniodawca" })).toHaveTextContent("Szpital Alfa");
    expect(rankingRows()[1]).toHaveAttribute("aria-current", "true");
  });

  it("odczytuje województwo z adresu i ignoruje nieznany kod", () => {
    open("?ow=07");
    render(<JgpPage data={data} />);
    expect(rankingRows()).toHaveLength(1);
    cleanup();
    open("?ow=99");
    render(<JgpPage data={data} />);
    expect(rankingRows()).toHaveLength(2);
  });
});

describe("Karta grupy bez pliku grupy", () => {
  it("wraca do wykresu z pliku trendów i nie pokazuje wyceny w pasku", () => {
    render(<JgpPage data={buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")!} />);
    expect(screen.getByText("trend z pliku trendów")).toBeInTheDocument();
    expect(screen.queryByText(/Wycena 2025/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Wycena i wartość rozliczeń" })).toHaveTextContent("Brak danych o rozliczeniach w złotych.");
  });
});
