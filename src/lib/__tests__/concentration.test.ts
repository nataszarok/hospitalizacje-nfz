import { describe, expect, it } from "vitest";
import { concentration, itemsForShare } from "@/lib/concentration";

describe("concentration — ile największych pozycji daje X% sumy", () => {
  it("sortuje od największej, pomija zera i liczy skumulowany udział", () => {
    const { sorted, cumulativePct, total } = concentration([10, 0, 50, 40]);
    expect(sorted).toEqual([50, 40, 10]);
    expect(total).toBe(100);
    expect(cumulativePct).toEqual([50, 90, 100]);
  });

  it("najmniejsza liczba pozycji dla progu (próg równy udziałowi też się liczy)", () => {
    const { cumulativePct } = concentration([50, 40, 10]);
    expect(itemsForShare(cumulativePct, 50)).toBe(1);
    expect(itemsForShare(cumulativePct, 80)).toBe(2);
    expect(itemsForShare(cumulativePct, 100)).toBe(3);
    expect(itemsForShare([], 50)).toBe(0);
  });
});
