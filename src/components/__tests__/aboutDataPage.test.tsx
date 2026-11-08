/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AboutDataPage } from "@/components/about/AboutDataPage";

afterEach(cleanup);

describe("AboutDataPage", () => {
  it("podaje zakres lat z danych i linkuje źródło oraz moduły", () => {
    render(<AboutDataPage yearFrom="2024" yearTo="2025" />);
    expect(screen.getByRole("heading", { level: 1, name: "O danych" })).toBeInTheDocument();
    expect(screen.getByText(/lata 2024–2025/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /zbiór danych o hospitalizacjach/ })).toHaveAttribute("href", expect.stringContaining("dane.gov.pl"));
    expect(screen.getByRole("link", { name: "Przejdź do analiz →" })).toHaveAttribute("href", "/analizy");
    expect(screen.getByRole("link", { name: "Profile szpitali →" })).toHaveAttribute("href", "/szpitale");
  });

  it("dla jednego roku pokazuje sam rok", () => {
    render(<AboutDataPage yearFrom="2025" yearTo="2025" />);
    expect(screen.getByText(/lata 2025\./)).toBeInTheDocument();
  });
});
