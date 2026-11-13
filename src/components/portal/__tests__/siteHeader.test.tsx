/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/portal/SiteHeader";
import {
  DASHBOARD_TAB_NAVIGATE_EVENT, HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT,
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
  it("prowadzi Szpitale do katalogu, Porównania do porównania szpitali, a O danych do /o-danych; bez Eksploratora szpitali", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Szpitale" })).toHaveAttribute("href", "/szpitale");
    expect(screen.queryByRole("link", { name: "Eksplorator szpitali" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Porównania" })).toHaveAttribute("href", "/szpitale/eksplorator?hv=c");
    expect(screen.getByRole("link", { name: "O danych" })).toHaveAttribute("href", "/o-danych");
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("aria-current", "page");
  });

  it("ma osiem pozycji w kolejności od podsumowania do szczegółów; Artykuły prowadzą do /artykuly", () => {
    render(<SiteHeader />);
    const items = [...nav().querySelectorAll(":scope > a")].map((item) => item.textContent?.trim());
    expect(items).toEqual(["Start", "Przegląd", "Grupy JGP", "Eksplorator JGP", "Szpitale", "Porównania", "Artykuły", "O danych"]);
    expect(screen.getByRole("link", { name: "Artykuły" })).toHaveAttribute("href", "/artykuly");
    expect(screen.getByRole("link", { name: "Przegląd" })).toHaveAttribute("href", "/hospitalizacje");
  });

  it.each([
    ["/hospitalizacje", "", "Przegląd"],
    ["/szpitale", "", "Szpitale"],
    ["/szpitale/6691044410-16", "", "Szpitale"],
    ["/szpitale/eksplorator", "", "Porównania"],
    ["/szpitale/eksplorator", "?hv=c", "Porównania"],
    ["/o-danych", "", "O danych"],
    ["/artykuly", "", "Artykuły"],
  ])("na %s%s oznacza aktywną pozycję %s", (pathname, search, label) => {
    openPage(pathname, search);
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });

  it("Eksplorator JGP to jeden link do /analizy, bez menu widoków", () => {
    openPage("/analizy", "?t=k");
    render(<SiteHeader />);
    const link = screen.getByRole("link", { name: "Eksplorator JGP" });
    expect(link).toHaveAttribute("href", "/analizy");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: /Eksplorator JGP/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Kto leczy|Tryb przyjęcia|Gdzie|W czasie/ })).not.toBeInTheDocument();
  });

  it.each(["/jgp", "/jgp/E10"])("na %s oznacza aktywną pozycję Grupy JGP", (pathname) => {
    openPage(pathname);
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Grupy JGP" })).toHaveAttribute("href", "/jgp");
    expect(screen.getByRole("link", { name: "Grupy JGP" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Eksplorator JGP" })).not.toHaveAttribute("aria-current");
  });

  it("na /analizy wraca do pierwszego widoku zdarzeniem zamiast przeładowania strony", () => {
    openPage("/analizy", "?t=g");
    const listener = vi.fn();
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    render(<SiteHeader />);
    const event = click(screen.getByRole("link", { name: "Eksplorator JGP" }));
    window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, listener);
    expect(event.defaultPrevented).toBe(true);
    expect(listener.mock.calls[0][0].detail).toEqual({ tab: "trend" });
  });

  it("na stronie porównania szpitali link Porównania zostaje na stronie (zdarzenie, bez przeładowania)", () => {
    openPage("/szpitale/eksplorator");
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
    const event = click(screen.getByRole("link", { name: "Porównania" }));
    window.removeEventListener(HOSPITAL_VIEW_NAVIGATE_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("odświeża aktywny widok po zdarzeniach ze stron", () => {
    openPage("/szpitale/eksplorator");
    render(<SiteHeader />);
    act(() => { window.dispatchEvent(new CustomEvent(HOSPITAL_VIEW_CHANGED_EVENT, { detail: { view: "comparison" } })); });
    expect(screen.getByRole("link", { name: "Porównania" })).toHaveAttribute("aria-current", "page");
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
    openPage("/szpitale/eksplorator");
    render(<SiteHeader />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Szukaj" }));
    expect(screen.getByRole("button", { name: "Zamknij wyszukiwarkę" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("search")).toHaveLength(2);
  });
});
