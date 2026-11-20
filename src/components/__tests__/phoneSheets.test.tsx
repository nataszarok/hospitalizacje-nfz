/** @vitest-environment jsdom */
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render as baseRender, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CellTip } from "@/components/CellTip";
import { ChartTooltip } from "@/components/ChartTooltip";
import { ShareBars, ShareLegend } from "@/components/ShareBars";
import { SectionHead } from "@/components/jgp/JgpTabbedCard";
import { PHONE_QUERY } from "@/lib/useMediaQuery";

// jsdom nie ma `matchMedia`: telefon = zapytanie PHONE_QUERY spełnione.
let phone = false;
window.matchMedia = ((query: string) => ({
  matches: phone && query === PHONE_QUERY, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
window.scrollBy = () => {};
const render = (node: ReactNode) => baseRender(<MantineProvider>{node}</MantineProvider>);

afterEach(() => { cleanup(); phone = false; });

describe("telefon: arkusz od dołu zamiast dymka (DESIGN.md 6.3)", () => {
  it("ChartTooltip z `onClose` na telefonie to arkusz z „Zamknij”; na szerokim ekranie dymek", () => {
    let closed = 0;
    const anchor = { left: 10, top: 10, width: 4, height: 4 };
    const node = <ChartTooltip anchor={anchor} container={createRef()} onClose={() => { closed++; }}>Treść</ChartTooltip>;
    render(node);
    expect(screen.getByRole("tooltip").textContent).toContain("Treść");
    cleanup();
    phone = true;
    render(node);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("dialog").textContent).toContain("Treść");
    fireEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(closed).toBe(1);
  });

  it("ChartTooltip bez `onClose` zostaje dymkiem także na telefonie", () => {
    phone = true;
    render(<ChartTooltip anchor={{ left: 0, top: 0, width: 1, height: 1 }} container={createRef()}>Dymek</ChartTooltip>);
    expect(screen.getByRole("tooltip").textContent).toContain("Dymek");
  });

  it("CellTip: szeroki ekran — `title`; telefon — przycisk otwiera arkusz z liniami", () => {
    render(<CellTip title="N24: śmiertelność" lines={["Szpital: 1,0%", "Polska: 0,5%"]}>1,0%</CellTip>);
    expect(screen.getByText("1,0%").getAttribute("title")).toBe("Szpital: 1,0%\nPolska: 0,5%");
    cleanup();
    phone = true;
    render(<CellTip title="N24: śmiertelność" lines={["Szpital: 1,0%", "Polska: 0,5%"]}>1,0%</CellTip>);
    fireEvent.click(screen.getByRole("button", { name: "1,0%" }));
    expect(screen.getByRole("dialog", { name: "N24: śmiertelność" }).textContent).toContain("Polska: 0,5%");
  });

  it("ShareBars: na telefonie dotknięcie wiersza otwiera arkusz z udziałami", () => {
    phone = true;
    render(<ShareBars ariaLabel="Długość pobytu" rows={[{ key: "2025", label: "2025", parts: [{ key: "a", label: "0 dni", value: 1, className: "" }, { key: "b", label: "1–2 dni", value: 3, className: "" }] }]} />);
    fireEvent.click(screen.getByRole("listitem", { name: /2025/ }));
    expect(screen.getByRole("dialog", { name: "2025" }).textContent).toContain("1–2 dni75,0%");
  });

  it("ShareLegend: liczba pozycji w osobnym elemencie (znika na telefonie w CSS)", () => {
    render(<ShareLegend parts={[{ key: "P", label: "P · pediatria", detail: ": 14 316", className: "" }]} />);
    expect(screen.getByText(": 14 316").tagName).toBe("SPAN");
    expect(screen.getByRole("listitem").textContent).toContain("P · pediatria: 14 316");
  });
});

describe("SectionHead (DESIGN.md 6.3, 7.1b.1)", () => {
  it("objaśnienie „?” przy tytule; bez objaśnienia na szerokim ekranie nie ma ikony", () => {
    render(<SectionHead id="a" question="Ile?" context="Hospitalizacje rocznie" tag="Lata" help={["Rok bez hospitalizacji to przerwa."]} helpLabel="Jak czytać" />);
    expect(screen.getByRole("heading", { name: /Ile\?/ }).contains(screen.getByRole("button", { name: "Jak czytać" }))).toBe(true);
    cleanup();
    render(<SectionHead id="b" question="Co leczy?" context="Sekcje JGP" tag="Rok" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("telefon: „?” także bez objaśnienia; pierwsza linia arkusza to dopisek tytułu", () => {
    phone = true;
    render(<SectionHead id="b" question="Co leczy?" context="Sekcje JGP, 2025" tag="Rok" />);
    fireEvent.click(screen.getByRole("button", { name: "Objaśnienie: Co leczy?" }));
    expect(screen.getByRole("dialog").textContent).toContain("Sekcje JGP, 2025.");
  });
});
