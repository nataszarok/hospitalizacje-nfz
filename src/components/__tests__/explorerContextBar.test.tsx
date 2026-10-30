/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExplorerContextBar, type ExplorerContextBarProps } from "@/components/explorer/ExplorerContextBar";
import type { ReferencePayload } from "@/lib/types";

vi.mock("@mantine/core", () => {
  type Option = string | { value: string; label: string };
  const options = (data: Option[]) => data.map((o) => typeof o === "string" ? { value: o, label: o } : o);
  return {
    Select: ({ id, data, value, onChange }: { id?: string; data: Option[]; value: string | null; onChange: (v: string | null) => void }) => (
      <select data-testid={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options(data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ),
    MultiSelect: ({ id, value }: { id?: string; value: string[] }) => <div data-testid={id}>{value.join(",")}</div>,
    NumberInput: ({ id }: { id?: string }) => <input data-testid={id} />,
    SegmentedControl: () => null,
  };
});

const reference: ReferencePayload = {
  analysisYear: "2025", defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "E10", name: "OZW", label: "E10 — OZW" }],
  regions: [{ owNfz: "07", name: "Mazowieckie" }], cities: ["WARSZAWA"], durations: ["0-1"],
};
const noop = () => {};

function props(overrides: Partial<ExplorerContextBarProps> = {}): ExplorerContextBarProps {
  return {
    view: "mortality", reference, years: ["2024", "2025"], year: "2025", setYear: noop,
    selectedProducts: ["P1"], setSelectedProducts: noop, method: "min", setMethod: noop, minHosp: 0, setMinHosp: noop,
    durations: [], setDurations: noop, geoMode: "regions", setGeoMode: noop,
    highlightedRegions: [], setHighlightedRegions: noop, highlightedCities: [], setHighlightedCities: noop,
    ...overrides,
  };
}

afterEach(cleanup);

describe("ExplorerContextBar", () => {
  it("pokazuje wybrane grupy JGP i wybór roku od najnowszego", () => {
    const setYear = vi.fn();
    render(<ExplorerContextBar {...props({ setYear })} />);
    expect(screen.getByTestId("products")).toHaveTextContent("P1");
    const year = screen.getByTestId("year");
    expect([...year.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["2025", "2024"]);
    fireEvent.change(year, { target: { value: "2024" } });
    expect(setYear).toHaveBeenCalledWith("2024");
  });

  it("w widoku „W czasie” zamiast wyboru roku pokazuje zakres lat", () => {
    render(<ExplorerContextBar {...props({ view: "trend" })} />);
    expect(screen.getByText("2024–2025")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/obejmuje wszystkie lata/)).toBeInTheDocument();
  });

  it("chowa ustawienia zaawansowane w „Więcej filtrów” i pokazuje liczbę aktywnych", () => {
    render(<ExplorerContextBar {...props({ minHosp: 50, method: "sim" })} />);
    expect(screen.queryByTestId("minHosp")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Więcej filtrów \(2\)/ });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("method")).toHaveValue("sim");
    expect(screen.getByTestId("minHosp")).toBeInTheDocument();
    expect(screen.getByTestId("durations")).toBeInTheDocument();
  });

  it.each(["trend", "regions"] as const)("w widoku %s filtry placówek są ukryte", (view) => {
    render(<ExplorerContextBar {...props({ view, minHosp: 50 })} />);
    fireEvent.click(screen.getByRole("button", { name: /Więcej filtrów/ }));
    expect(screen.getByTestId("method")).toBeInTheDocument();
    expect(screen.queryByTestId("minHosp")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Więcej filtrów/ }).textContent).not.toContain("(");
  });
});
