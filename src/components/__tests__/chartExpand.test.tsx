/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChartExpand } from "@/components/portal/ChartExpand";

afterEach(cleanup);

const renderExpand = (explorer?: { href: string; label: string }) => render(<ChartExpand title="E53G: śmiertelność" explorer={explorer}>
  {(expanded) => <div data-testid={expanded ? "duzy" : "maly"}>wykres</div>}
</ChartExpand>);

describe("ChartExpand — powiększenie wykresu", () => {
  it("przycisk otwiera okno z tym samym wykresem w wersji powiększonej i linkiem do eksploratora", () => {
    renderExpand({ href: "/analizy?t=k&jgp=E53G", label: "Kto leczy" });
    expect(screen.getByTestId("maly")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Powiększ wykres: E53G: śmiertelność" }));
    const dialog = screen.getByRole("dialog", { name: "E53G: śmiertelność" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("duzy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kto leczy w eksploratorze/ })).toHaveAttribute("href", "/analizy?t=k&jgp=E53G");
    expect(screen.getByRole("button", { name: "Zamknij powiększenie" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("Esc, przycisk „Zamknij” i kliknięcie tła zamykają okno; fokus wraca na przycisk", () => {
    renderExpand();
    const opener = screen.getByRole("button", { name: /Powiększ wykres/ });
    fireEvent.click(opener);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Zamknij powiększenie" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(opener);
    // Kliknięcie w okno nie zamyka, kliknięcie tła — tak.
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
