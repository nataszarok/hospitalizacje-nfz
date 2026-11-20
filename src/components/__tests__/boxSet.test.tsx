/** @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoxSet } from "@/components/BoxSet";

const items = [1, 2, 3, 4].map((i) => ({ key: String(i), label: `Boks ${i}`, value: <b>{i}</b>, what: "opis", sub: ["szczegół"] }));

// jsdom nie liczy układu: szerokość kontenera ustawiamy wprost; bez ResizeObserver hook mierzy w następnej klatce.
const renderAt = async (width: number) => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  render(<BoxSet label="Zestaw" items={items} />);
  await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
  return document.querySelector<HTMLElement>("dl[aria-label=Zestaw]")!;
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("BoxSet (DESIGN.md 7.1a)", () => {
  it("jedna linia, gdy każdy boks ma co najmniej 150 px (4 × 150 + 3 × 10 = 630 px)", async () => {
    const list = await renderAt(630);
    expect(list.dataset.compact).toBeUndefined();
    expect(list.style.getPropertyValue("--boxes")).toBe("4");
    expect(list.textContent).toContain("Boks 4");
  });

  it("zwarta lista, gdy boks byłby węższy", async () => {
    const list = await renderAt(629);
    expect(list.dataset.compact).toBe("true");
  });
});
