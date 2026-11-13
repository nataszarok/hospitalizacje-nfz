/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render as baseRender, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { ConcentrationChart, plural } from "@/components/ConcentrationChart";

window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
const render = (node: ReactNode) => baseRender(<MantineProvider>{node}</MantineProvider>);
afterEach(cleanup);

const items = Array.from({ length: 30 }, (_, i) => ({ key: `K${i + 1}`, label: `Grupa ${i + 1}`, value: 30 - i }));
const format = (value: number) => `${value} zł`;

describe("ConcentrationChart", () => {
  it("odpowiada zdaniem: N największych daje X% sumy; progi 50% i 80% na wykresie", () => {
    render(<ConcentrationChart items={items} measure="kwoty" format={format} words={["kod", "kody", "kodów"]} defaultCount={3} ariaLabel="wykres" />);
    // 30 + 29 + 28 = 87 z 465.
    expect(document.querySelector("p")).toHaveTextContent("3 największe kody z 30 dają 19% kwoty (87 zł z 465 zł).");
    expect(screen.getByRole("img", { name: "wykres" })).toHaveTextContent("50% → 9 kodów");
  });

  it("lista pozycji ma najwyżej 3 linie, resztę liczy plakietka „+X”", () => {
    // Pięć pozycji w linii: offsetTop z indeksu w liście (jsdom nie liczy układu).
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
    Object.defineProperty(HTMLElement.prototype, "offsetTop", { configurable: true, get(this: HTMLElement) { return Math.floor([...(this.parentElement?.children ?? [])].indexOf(this) / 5) * 30; } });
    try {
      render(<ConcentrationChart items={items} measure="kwoty" format={format} words={["kod", "kody", "kodów"]} defaultCount={20} ariaLabel="wykres" />);
      const list = screen.getByRole("list", { name: "20 największych kodów" });
      // 15 miejsc w 3 liniach: 14 pozycji i plakietka „+6”.
      expect(list.children).toHaveLength(15);
      expect(list.lastElementChild).toHaveTextContent("+6");
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "offsetTop", original);
    }
  });

  it("odmienia nazwę po liczbie", () => {
    expect([1, 2, 5, 12, 22, 25].map((n) => plural(n, ["kod", "kody", "kodów"]))).toEqual(["kod", "kody", "kodów", "kodów", "kody", "kodów"]);
  });
});
