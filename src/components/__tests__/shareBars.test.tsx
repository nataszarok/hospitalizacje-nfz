/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ShareBars, ShareLegend } from "@/components/ShareBars";

afterEach(cleanup);

const parts = [{ key: "a", label: "nagłe", className: "x" }, { key: "b", label: "planowe", className: "y" }];

describe("ShareBars — słupki 100% w wierszach", () => {
  it("każdy wiersz ma udziały w etykiecie (czytnik, Tab); część zerowa nie ma odcinka słupka", () => {
    render(<ShareBars ariaLabel="Tryb" rows={[
      { key: "2024", label: "2024", parts: parts.map((part, i) => ({ ...part, value: [3, 1][i] })) },
      { key: "2025", label: "2025", on: true, parts: parts.map((part, i) => ({ ...part, value: [2, 0][i] })) },
    ]} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveAttribute("aria-label", "2024: nagłe 75,0%, planowe 25,0%");
    expect(rows[1]).toHaveAttribute("aria-label", "2025: nagłe 100,0%, planowe 0,0%");
    expect(rows[1].querySelectorAll("[style]")).toHaveLength(1);
  });

  it("z `labels`: sam skrót (np. litera sekcji) tylko w odcinkach od 6%; ciemny odcinek ma biały podpis", () => {
    render(<ShareBars labels ariaLabel="Sekcje" rows={[{ key: "2025", label: "2025", parts: [
      { key: "H", label: "H", short: "H", dark: true, value: 95, className: "x" },
      { key: "B", label: "B", short: "B", value: 5, className: "y" },
    ] }]} />);
    const segments = screen.getByRole("listitem").querySelectorAll("[style]");
    expect([...segments].map((segment) => segment.textContent)).toEqual(["H", ""]);
    expect(segments[0].className).toMatch(/onDark/);
  });

  it("legenda ma nazwy części", () => {
    render(<ShareLegend parts={parts} />);
    expect(screen.getByRole("list", { name: "Legenda" })).toHaveTextContent("nagłeplanowe");
  });
});
