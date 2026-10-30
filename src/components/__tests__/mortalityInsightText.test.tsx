/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MortalityInsightText } from "@/components/MortalityTab";

afterEach(cleanup);

const base = { providers: 25, hospitalizations: 8326, deaths: 412, mortalityPct: 4.948, topCount: 10, topSharePct: 41.2, medianHospitalizations: 48, smallMortalityPct: 6.1, largeMortalityPct: 4.7 };

describe("MortalityInsightText", () => {
  it("opisuje średnią śmiertelność, koncentrację i różnicę między małymi a dużymi ośrodkami", () => {
    render(<MortalityInsightText insights={base} />);
    const box = screen.getByLabelText("Interpretacja wykresu");
    expect(box).toHaveTextContent(/Średnia śmiertelność: 4,9% \(412 zgonów na 8\s?326 hospitalizacji u 25 świadczeniodawców\)\./);
    expect(box).toHaveTextContent("10 największych ośrodków ma 41,2% hospitalizacji.");
    expect(box).toHaveTextContent("Mediana: 48 hospitalizacji na świadczeniodawcę.");
    expect(box).toHaveTextContent("poniżej mediany: 6,1%; od mediany w górę: 4,7%.");
    expect(box).toHaveTextContent("to nie jest ocena jakości leczenia");
  });

  it("pomija koncentrację i podział, gdy świadczeniodawców jest mało", () => {
    render(<MortalityInsightText insights={{ ...base, providers: 1, topCount: 1, topSharePct: 100, smallMortalityPct: null, largeMortalityPct: null }} />);
    const box = screen.getByLabelText("Interpretacja wykresu");
    expect(box).not.toHaveTextContent("największych ośrodków");
    expect(box).not.toHaveTextContent("Mediana");
  });
});
