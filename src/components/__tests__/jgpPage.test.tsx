/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { JgpPage } from "@/components/jgp/JgpPage";
import { buildJgpPageData } from "@/lib/jgpPage";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

vi.mock("@/components/trends/TrendView", () => ({
  TrendView: ({ productCodes, method }: { productCodes: string[]; method: string }) => <div>trend: {productCodes.join(",")}/{method}</div>,
}));
afterEach(cleanup);

/** Tabela w sekcji o danym nagłówku. */
const tableIn = (heading: string) => within(screen.getByRole("region", { name: heading })).getByRole("table");

describe("JgpPage", () => {
  const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")!;

  it("pokazuje nagłówek grupy, zakres lat i trend dla jej produktów", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A01 Stały produkt");
    expect(screen.getByText(/w danych: 2023–2025/)).toBeInTheDocument();
    expect(screen.getByText("trend: P1/min")).toBeInTheDocument();
  });

  it("pokazuje ranking świadczeniodawców z najnowszego roku", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByRole("heading", { name: "Kto leczy najwięcej · 2025" })).toBeInTheDocument();
    const rows = within(tableIn("Kto leczy najwięcej · 2025")).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(["Szpital Beta", "Szpital Alfa"]);
    expect(rows[0]).toHaveTextContent("Katowice");
    expect(rows[0]).toHaveTextContent("11,1%");
    expect(within(rows[0]).getByRole("link", { name: "Szpital Beta" })).toHaveAttribute("href", "/szpitale?hospital=12%7C222");
  });

  it("pokazuje województwa na 100 tys. mieszkańców", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByRole("heading", { name: "Gdzie · 2025" })).toBeInTheDocument();
    const rows = within(tableIn("Gdzie · 2025")).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["Śląskie", "Mazowieckie"]);
    expect(rows[0]).toHaveTextContent("0,4");
  });

  it("pokazuje typ grupy i strukturę trybu przyjęcia w latach", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByText("Grupa JGP · zachowawcza")).toBeInTheDocument();
    const rows = within(tableIn("Planowo czy w trybie nagłym")).getAllByRole("row").slice(1);
    // P1 (metoda min): 2023 — 8 planowych; 2024 — 5 nagłych i 3 pozostałe; 2025 — 9 planowych.
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["2023", "2024", "2025"]);
    expect(rows[1]).toHaveTextContent("5 (62,5%)");
    expect(rows[1]).toHaveTextContent("3 (37,5%)");
    expect(within(rows[1]).getByRole("img")).toHaveAccessibleName("Planowe 0,0%, Nagłe 62,5%, Pozostałe 37,5%");
    expect(screen.getByText(/W 2025 r\. 0,0% hospitalizacji to przyjęcia nagłe/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tryb przyjęcia u świadczeniodawców →" })).toHaveAttribute("href", "/analizy?t=a&jgp=A01");
  });

  it("oznacza grupę zabiegową i usuwa gwiazdkę z nazwy", () => {
    const procedural = buildJgpPageData({
      ...trendsFixture,
      products: [["P1", "A01", "Zabieg *", ["2023", "2024", "2025"]], ...trendsFixture.products.slice(1)],
    }, latestDatasetFixture, "A01")!;
    render(<JgpPage data={procedural} />);
    expect(screen.getByText("Grupa JGP · zabiegowa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A01 Zabieg");
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("*");
  });

  it("prowadzi do eksploratora z wybraną grupą", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByRole("link", { name: "Pokaż w eksploratorze →" })).toHaveAttribute("href", "/analizy?jgp=A01");
  });
});
