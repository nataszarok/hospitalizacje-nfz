/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/portal/SiteHeader";
import {
  DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT, HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT,
} from "@/lib/dashboardNavigation";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ push: vi.fn() }) }));

function openPage(pathname: string, search = "") {
  navigation.pathname = pathname;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

const nav = () => screen.getByRole("navigation", { name: "Nawigacja portalu" });
const click = (element: HTMLElement) => {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  act(() => { element.dispatchEvent(event); });
  return event;
};

beforeEach(() => openPage("/"));
afterEach(cleanup);

describe("SiteHeader", () => {
  it("prowadzi Szpitale i Porównania do /szpitale, a O danych do /o-danych", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Szpitale" })).toHaveAttribute("href", "/szpitale");
    expect(screen.getByRole("link", { name: "Porównania" })).toHaveAttribute("href", "/szpitale?hv=c");
    expect(screen.getByRole("link", { name: "O danych" })).toHaveAttribute("href", "/o-danych");
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["/szpitale", "", "Szpitale"],
    ["/szpitale", "?hv=c", "Porównania"],
    ["/o-danych", "", "O danych"],
  ])("na %s%s oznacza aktywną pozycję %s", (pathname, search, label) => {
    openPage(pathname, search);
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });

  it.each(["/analizy", "/jgp/E10"])("na %s oznacza aktywną sekcję Analizy", (pathname) => {
    openPage(pathname);
    render(<SiteHeader />);
    expect(screen.getByRole("button", { name: /Analizy/ }).className).toMatch(/linkActive/);
  });

  it("na /analizy przełącza widok zdarzeniem zamiast przeładowania strony", () => {
    openPage("/analizy");
    const listener = vi.fn();
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: /Analizy/ }));
    const event = click(screen.getByRole("link", { name: /Gdzie/ }));
    window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    expect(event.defaultPrevented).toBe(true);
    expect(listener.mock.calls[0][0].detail).toEqual({ tab: "regions" });
  });

  it("na /szpitale przełącza Profil i Porównanie zdarzeniem", () => {
    openPage("/szpitale");
    const listener = vi.fn();
    window.addEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, listener);
    render(<SiteHeader />);
    const link = screen.getByRole("link", { name: "Porównania" });
    const event = click(link);
    window.removeEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, listener);
    expect(event.defaultPrevented).toBe(true);
    expect(listener.mock.calls[0][0].detail).toEqual({ view: "comparison" });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("poza tą samą stroną zostawia zwykłą nawigację linkiem", () => {
    const listener = vi.fn();
    window.addEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, listener);
    render(<SiteHeader />);
    const event = click(screen.getByRole("link", { name: "Szpitale" }));
    window.removeEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("odświeża aktywny widok po zdarzeniach ze stron", () => {
    openPage("/szpitale");
    render(<SiteHeader />);
    act(() => { window.dispatchEvent(new CustomEvent(HOSPITAL_VIEW_CHANGED_EVENT, { detail: { view: "comparison" } })); });
    expect(screen.getByRole("link", { name: "Porównania" })).toHaveAttribute("aria-current", "page");
    cleanup();

    openPage("/analizy");
    render(<SiteHeader />);
    act(() => { window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_CHANGED_EVENT, { detail: { tab: "admissions" } })); });
    fireEvent.click(screen.getByRole("button", { name: /Analizy/ }));
    expect(screen.getByRole("link", { name: /Tryb przyjęcia/ })).toHaveAttribute("aria-current", "page");
  });

  it("menu analiz ma cztery widoki i zamyka się klawiszem Escape", () => {
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: /Analizy/ });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /W czasie/ })).toHaveAttribute("href", "/analizy");
    expect(screen.getByRole("link", { name: /Kto leczy/ })).toHaveAttribute("href", "/analizy?t=k");
    expect(screen.getByRole("link", { name: /Tryb przyjęcia/ })).toHaveAttribute("href", "/analizy?t=a");
    expect(screen.getByRole("link", { name: /Gdzie/ })).toHaveAttribute("href", "/analizy?t=g");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(nav()).toBeInTheDocument();
  });

  it("przełącza menu mobilne", () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    expect(screen.getByRole("button", { name: "Zamknij menu" })).toHaveAttribute("aria-expanded", "true");
  });

  it("na podstronach pokazuje wyszukiwarkę, na stronie głównej nie (jest w hero)", () => {
    render(<SiteHeader />);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    cleanup();
    openPage("/szpitale");
    render(<SiteHeader />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Szukaj" }));
    expect(screen.getByRole("button", { name: "Zamknij wyszukiwarkę" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("search")).toHaveLength(2);
  });
});
