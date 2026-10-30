/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SanokCodesView } from "@/components/sanok/SanokCodesPage";
import { sanokDataset } from "@/lib/__tests__/fixtures/sanokDataset";

vi.mock("@/components/sanok/SanokTrendChart", () => ({
  FACILITY_COLORS: ["#000", "#111"],
  SanokTrendChart: ({ title, series, metric }: { title: string; series: { count: number }[][]; metric: string }) => (
    <div data-testid={`chart-${metric}`}>{title}: {series.map((points) => points.map((point) => point.count).join("/")).join(" | ")}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(2) as HTMLTableRowElement[];

describe("SanokCodesView", () => {
  it("pokazuje wiersz sumy i kody od najliczniejszego", () => {
    render(<SanokCodesView dataset={sanokDataset} />);
    const rows = bodyRows();

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Wszystkie kody E");
    expect(rows.slice(1).map((row) => row.cells[0].textContent)).toEqual(["E27", "E53G", "E50"]);
    expect(rows[2]).toHaveTextContent("Niewydolność krążenia");
  });

  it("wyróżnia wyższy udział pobytów 6+ dni", () => {
    render(<SanokCodesView dataset={sanokDataset} />);
    const e53g = bodyRows()[2];

    expect(e53g.cells[4].className).not.toMatch(/higher/);
    expect(e53g.cells[5].className).toMatch(/higher/);
  });

  it("sortuje po kliknięciu nagłówka", () => {
    render(<SanokCodesView dataset={sanokDataset} />);
    fireEvent.click(screen.getByRole("button", { name: /Kod/ }));

    expect(bodyRows().slice(1).map((row) => row.cells[0].textContent)).toEqual(["E27", "E50", "E53G"]);
  });

  it("zmienia wykres po kliknięciu wiersza", () => {
    render(<SanokCodesView dataset={sanokDataset} />);
    expect(screen.getByRole("heading", { level: 2, name: "Wszystkie kody E" })).toBeInTheDocument();
    expect(screen.getByTestId("chart-count")).toHaveTextContent("34/2 | 10/9");

    fireEvent.click(bodyRows()[2]);

    expect(screen.getByRole("heading", { level: 2, name: "E53G – Niewydolność krążenia" })).toBeInTheDocument();
    expect(screen.getByTestId("chart-count")).toHaveTextContent("4/0 | 10/5");
    expect(bodyRows()[2]).toHaveAttribute("aria-selected", "true");
  });
});
