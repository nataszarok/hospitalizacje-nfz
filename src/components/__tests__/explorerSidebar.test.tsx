/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ExplorerSidebar, type ExplorerSidebarProps } from "@/components/explorer/ExplorerSidebar";
import type { ReferencePayload } from "@/lib/types";

vi.mock("@mantine/core", () => {
  type Option = string | { value: string; label: string };
  type Group = { group: string; items: Option[] };
  const options = (data: (Option | Group)[]): { value: string; label: string }[] => data.flatMap((o) =>
    typeof o === "string" ? [{ value: o, label: o }] : "group" in o ? options(o.items) : [o]);
  return {
    Select: ({ id, data, value, onChange, selectFirstOptionOnChange }: { id?: string; data: (Option | Group)[]; value: string | null; onChange: (v: string | null) => void; selectFirstOptionOnChange?: boolean }) => (
      <select data-testid={id} data-first-option={selectFirstOptionOnChange ? "true" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options(data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ),
    MultiSelect: ({ id, value, data, onChange, maxValues }: { id?: string; value: string[]; data: (Option | Group)[]; onChange: (v: string[]) => void; maxValues?: number }) => (
      <div data-testid={id} data-max={maxValues}>
        <span>{value.join(",")}</span>
        {options(data).map((o) => <button key={o.value} type="button" onClick={() => onChange([...value, o.value])}>dodaj {o.label}</button>)}
      </div>
    ),
    SegmentedControl: ({ data, value, onChange, "aria-label": label }: { data: { value: string; label: string }[]; value: string; onChange: (v: string) => void; "aria-label"?: string }) => (
      <div role="radiogroup" aria-label={label}>
        {data.map((o) => <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
      </div>
    ),
    Tooltip: ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => <>{children}<span role="tooltip">{label}</span></>,
    ActionIcon: ({ children, "aria-label": label }: { children: React.ReactNode; "aria-label"?: string }) => <button type="button" aria-label={label}>{children}</button>,
  };
});

const reference: ReferencePayload = {
  analysisYear: "2025", defaultProductCode: "P1",
  products: [
    { code: "P1", jgpCode: "E10", name: "OZW - DIAGNOSTYKA INWAZYJNA *", label: "E10 — OZW" },
    { code: "P2", jgpCode: "E27", name: "KORONAROGRAFIA", label: "E27 — Koronarografia" },
  ],
  regions: [{ owNfz: "07", name: "Mazowieckie" }], cities: ["WARSZAWA"], durations: ["0-1"],
};
const noop = () => {};

function props(overrides: Partial<ExplorerSidebarProps> = {}): ExplorerSidebarProps {
  return {
    view: "mortality", reference, years: ["2024", "2025"], year: "2025", setYear: noop,
    selectedProducts: ["P1"], setSelectedProducts: noop, areas: [], setAreas: noop,
    durations: [], setDurations: noop,
    ...overrides,
  };
}

/** Stan wyboru grup jak w eksploratorze: `setSelectedProducts` przyjmuje wartość albo funkcję. */
function trackSelection(initial: string[]) {
  let selected = initial;
  const set = vi.fn((next: string[] | ((current: string[]) => string[])) => { selected = typeof next === "function" ? next(selected) : next; });
  return { set, get: () => selected };
}

afterEach(cleanup);

describe("ExplorerSidebar", () => {
  it("pokazuje wybrane grupy jako listę z kodem i nazwą w formie zdania", () => {
    render(<ExplorerSidebar {...props({ selectedProducts: ["P1", "P2"] })} />);
    const list = screen.getByRole("list", { name: "Wybrane grupy JGP" });
    expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["E10Ozw - diagnostyka inwazyjna×", "E27Koronarografia×"]);
    expect(screen.getByText("2/10")).toBeInTheDocument();
    // W polu wyszukiwania są tylko grupy jeszcze niewybrane.
    expect([...screen.getByTestId("products").querySelectorAll("option")].map((o) => o.value)).toEqual([]);
  });

  it("dodaje grupę z pola wyszukiwania i usuwa ją przyciskiem", () => {
    const selection = trackSelection(["P1"]);
    render(<ExplorerSidebar {...props({ setSelectedProducts: selection.set })} />);
    fireEvent.change(screen.getByTestId("products"), { target: { value: "P2" } });
    expect(selection.get()).toEqual(["P1", "P2"]);
    fireEvent.click(screen.getByRole("button", { name: "Usuń E10" }));
    expect(selection.get()).toEqual(["P2"]);
  });

  it("Enter w polu wyszukiwania dodaje pierwszą pasującą grupę (pierwsza opcja jest zaznaczona)", () => {
    render(<ExplorerSidebar {...props()} />);
    expect(screen.getByTestId("products")).toHaveAttribute("data-first-option", "true");
  });

  it("„Usuń wszystkie” czyści wybór przy co najmniej dwóch grupach", () => {
    const setSelectedProducts = vi.fn();
    render(<ExplorerSidebar {...props({ selectedProducts: ["P1", "P2"], setSelectedProducts })} />);
    fireEvent.click(screen.getByRole("button", { name: "Usuń wszystkie" }));
    expect(setSelectedProducts).toHaveBeenCalledWith([]);
  });

  it("wybiera rok od najnowszego w widokach jednego roku", () => {
    const setYear = vi.fn();
    render(<ExplorerSidebar {...props({ setYear })} />);
    const year = screen.getByTestId("year");
    expect([...year.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["2025", "2024"]);
    fireEvent.change(year, { target: { value: "2024" } });
    expect(setYear).toHaveBeenCalledWith("2024");
  });

  it("w widoku Gdzie rok to oś czasu z odtwarzaniem", () => {
    const setYear = vi.fn();
    render(<ExplorerSidebar {...props({ view: "regions", setYear })} />);
    const slider = screen.getByRole("slider", { name: "Rok" });
    expect(slider).toHaveValue("1");
    expect(screen.getByRole("button", { name: "Odtwórz lata" })).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: "0" } });
    expect(setYear).toHaveBeenCalledWith("2024");
  });

  it("nazwa wybranej grupy z innego roku zostaje, gdy bieżący katalog jej nie ma", () => {
    render(<ExplorerSidebar {...props({ selectedProducts: ["P9"], knownProducts: [{ code: "P9", jgpCode: "Z99", name: "GRUPA SPRZED ZMIANY KATALOGU", label: "Z99" }] })} />);
    expect(screen.getByRole("list", { name: "Wybrane grupy JGP" })).toHaveTextContent("Z99Grupa sprzed zmiany katalogu");
  });

  it("w widoku „W czasie” nie ma wyboru roku", () => {
    render(<ExplorerSidebar {...props({ view: "trend" })} />);
    expect(screen.queryByTestId("year")).not.toBeInTheDocument();
    expect(screen.queryByText("Rok")).not.toBeInTheDocument();
  });

  it("nie ma progu hospitalizacji, wyróżnień ani metody <5; objaśnienia są w podpowiedziach „?”", () => {
    render(<ExplorerSidebar {...props()} />);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Zakres analizy", "Filtry"]);
    expect(screen.queryByText(/Minimalna liczba|Wyróżnij|Wartości/)).not.toBeInTheDocument();
    expect(screen.getByTestId("durations")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Objaśnienie: Obszar" })).toBeInTheDocument();
    expect(screen.getAllByRole("tooltip").map((t) => t.textContent)).toContainEqual(expect.stringContaining("Filtr działa tylko w bieżącym widoku."));
  });

  it("obszar: do 5 województw lub miast naraz, licznik i dodawanie kolejnego", () => {
    const setAreas = vi.fn();
    render(<ExplorerSidebar {...props({ setAreas, areas: [{ kind: "region", owNfz: "07" }] })} />);
    const area = screen.getByTestId("area");
    expect(area).toHaveAttribute("data-max", "5");
    expect(area).toHaveTextContent("ow:07");
    expect(screen.getByText("1/5")).toBeInTheDocument();
    fireEvent.click(within(area).getByRole("button", { name: "dodaj Warszawa" }));
    expect(setAreas).toHaveBeenCalledWith([{ kind: "region", owNfz: "07" }, { kind: "city", city: "WARSZAWA" }]);
  });

  it("w widoku Gdzie nie ma filtra długości pobytu", () => {
    render(<ExplorerSidebar {...props({ view: "regions" })} />);
    expect(screen.queryByTestId("durations")).not.toBeInTheDocument();
    expect(screen.queryByText("Filtry")).not.toBeInTheDocument();
  });

  it.each(["trend", "mortality", "admissions"] as const)("w widoku %s jest filtr długości pobytu", (view) => {
    render(<ExplorerSidebar {...props({ view })} />);
    expect(screen.getByTestId("durations")).toBeInTheDocument();
  });

  it("nie ma ustawień wykresu (są nad wykresem)", () => {
    render(<ExplorerSidebar {...props({ view: "trend", selectedProducts: ["P1", "P2"] })} />);
    expect(screen.queryByRole("heading", { name: "Wykres" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
