/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdmissionTab } from "@/components/AdmissionTab";
import { MortalityTab } from "@/components/MortalityTab";
import type {
  AdmissionPayload,
  AdmissionRow,
  MortalityPayload,
  MortalityRow,
  ReferencePayload,
} from "@/lib/types";

afterEach(() => {
  cleanup();
});

vi.mock("@mantine/core", () => ({
  SegmentedControl: ({ value }: { value: string }) => <div data-testid="segmented-control">{value}</div>,
}));

vi.mock("@/components/MortalityChart", () => ({
  MortalityChart: () => <div data-testid="mortality-chart" />,
}));

vi.mock("@/components/AdmissionChart", () => ({
  AdmissionChart: () => <div data-testid="admission-chart" />,
}));

vi.mock("@/components/AreaStatsPanel", () => ({
  AreaStatsPanel: () => <div data-testid="area-stats" />,
}));

const reference: ReferencePayload = {
  analysisYear: "2024",
  defaultProductCode: "P1",
  products: [
    { code: "P1", jgpCode: "E10", name: "Produkt E10", label: "E10 · Produkt E10" },
    { code: "P2", jgpCode: "A01", name: "Produkt A01", label: "A01 · Produkt A01" },
  ],
  regions: [{ owNfz: "07", name: "Mazowieckie" }],
  cities: ["Warszawa"],
  durations: ["0-1", "2-3"],
};

function mortalityRow(overrides: Partial<MortalityRow> = {}): MortalityRow {
  return {
    owNfz: "07",
    nip: "1234567890",
    productCode: "P1",
    providerName: "Szpital Testowy",
    city: "Warszawa",
    voivodeship: "Mazowieckie",
    population: 1_000_000,
    hospitalizations: 12_345.4,
    deaths: 321.6,
    mortalityPct: 2.345,
    hospitalizationsPer100k: 1234.54,
    ...overrides,
  };
}

function mortalityPayload(rows: MortalityRow[]): MortalityPayload {
  return {
    rows,
    current: { facilities: 1, hospitalizations: 100, deaths: 2, mortalityPct: 2 },
    baseline: { facilities: 1, hospitalizations: 100, deaths: 2, mortalityPct: 2 },
    hasComparison: false,
    areaStats: { regions: [], cities: [] },
    baselineAreaStats: { regions: [], cities: [] },
  };
}

function admissionRow(overrides: Partial<AdmissionRow> = {}): AdmissionRow {
  return {
    owNfz: "07",
    nip: "1234567890",
    productCode: "P1",
    providerName: "Szpital Testowy",
    city: "Warszawa",
    voivodeship: "Mazowieckie",
    population: 1_000_000,
    plannedAdmissions: 12_345.4,
    urgentAdmissions: 2_345.6,
    totalAdmissions: 14_691,
    plannedAdmissionsPer100k: 1234.54,
    urgentAdmissionsPer100k: 234.56,
    ...overrides,
  };
}

function admissionPayload(rows: AdmissionRow[]): AdmissionPayload {
  return {
    rows,
    areaStats: { regions: [], cities: [] },
  };
}

const commonProps = {
  reference,
  loading: false,
  error: null,
  selectedProducts: ["P1"],
  axisMode: "total" as const,
  setAxisMode: vi.fn(),
  geoMode: "regions" as const,
  highlightedRegions: [] as string[],
  highlightedCities: [] as string[],
};

describe("MortalityTab data table", () => {
  it("renders the expected columns and formatted values", () => {
    render(<MortalityTab {...commonProps} data={mortalityPayload([mortalityRow()])} />);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual([
      "Świadczeniodawca",
      "NIP",
      "KOD JGP",
      "Województwo",
      "Miasto",
      "Hospitalizacje",
      "Zgony",
      "Śmiertelność",
    ]);

    const cells = within(table).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual([
      "Szpital Testowy",
      "1234567890",
      "E10",
      "Mazowieckie",
      "Warszawa",
      (12_345).toLocaleString("pl-PL"),
      (322).toLocaleString("pl-PL"),
      "2.3%",
    ]);
  });

  it("uses the public JGP code and exposes the product label as a title", () => {
    render(<MortalityTab {...commonProps} data={mortalityPayload([mortalityRow()])} />);

    const jgpCell = screen.getByText("E10");
    expect(jgpCell).toHaveAttribute("title", "E10 · Produkt E10");
    expect(screen.queryByText("P1")).not.toBeInTheDocument();
  });

  it("shows an em dash when a row references a product missing from reference data", () => {
    render(
      <MortalityTab
        {...commonProps}
        data={mortalityPayload([mortalityRow({ productCode: "UNKNOWN" })])}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders only the first 500 rows and displays the truncation note", () => {
    const rows = Array.from({ length: 501 }, (_, index) =>
      mortalityRow({ nip: String(index).padStart(10, "0"), providerName: `Szpital ${index}` }),
    );

    render(<MortalityTab {...commonProps} data={mortalityPayload(rows)} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(501); // 1 header + 500 data rows
    expect(screen.getByText("Szpital 499")).toBeInTheDocument();
    expect(screen.queryByText("Szpital 500")).not.toBeInTheDocument();
    expect(screen.getByText("Podgląd pokazuje pierwsze 500 wierszy.")).toBeInTheDocument();
  });

  it("does not show the truncation note for exactly 500 rows", () => {
    const rows = Array.from({ length: 500 }, (_, index) =>
      mortalityRow({ nip: String(index).padStart(10, "0"), providerName: `Szpital ${index}` }),
    );

    render(<MortalityTab {...commonProps} data={mortalityPayload(rows)} />);

    expect(screen.queryByText("Podgląd pokazuje pierwsze 500 wierszy.")).not.toBeInTheDocument();
  });

  it("distinguishes no product selection from no matching rows", () => {
    const { rerender } = render(
      <MortalityTab {...commonProps} selectedProducts={[]} data={mortalityPayload([])} />,
    );
    expect(screen.getByText("Wybierz co najmniej jeden produkt.")).toBeInTheDocument();

    rerender(<MortalityTab {...commonProps} data={mortalityPayload([])} />);
    expect(screen.getByText("Brak świadczeniodawców spełniających wybrane kryteria.")).toBeInTheDocument();
  });

  it("renders an error without removing the data table", () => {
    render(
      <MortalityTab
        {...commonProps}
        error="Błąd danych"
        data={mortalityPayload([mortalityRow()])}
      />,
    );

    expect(screen.getByText("Błąd danych")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("AdmissionTab data table", () => {
  it("renders the expected columns and rounds all admission counts", () => {
    render(<AdmissionTab {...commonProps} data={admissionPayload([admissionRow()])} />);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual([
      "Świadczeniodawca",
      "NIP",
      "Kod JGP",
      "Województwo",
      "Miasto",
      "Planowane (6)",
      "Nagłe (2+3)",
      "Planowane + nagłe",
    ]);

    const cells = within(table).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual([
      "Szpital Testowy",
      "1234567890",
      "E10",
      "Mazowieckie",
      "Warszawa",
      (12_345).toLocaleString("pl-PL"),
      (2_346).toLocaleString("pl-PL"),
      (14_691).toLocaleString("pl-PL"),
    ]);
  });

  it("falls back to the internal product code when JGP metadata is missing", () => {
    render(
      <AdmissionTab
        {...commonProps}
        data={admissionPayload([admissionRow({ productCode: "UNKNOWN" })])}
      />,
    );

    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });

  it("renders only the first 500 rows and displays the truncation note", () => {
    const rows = Array.from({ length: 501 }, (_, index) =>
      admissionRow({ nip: String(index).padStart(10, "0"), providerName: `Szpital ${index}` }),
    );

    render(<AdmissionTab {...commonProps} data={admissionPayload(rows)} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(501); // 1 header + 500 data rows
    expect(screen.getByText("Szpital 499")).toBeInTheDocument();
    expect(screen.queryByText("Szpital 500")).not.toBeInTheDocument();
    expect(screen.getByText("Podgląd pokazuje pierwsze 500 wierszy.")).toBeInTheDocument();
  });

  it("does not show the truncation note for exactly 500 rows", () => {
    const rows = Array.from({ length: 500 }, (_, index) =>
      admissionRow({ nip: String(index).padStart(10, "0"), providerName: `Szpital ${index}` }),
    );

    render(<AdmissionTab {...commonProps} data={admissionPayload(rows)} />);

    expect(screen.queryByText("Podgląd pokazuje pierwsze 500 wierszy.")).not.toBeInTheDocument();
  });

  it("distinguishes no product selection from no matching rows", () => {
    const { rerender } = render(
      <AdmissionTab {...commonProps} selectedProducts={[]} data={admissionPayload([])} />,
    );
    expect(screen.getByText("Wybierz co najmniej jeden produkt.")).toBeInTheDocument();

    rerender(<AdmissionTab {...commonProps} data={admissionPayload([])} />);
    expect(screen.getByText("Brak świadczeniodawców spełniających wybrane kryteria.")).toBeInTheDocument();
  });

  it("renders an error without removing the data table", () => {
    render(
      <AdmissionTab
        {...commonProps}
        error="Błąd danych"
        data={admissionPayload([admissionRow()])}
      />,
    );

    expect(screen.getByText("Błąd danych")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
