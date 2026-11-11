/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FunnelLegend, SelectedLegendItem } from "@/components/jgp/FunnelLegend";

afterEach(cleanup);

describe("FunnelLegend", () => {
  it("pięć stopni skali i dwie linie granic; pozycje dodatkowe (wybrany ośrodek) przed skalą", () => {
    const { rerender } = render(<FunnelLegend />);
    const legend = screen.getByRole("list", { name: "Legenda granic odchyleń" });
    expect(legend.querySelectorAll("li")).toHaveLength(7);
    expect(legend).toHaveTextContent(/granica 95%granica 99,8%$/);
    rerender(<FunnelLegend><SelectedLegendItem name="Szpital Alfa" /></FunnelLegend>);
    expect(legend.querySelectorAll("li")).toHaveLength(8);
    expect(legend.querySelector("li")).toHaveTextContent("wybrany ośrodek: Szpital Alfa");
  });

  it("bez statusów (punkty w kolorach obszarów) zostają tylko linie granic", () => {
    render(<FunnelLegend statuses={false} />);
    const items = screen.getByRole("list", { name: "Legenda granic odchyleń" }).querySelectorAll("li");
    expect([...items].map((item) => item.textContent)).toEqual(["granica 95%", "granica 99,8%"]);
  });

  it("wariant w rogu wykresu ma osobną klasę (pion, prawy górny róg)", () => {
    render(<FunnelLegend corner />);
    expect(screen.getByRole("list", { name: "Legenda granic odchyleń" }).className).toMatch(/cornerLegend/);
  });
});
