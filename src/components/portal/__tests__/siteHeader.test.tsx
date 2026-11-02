/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/portal/SiteHeader";
import { DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT } from "@/lib/dashboardNavigation";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

function openPage(pathname: string, search = "") {
  navigation.pathname = pathname;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

const nav = () => screen.getByRole("navigation", { name: "Nawigacja portalu" });

beforeEach(() => openPage("/"));
afterEach(cleanup);

describe("SiteHeader", () => {
  it("prowadzi Szpitale, Porównania i O danych do podstron dashboardu", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Szpitale" })).toHaveAttribute("href", "/analizy?t=h");
    expect(screen.getByRole("link", { name: "Porównania" })).toHaveAttribute("href", "/analizy?t=h&hv=c");
    expect(screen.getByRole("link", { name: "O danych" })).toHaveAttribute("href", "/analizy?t=m");
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["?t=h", "Szpitale"],
    ["?t=h&hv=c", "Porównania"],
    ["?t=m", "O danych"],
  ])("na /analizy%s oznacza aktywną pozycję %s", (search, label) => {
    openPage("/analizy", search);
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });

  it("na /analizy przełącza zakładkę zdarzeniem zamiast przeładowania strony", () => {
    openPage("/analizy");
    const listener = vi.fn();
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    render(<SiteHeader />);
    const link = screen.getByRole("link", { name: "Porównania" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => { link.dispatchEvent(event); });
    window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    expect(event.defaultPrevented).toBe(true);
    expect(listener.mock.calls[0][0].detail).toEqual({ tab: "hospital", hospitalSubtab: "comparison" });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("poza /analizy zostawia zwykłą nawigację linkiem", () => {
    const listener = vi.fn();
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    render(<SiteHeader />);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => { screen.getByRole("link", { name: "Szpitale" }).dispatchEvent(event); });
    window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("odświeża aktywną pozycję po zmianie zakładki w dashboardzie", () => {
    openPage("/analizy");
    render(<SiteHeader />);
    act(() => {
      window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_CHANGED_EVENT, { detail: { tab: "hospital", hospitalSubtab: "summary" } }));
    });
    expect(screen.getByRole("link", { name: "Szpitale" })).toHaveAttribute("aria-current", "page");
  });

  it("otwiera menu analiz i zamyka je klawiszem Escape", () => {
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: /Analizy/ });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Tryb Przyjęcia/ })).toHaveAttribute("href", "/analizy?t=a");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(nav()).toBeInTheDocument();
  });

  it("przełącza menu mobilne", () => {
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: "Otwórz menu" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Zamknij menu" })).toHaveAttribute("aria-expanded", "true");
  });
});
