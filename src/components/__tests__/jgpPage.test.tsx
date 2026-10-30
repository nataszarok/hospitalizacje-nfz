/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

describe("JgpPage z wyróżnionym świadczeniodawcą (?osrodek=)", () => {
  const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 1)!;
  const openWith = (key: string | null) => window.history.replaceState(null, "", key ? `/jgp/A01?osrodek=${encodeURIComponent(key)}` : "/jgp/A01");
  afterEach(() => openWith(null));

  it("bez parametru nie pokazuje opisu wybranego świadczeniodawcy", () => {
    openWith(null);
    render(<JgpPage data={data} />);
    expect(screen.queryByRole("region", { name: "Wybrany świadczeniodawca" })).not.toBeInTheDocument();
  });

  it("pokazuje miejsce i wskaźniki na tle grupy oraz dopisuje wiersz spoza czołówki", () => {
    openWith("07|111");
    render(<JgpPage data={data} />);
    const banner = screen.getByRole("region", { name: "Wybrany świadczeniodawca" });
    expect(banner).toHaveTextContent("Szpital Alfa");
    // A01 (min): Beta 18 hosp., 2 zgony; Alfa 12 hosp., 1 zgon → miejsce 2 z 2, 40,0% grupy.
    expect(banner).toHaveTextContent("2 / 2");
    expect(banner).toHaveTextContent("40,0% grupy");
    expect(banner).toHaveTextContent("grupa: 10,0%");
    const rows = within(tableIn("Kto leczy najwięcej · 2025")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).toHaveTextContent("… 2");
  });

  it("usuwa wyróżnienie z adresu", () => {
    openWith("12|222");
    render(<JgpPage data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń wyróżnienie" }));
    expect(window.location.search).toBe("");
    expect(screen.queryByRole("region", { name: "Wybrany świadczeniodawca" })).not.toBeInTheDocument();
  });

  it("mówi, gdy wybrany świadczeniodawca nie leczy w tej grupie", () => {
    openWith("12|333");
    render(<JgpPage data={data} />);
    expect(screen.getByRole("region", { name: "Wybrany świadczeniodawca" })).toHaveTextContent("nie ma hospitalizacji w grupie A01 w 2025 r.");
    expect(screen.getByRole("link", { name: "Profil szpitala →" })).toHaveAttribute("href", "/szpitale?hospital=12%7C333");
  });
});
