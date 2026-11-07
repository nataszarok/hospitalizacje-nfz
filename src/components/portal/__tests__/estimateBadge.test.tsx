/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EstimateBadge } from "../EstimateBadge";
import { DataCard } from "../DataCard";

afterEach(cleanup);

describe("EstimateBadge", () => {
  it("pokazuje słowo „Szacunek” z opisem metody w podpowiedzi", () => {
    render(<EstimateBadge />);
    expect(screen.getByText("Szacunek").getAttribute("title")).toMatch(/<5/);
  });

  it("przyjmuje własny opis", () => {
    render(<EstimateBadge title="Metoda symulacyjna" />);
    expect(screen.getByText("Szacunek").getAttribute("title")).toBe("Metoda symulacyjna");
  });

  it("DataCard pokazuje plakietkę domyślnie i ukrywa ją przy estimate={false}", () => {
    const { rerender } = render(<DataCard id="a" kicker="K" title="T">wykres</DataCard>);
    expect(screen.getByText("Szacunek")).toBeTruthy();
    rerender(<DataCard id="a" kicker="K" title="T" estimate={false}>wykres</DataCard>);
    expect(screen.queryByText("Szacunek")).toBeNull();
  });
});
