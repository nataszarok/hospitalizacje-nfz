/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MonthLines, ValueBars } from "@/components/summary/SummaryCharts";

afterEach(cleanup);

describe("Wykresy karty „Hospitalizacje w Polsce”", () => {
  it("opisuje słupki lat w podanym formacie i wyróżnia ostatni rok", () => {
    const { container } = render(<ValueBars years={["2024", "2025"]} values={[2.42, 2.38]} format={(v) => v.toFixed(1)} label="Odsetek zgonów" />);
    expect(screen.getByRole("img", { name: "Odsetek zgonów: 2024 — 2.4, 2025 — 2.4" })).toBeInTheDocument();
    const [previous, latest] = container.querySelectorAll("rect");
    expect(previous.getAttribute("class")).not.toBe(latest.getAttribute("class"));
  });

  it("rysuje linie miesięcy bez miesięcy bez danych; oś zaczyna się od zaokrąglonego minimum", () => {
    const months = [
      { year: "2024", values: [460_000, 470_000, ...Array<null>(10).fill(null)] },
      { year: "2025", values: [480_000, null, 500_000, ...Array<null>(9).fill(null)] },
    ];
    const { container } = render(<MonthLines months={months} />);
    expect(screen.getByRole("img", { name: /2025: sty 480\s000, lut brak, mar 500\s000/ })).toBeInTheDocument();
    const [previous, latest] = container.querySelectorAll("polyline");
    expect(previous.getAttribute("points")!.split(" ")).toHaveLength(2);
    expect(latest.getAttribute("points")!.split(" ")).toHaveLength(2);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect([...container.querySelectorAll("text")].slice(0, 3).map((t) => t.textContent)).toEqual(["450 tys.", "475 tys.", "500 tys."]);
  });
});
