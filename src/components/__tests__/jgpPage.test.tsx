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
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual(["Szpital Beta", "Szpital Alfa"]);
    expect(rows[0]).toHaveTextContent("Katowice");
    expect(rows[0]).toHaveTextContent("11,1%");
  });

  it("prowadzi do eksploratora z wybraną grupą", () => {
    render(<JgpPage data={data} />);
    expect(screen.getByRole("link", { name: "Pokaż w eksploratorze →" })).toHaveAttribute("href", "/analizy?t=w&jgp=A01");
  });
});
