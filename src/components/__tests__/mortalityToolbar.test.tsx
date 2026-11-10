/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { ChartScaleControl } from "@/components/ChartScaleControl";
import { FunnelControl } from "@/components/FunnelControl";
import { pointCaption } from "@/components/MortalityTab";

afterEach(cleanup);

// Mantine czyta preferowany motyw z `matchMedia`; jsdom go nie ma.
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
// SegmentedControl mierzy przyciski przez `ResizeObserver`.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const wrap = (node: ReactNode) => render(<MantineProvider>{node}</MantineProvider>);

describe("Pasek nad wykresem „Kto leczy”", () => {
  it("lejek to przełącznik tak/nie", () => {
    const onChange = vi.fn();
    wrap(<FunnelControl value={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Lejek śmiertelności" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("niedostępny lejek: przełącznik wyszarzony i wyłączony, mimo zapisanego wyboru", () => {
    wrap(<FunnelControl value onChange={() => {}} disabled />);
    const toggle = screen.getByRole("switch", { name: "Lejek śmiertelności" });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
  });

  it("krótki przełącznik osi X: „Oś X: Hosp. / Na 100 tys.”", () => {
    wrap(<ChartScaleControl value="total" onChange={() => {}} compact />);
    expect(screen.getByText("Oś X")).toBeInTheDocument();
    expect(screen.getByText("Hosp.")).toBeInTheDocument();
    expect(screen.getByText("Na 100 tys.")).toBeInTheDocument();
    expect(screen.queryByText("Liczba hospitalizacji")).not.toBeInTheDocument();
  });

  it("opis punktów: liczba i znaczenie punktu, z odmianą", () => {
    expect(pointCaption(1, "combined")).toBe("1 świadczeniodawca · wszystkie wybrane grupy razem");
    expect(pointCaption(12_345, "combined")).toMatch(/^12\s345 świadczeniodawców · wszystkie wybrane grupy razem$/);
    expect(pointCaption(3, "per_jgp")).toBe("3 punkty · każda grupa JGP osobno");
  });
});
