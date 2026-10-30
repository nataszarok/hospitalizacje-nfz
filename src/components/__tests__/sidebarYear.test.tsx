/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
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
    MultiSelect: () => null,
    NumberInput: () => null,
    SegmentedControl: () => null,
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
    ActionIcon: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  };
});

const reference: ReferencePayload = {
  analysisYear: "2025", defaultProductCode: "P1", products: [], regions: [], cities: [], durations: [],
};
const noop = () => {};
const baseProps = {
  reference, selectedProducts: [], setSelectedProducts: noop, durations: [], setDurations: noop, method: "min" as const,
  setMethod: noop, minHosp: 0, setMinHosp: noop, geoMode: "regions" as const, setGeoMode: noop,
  highlightedRegions: [], setHighlightedRegions: noop, highlightedCities: [], setHighlightedCities: noop,
};

afterEach(cleanup);

describe("Sidebar — wybór roku", () => {
  it("pokazuje lata od najnowszego i zgłasza zmianę roku", () => {
    const setYear = vi.fn();
    render(<Sidebar {...baseProps} activeTab="mortality" years={["2024", "2025"]} year="2025" setYear={setYear} />);
    const select = screen.getByTestId("year");
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["2025", "2024"]);
    fireEvent.change(select, { target: { value: "2024" } });
    expect(setYear).toHaveBeenCalledWith("2024");
  });

  it("ukrywa wybór roku, gdy jest tylko jeden rok", () => {
    render(<Sidebar {...baseProps} activeTab="mortality" years={["2025"]} year="2025" setYear={noop} />);
    expect(screen.queryByTestId("year")).not.toBeInTheDocument();
  });

  it("nie pokazuje wyboru roku w zakładce szpitala", () => {
    render(<Sidebar {...baseProps} activeTab="hospital" years={["2024", "2025"]} year="2025" setYear={noop} />);
    expect(screen.queryByTestId("year")).not.toBeInTheDocument();
  });
});

describe("Sidebar — rok w nagłówku", () => {
  it("w zakładce szpitala pokazuje najnowszy rok", () => {
    render(<Sidebar {...baseProps} reference={{ ...reference, analysisYear: "2024" }} activeTab="hospital" years={["2024", "2025"]} year="2024" setYear={noop} />);
    expect(screen.getByText("NFZ · analiza 2025")).toBeInTheDocument();
  });
});

describe("Sidebar w widoku „W czasie”", () => {
  it("ukrywa wybór roku, bo widok obejmuje wszystkie lata", () => {
    render(<Sidebar {...baseProps} activeTab="trend" years={["2024", "2025"]} year="2024" setYear={noop} />);
    expect(screen.queryByTestId("year")).not.toBeInTheDocument();
    expect(screen.queryByText("Wyróżnienie geograficzne")).not.toBeInTheDocument();
    expect(screen.getByText("Estymacja wartości ukrytych")).toBeInTheDocument();
    expect(screen.getByText("NFZ · analiza 2024–2025")).toBeInTheDocument();
  });
});
