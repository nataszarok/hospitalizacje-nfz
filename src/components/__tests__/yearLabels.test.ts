import { describe, expect, it } from "vitest";
import { showYearLabel } from "@/components/hospitals/YearIndexChart";

const shown = (count: number, selected: number, step: number) => Array.from({ length: count }, (_, y) => y).filter((y) => showYearLabel(y, count, selected, step));

describe("podpisy lat na wąskim wykresie (Finanse, telefon)", () => {
  it("szeroki krok: wszystkie lata", () => {
    expect(shown(9, 8, 60)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("wąski krok: co 2. rok od ostatniego; wybrany rok zawsze, bez sąsiada", () => {
    expect(shown(9, 8, 25)).toEqual([0, 2, 4, 6, 8]);
    expect(shown(9, 5, 25)).toEqual([0, 2, 5, 8]);
  });
});
