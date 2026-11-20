/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render as baseRender, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { InfoTip, INFO_TIP_PHONE_QUERY } from "@/components/InfoTip";

// Szerokość ekranu w `matchMedia` (jsdom go nie ma): telefon = zapytanie InfoTip spełnione.
let phone = false;
window.matchMedia = ((query: string) => ({
  matches: phone && query === INFO_TIP_PHONE_QUERY, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
const render = (node: ReactNode) => baseRender(<MantineProvider>{node}</MantineProvider>);

afterEach(() => { cleanup(); phone = false; });

describe("InfoTip (DESIGN.md 6.3, dymek objaśnienia)", () => {
  it("szeroki ekran: kliknięcie przypina jasny dymek, Esc zamyka i oddaje fokus ikonie", async () => {
    render(<InfoTip label="Objaśnienie lokalizacji" ariaLabel="Lokalizacje szpitala" />);
    const icon = screen.getByRole("button", { name: "Lokalizacje szpitala" });
    expect(icon).toHaveAttribute("aria-expanded", "false");
    await act(async () => { fireEvent.click(icon); });
    expect(icon).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Objaśnienie lokalizacji");
    // Przypięty dymek nie znika po zjechaniu kursora.
    await act(async () => { fireEvent.mouseLeave(icon); await new Promise((r) => setTimeout(r, 200)); });
    expect(icon).toHaveAttribute("aria-expanded", "true");
    await act(async () => { fireEvent.keyDown(document, { key: "Escape" }); });
    expect(icon).toHaveAttribute("aria-expanded", "false");
    expect(icon).toHaveFocus();
  });

  it("szeroki ekran: drugie kliknięcie zamyka przypięty dymek", async () => {
    render(<InfoTip label="Tekst" ariaLabel="Jak czytać" />);
    const icon = screen.getByRole("button", { name: "Jak czytać" });
    await act(async () => { fireEvent.click(icon); });
    await act(async () => { fireEvent.click(icon); });
    expect(icon).toHaveAttribute("aria-expanded", "false");
  });

  it("telefon: arkusz od dołu z tytułem i przyciskiem „Zamknij”, bez dymka przy ikonie", async () => {
    phone = true;
    render(<InfoTip label="Objaśnienie lokalizacji" ariaLabel="Lokalizacje szpitala" />);
    const icon = screen.getByRole("button", { name: "Lokalizacje szpitala" });
    await act(async () => { fireEvent.click(icon); });
    const sheet = screen.getByRole("dialog", { name: "Lokalizacje szpitala" });
    expect(sheet).toHaveTextContent("Objaśnienie lokalizacji");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Zamknij" })); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(icon).toHaveFocus();
  });
});
