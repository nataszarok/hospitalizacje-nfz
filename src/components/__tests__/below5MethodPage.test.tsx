/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Below5MethodPage } from "@/components/about/Below5MethodPage";
import type { CalibrationSummary } from "@/lib/calibration";

afterEach(cleanup);

const summary: CalibrationSummary = {
  year: "2024", method: "cal-v4", cells: 205926, groups: 695, groupsA: 385, groupsB: 310, groupsWithoutApi: 1,
  staysMin: 5870000, staysCal: 7040202, staysApi: 7040202, deathsMin: 141897, deathsCal: 151725, deathsApi: 151722,
  groupsStaysEqualApi: 695, groupsDeathsEqualApi: 692, cellsBelowPatients: 255, groupsBelowPatients: 8,
};

describe("Below5MethodPage", () => {
  it("pokazuje lata z kalibracją, liczby z pliku i link powrotny", () => {
    render(<Below5MethodPage summaries={[summary]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Jak szacujemy wartości „<5”" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stan metody" })).toHaveTextContent("policzona dla roku: 2024");
    expect(screen.getByRole("heading", { name: "8. Wynik i kontrola (2024)" })).toBeInTheDocument();
    expect(screen.getByText("695 z 695")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Metoda A: r < 1,05 \(385 grup\)/ })).toBeInTheDocument();
    expect(screen.getByText(/dotyczy to 8 grup i razem 255 komórek/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← O danych" })).toHaveAttribute("href", "/o-danych");
  });

  it("dla kilku lat wymienia lata i pokazuje wynik najnowszego", () => {
    render(<Below5MethodPage summaries={[{ ...summary, year: "2023" }, summary]} />);
    expect(screen.getByRole("region", { name: "Stan metody" })).toHaveTextContent("policzona dla lat: 2023, 2024");
    expect(screen.getByRole("heading", { name: "8. Wynik i kontrola (2024)" })).toBeInTheDocument();
  });

  it("bez kalibracji opisuje metodę bez liczb wyniku", () => {
    render(<Below5MethodPage summaries={[]} />);
    expect(screen.getByRole("region", { name: "Stan metody" })).toHaveTextContent("nie jest jeszcze policzona");
    expect(screen.queryByRole("heading", { name: /Wynik i kontrola/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "8. Jak sprawdziliśmy metodę" })).toBeInTheDocument();
  });
});
