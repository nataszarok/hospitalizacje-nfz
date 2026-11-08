/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ChartTooltip, TooltipCompareTable, TooltipHead, TooltipKeyValue, TooltipNote, TooltipSection } from "@/components/ChartTooltip";

afterEach(cleanup);

function setup() {
  const container = createRef<HTMLDivElement>();
  const anchor = { left: 100, top: 100, width: 10, height: 10 };
  render(<div ref={container}>
    <ChartTooltip anchor={anchor} container={container}>
      <TooltipHead title="Szpital Wojewódzki" context="Kraków · Małopolskie · E53G" />
      <TooltipKeyValue label="Śmiertelność" value="12,4%" delta="+5,7 pp wobec grupy porównawczej" tone="up" />
      <TooltipCompareTable columns={["Ten szpital", "Podobne (12)"]} rows={[{ label: "Hospitalizacje", values: ["1 245", "980"] }]} />
      <TooltipSection title="Dane" rows={[{ label: "Zgony", value: "154", hint: "w 2025 r." }]} />
      <TooltipNote>Metoda konserwatywna.</TooltipNote>
    </ChartTooltip>
  </div>);
  return screen.getByRole("tooltip");
}

describe("ChartTooltip — dymek rozszerzony", () => {
  it("pokazuje nazwę, kontekst, wartość kluczową z różnicą, tabelę porównania, sekcję i przypis", () => {
    const tooltip = setup();
    expect(tooltip).toHaveTextContent("Szpital Wojewódzki");
    expect(tooltip).toHaveTextContent("Kraków · Małopolskie · E53G");
    expect(tooltip).toHaveTextContent("12,4%");
    expect(tooltip).toHaveTextContent("+5,7 pp wobec grupy porównawczej");
    const table = within(tooltip).getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Podobne (12)" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Hospitalizacje" })).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Zgony");
    expect(tooltip).toHaveTextContent("Metoda konserwatywna.");
  });

  it("po pomiarze ustawia pozycję i stronę z funkcji placeTooltip (obok obiektu, nie na nim)", () => {
    const tooltip = setup();
    expect(tooltip.dataset.ready).toBe("true");
    expect(tooltip.dataset.placement).toBe("right");
    // Prawa krawędź obiektu (110 px) + strefa ochronna 12 px.
    expect(tooltip.style.left).toBe("122px");
  });
});
