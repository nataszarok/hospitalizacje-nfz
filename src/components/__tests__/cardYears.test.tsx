/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CardYears } from "@/components/jgp/CardYears";

afterEach(cleanup);

describe("CardYears — przełącznik roku karty „‹ 2025 ▾ ›”", () => {
  it("lista lat z wybranym rokiem; wybór z listy wybiera rok", () => {
    const onSelect = vi.fn();
    render(<CardYears years={["2023", "2024", "2025"]} selected="2025" onSelect={onSelect} />);
    const select = within(screen.getByRole("group", { name: "Rok karty" })).getByRole("combobox", { name: "Rok" });
    expect(select).toHaveValue("2025");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["2023", "2024", "2025"]);
    fireEvent.change(select, { target: { value: "2023" } });
    expect(onSelect).toHaveBeenCalledWith("2023");
  });

  it("strzałki: poprzedni i następny rok; na krańcach wyłączone", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<CardYears years={["2023", "2024", "2025"]} selected="2024" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Poprzedni rok: 2023" }));
    fireEvent.click(screen.getByRole("button", { name: "Następny rok: 2025" }));
    expect(onSelect.mock.calls).toEqual([["2023"], ["2025"]]);
    rerender(<CardYears years={["2023", "2024", "2025"]} selected="2025" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Następny rok" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Poprzedni rok: 2024" })).toBeEnabled();
  });

  // Zakładki kurczą się i przewijają poziomo (zamiast poszerzać stronę); przełącznik roku ma stałą szerokość.
  it("CSS: zakładki przewijają się poza regułą @media, rok się nie kurczy", () => {
    const css = readFileSync(join(process.cwd(), "src/components/jgp/JgpTabs.module.css"), "utf8");
    const outside = css.slice(0, css.indexOf("@media"));
    const rule = (selector: string) => outside.slice(outside.indexOf(selector), outside.indexOf("}", outside.indexOf(selector)));
    expect(rule(".tabs {")).toContain("min-width:");
    expect(rule(".tabs {")).toContain("overflow-x: auto");
    expect(rule(".years {")).toContain("flex: none");
  });
});
