/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FunnelLegend, SelectedLegendItem } from "@/components/jgp/FunnelLegend";

afterEach(cleanup);

describe("FunnelLegend", () => {
  it("pięć stopni skali; pozycje dodatkowe (wybrany ośrodek) przed skalą", () => {
    const { rerender } = render(<FunnelLegend />);
    const legend = screen.getByRole("list", { name: "Legenda lejka" });
    expect(legend.querySelectorAll("li")).toHaveLength(5);
    rerender(<FunnelLegend><SelectedLegendItem name="Szpital Alfa" /></FunnelLegend>);
    expect(legend.querySelectorAll("li")).toHaveLength(6);
    expect(legend.querySelector("li")).toHaveTextContent("wybrany ośrodek: Szpital Alfa");
  });

  it("wariant w rogu wykresu ma osobną klasę (pion, prawy górny róg)", () => {
    render(<FunnelLegend corner />);
    expect(screen.getByRole("list", { name: "Legenda lejka" }).className).toMatch(/cornerLegend/);
  });
});
