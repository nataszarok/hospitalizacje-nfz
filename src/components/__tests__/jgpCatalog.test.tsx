/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JgpCatalogPage } from "@/components/jgp/JgpCatalogPage";
import { buildJgpCatalog } from "@/lib/jgpCatalog";
import { trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

afterEach(cleanup);

const catalog = buildJgpCatalog(trendsFixture);
const codes = () => within(screen.getByRole("region", { name: "Grupy JGP" })).getAllByRole("row").slice(1)
  .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("Katalog grup JGP", () => {
  it("pokazuje grupy z najnowszego roku z linkami do kart; wycofane po zaznaczeniu", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Grupy JGP");
    expect(codes()).toEqual(["A01", "F99"]);
    expect(screen.getByRole("link", { name: "A01" })).toHaveAttribute("href", "/jgp/A01");
    fireEvent.click(screen.getByRole("checkbox", { name: /pokaż grupy wycofane \(1\)/ }));
    expect(codes()).toEqual(["A01", "F99", "F04"]);
    expect(screen.getByText("wycofana")).toBeInTheDocument();
  });

  it("filtruje po kodzie i nazwie bez polskich znaków", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "staly" } });
    expect(codes()).toEqual(["A01"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "f9" } });
    expect(codes()).toEqual(["F99"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
    expect(screen.getByText("Brak grup dla tych filtrów.")).toBeInTheDocument();
  });

  it("sortuje po kliknięciu nagłówka i filtruje minimalną liczbą hospitalizacji", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: "Kod" }));
    expect(codes()).toEqual(["A01", "F99"]);
    fireEvent.click(screen.getByRole("button", { name: /Kod/ }));
    expect(codes()).toEqual(["F99", "A01"]);
    fireEvent.change(screen.getByRole("combobox", { name: /Hospitalizacje 2025 od/ }), { target: { value: "100" } });
    expect(screen.getByText("Brak grup dla tych filtrów.")).toBeInTheDocument();
  });

  it("pokazuje zakładkę Rodziny jako planowaną", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("tab", { name: /Rodziny/ })).toHaveAttribute("aria-disabled", "true");
  });
});
