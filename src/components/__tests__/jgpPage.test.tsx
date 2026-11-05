/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JgpPage } from "@/components/jgp/JgpPage";
import type { RegionsMap } from "@/lib/jgpCard";
import { buildJgpPageData } from "@/lib/jgpPage";
import { extrasFixture } from "@/lib/__tests__/fixtures/jgpCardFixture";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

// Wykresy Plotly zastępujemy prostymi listami: test sprawdza układ strony, nie rysowanie.
vi.mock("@/components/jgp/GroupLineChart", () => ({
  GroupLineChart: ({ lines }: { lines: { key: string; name: string }[] }) => <ul aria-label="Linie wykresu">{lines.map((line) => <li key={line.key}>{line.name}</li>)}</ul>,
}));
vi.mock("@/components/jgp/ProviderScatter", () => ({
  STAR_COLOR: "#D92D20",
  ProviderScatter: ({ ariaLabel }: { ariaLabel: string }) => <div role="group" aria-label={ariaLabel} />,
}));

const open = (search = "") => window.history.replaceState(null, "", `/jgp/A01${search}`);

beforeEach(() => open());
afterEach(cleanup);

describe("Strona grupy JGP", () => {
  it("każda sekcja katalogu ma kartę w zakładkach (A01 spoza dawnych sekcji E i H)", () => {
    render(<JgpPage data={buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A01 Stały produkt");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Przegląd", "Ośrodki2"]);
    // Elementy dawnej karty usunięte razem z nią.
    expect(screen.queryByText("Pokaż w eksploratorze →")).not.toBeInTheDocument();
    expect(screen.queryByText(/Najważniejsze/)).not.toBeInTheDocument();
  });

  it("działa bez pliku grupy (dane tylko z trendów)", () => {
    render(<JgpPage data={buildJgpPageData(trendsFixture, latestDatasetFixture, "A01")!} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A01 Stały produkt");
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });
});

describe("Strona grupy JGP — mapa z granicami", () => {
  const map: RegionsMap = {
    version: 1, source: "test (MIT)", viewBox: [100, 100],
    regions: [["07", "mazowieckie", "M10 10l20 0 0 20-20 0z", [20, 20]], ["12", "śląskie", "M50 50l20 0 0 20-20 0z", [60, 60]]],
  };

  it("rysuje województwa jako przyciski i zaznacza je kliknięciem albo klawiszem", () => {
    render(<JgpPage data={buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!} map={map} />);
    const shapes = within(screen.getByRole("group", { name: /Mapa województw/ })).getAllByRole("button");
    expect(shapes.map((shape) => shape.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^Mazowieckie: /), expect.stringMatching(/^Śląskie: /),
    ]);
    fireEvent.click(shapes[0]);
    expect(window.location.search).toBe("?ow=07");
    expect(shapes[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(shapes[1], { key: "Enter" });
    expect(window.location.search).toBe("?ow=07&ow=12");
  });
});
