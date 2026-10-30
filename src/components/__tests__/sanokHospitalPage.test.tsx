/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SanokHospitalView } from "@/components/sanok/SanokHospitalPage";
import { sanokHospitalDataset } from "@/lib/__tests__/fixtures/sanokHospitalDataset";

vi.mock("@/components/sanok/SanokYearChart", () => ({
  SanokYearChart: ({ points, metric }: { points: { patients: number; value: number }[]; metric: string }) => (
    <div data-testid={`chart-${metric}`}>{points.map((point) => (metric === "value" ? point.value : point.patients)).join("/")}</div>
  ),
}));

vi.mock("@/components/sanok/SanokHospitalCharts", () => ({
  ABOVE_COLOR: "#000",
  BELOW_COLOR: "#111",
  WARD_COLORS: ["#000"],
  WardValueLineChart: ({ names }: { names: string[] }) => <div data-testid="lines">{names.join("|")}</div>,
  IncomeLineChart: ({ points }: { points: { year: number }[] }) => <div data-testid="income">{points.map((point) => point.year).join("|")}</div>,
  AgreementCompositionChart: ({ items }: { items: { group: string }[] }) => (
    <div data-testid="composition">{items.map((item) => item.group).join("|")}</div>
  ),
  WardPerHospChart: () => <div data-testid="per-hosp" />,
  WardPerHospTrend: () => <div data-testid="trend" />,
  CodesChart: ({ rows, onPick }: { rows: { code: string }[]; onPick: (code: string) => void }) => (
    <div data-testid="codes-chart">
      {rows.map((row) => <button key={row.code} type="button" onClick={() => onPick(row.code)}>pick {row.code}</button>)}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const codeTable = () => screen.getAllByRole("table")[1];
const codesOf = (table: HTMLElement) =>
  (within(table).getAllByRole("row").slice(1) as HTMLTableRowElement[]).map((row) => row.cells[0].textContent);
const chartCodes = () => within(screen.getByTestId("codes-chart")).getAllByRole("button").map((button) => button.textContent);

describe("SanokHospitalView", () => {
  it("pokazuje wynik szpitala i oddziały nisko i wysoko wyceniane", () => {
    render(<SanokHospitalView dataset={sanokHospitalDataset} />);

    expect(screen.getByRole("heading", { name: "Wynik całego szpitala w 2025" })).toBeInTheDocument();
    expect(screen.getByText("−2,5 mln zł")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wartość świadczeń oddziałów, 2023–2025" })).toBeInTheDocument();
    expect(screen.getByTestId("lines")).toHaveTextContent("Choroby wewnętrzne|Kardiologia|Ortopedia i traumatologia");

    const low = screen.getByRole("heading", { name: "Nisko wyceniona praca" }).parentElement!;
    const high = screen.getByRole("heading", { name: "Wysoko wyceniona praca" }).parentElement!;
    expect(low).toHaveTextContent("Choroby wewnętrzne");
    expect(high).toHaveTextContent("Ortopedia i traumatologia");
  });

  it("pokazuje źródła przychodu z umów NFZ", () => {
    render(<SanokHospitalView dataset={sanokHospitalDataset} />);

    expect(screen.getByRole("heading", { name: "Skąd przychód szpitala" })).toBeInTheDocument();
    expect(screen.getByTestId("income")).toHaveTextContent("2023|2024|2025");
    expect(screen.getByRole("heading", { name: "Umowy z NFZ w 2025 wg rodzaju" })).toBeInTheDocument();
    expect(screen.getByTestId("composition")).toHaveTextContent(
      "Hospitalizacje JGP – ryczałt sieci szpitali|Hospitalizacje JGP poza ryczałtem|SOR",
    );
  });

  it("domyślnie pokazuje najniżej wycenione kody, a przełącznik zmienia listę", () => {
    render(<SanokHospitalView dataset={sanokHospitalDataset} />);
    expect(chartCodes()).toEqual(["pick E53G"]);

    fireEvent.click(screen.getByRole("button", { name: "Największa wartość" }));
    expect(chartCodes()).toEqual(["pick H52", "pick E53G", "pick D18"]);
  });

  it("kliknięcie oddziału filtruje kody i wykres", () => {
    render(<SanokHospitalView dataset={sanokHospitalDataset} />);
    fireEvent.click(screen.getByRole("button", { name: /^Choroby wewnętrzne/ }));

    expect(screen.getByLabelText("Oddział")).toHaveValue("0");
    expect(codesOf(codeTable())).toEqual(["D18", "E53G"]);
    expect(screen.getByTestId("chart-patients")).toHaveTextContent("0/10/30");
  });

  it("kliknięcie kodu pokazuje jego serię roczną bez roku niepełnego", () => {
    render(<SanokHospitalView dataset={sanokHospitalDataset} />);
    fireEvent.click(screen.getByRole("button", { name: "Największa wartość" }));
    fireEvent.click(screen.getByRole("button", { name: "pick H52" }));

    expect(screen.getByRole("heading", { level: 3, name: /H52 – Zabiegi na kręgosłupie/ })).toBeInTheDocument();
    expect(screen.getByTestId("chart-value")).toHaveTextContent("0/0/1300000");
  });

  it("tabela kodów sortuje i szuka", () => {
    render(<SanokHospitalView dataset={sanokHospitalDataset} />);
    fireEvent.click(within(codeTable()).getByRole("button", { name: /^Kod/ }));
    expect(codesOf(codeTable())).toEqual(["D18", "E53G", "H52"]);

    fireEvent.change(screen.getByLabelText("Szukaj kodu lub nazwy"), { target: { value: "kręgosłup" } });
    expect(codesOf(codeTable())).toEqual(["H52"]);
  });
});
