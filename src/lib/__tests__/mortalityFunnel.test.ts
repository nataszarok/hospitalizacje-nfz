import { describe, expect, it } from "vitest";
import { DEVIATION_COLORS } from "@/lib/chartPalette";
import { FUNNEL_LEGEND, funnelLines, funnelPointColor, hasEnoughDeathsForFunnel, mortalityChartHelp } from "@/lib/mortalityFunnel";

describe("mortalityChartHelp — krótki standard objaśnienia wykresu śmiertelności", () => {
  it("z lejkiem: punkt, średnia, lejek; kliknięcie tylko gdy wybiera ośrodek", () => {
    const lines = mortalityChartHelp({ state: "funnel", showsMean: true, selectable: true });
    expect(lines).toEqual([
      "Punkt to ośrodek: liczba hospitalizacji i śmiertelność (zgony w szpitalu / hospitalizacje).",
      "Linia kropkowana: średnia wszystkich ośrodków.",
      expect.stringMatching(/^Granice odchyleń: 95% \(kropki\) i 99,8% \(kreski\) wokół średniej/),
      "Kliknięcie punktu wybiera ośrodek.",
    ]);
    expect(mortalityChartHelp({ state: "funnel", showsMean: true })).toHaveLength(3);
  });

  it("tylko to, co jest na wykresie: bez zdań o braku średniej, lejka i o szacowaniu <5", () => {
    const text = mortalityChartHelp({ state: "few-deaths", showsMean: false }).join(" ");
    expect(text).not.toMatch(/Bez linii średniej|Bez lejka|<5/);
    expect(mortalityChartHelp({ state: "off", showsMean: true }).join(" ")).not.toMatch(/lejek|granice/i);
    expect(mortalityChartHelp({ state: "unavailable", showsMean: true })[2]).toMatch(/^Granice odchyleń działają dla/);
  });

  it("z lejkiem całość ma najwyżej ok. 60 słów", () => {
    const text = mortalityChartHelp({ state: "funnel", showsMean: true, aboveCap: { count: 3, cap: 50 }, selectable: true }).join(" ");
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(65);
    expect(text).toMatch(/▲: 3 ośrodki poniżej 10 hospitalizacji ze śmiertelnością ponad 50%/);
  });
});

describe("lejek — kolory, legenda, linie", () => {
  it("kolor punktu według statusu na lejku", () => {
    expect(funnelPointColor(11.5, 11.5, 1000)).toBe(DEVIATION_COLORS.within);
    expect(funnelPointColor(30, 11.5, 1000)).toBe(DEVIATION_COLORS.up998);
    expect(funnelPointColor(0, 11.5, 1000)).toBe(DEVIATION_COLORS.down998);
  });

  it("legenda ma pięć stopni; lejek od 30 zgonów; cztery linie granic", () => {
    expect(FUNNEL_LEGEND).toHaveLength(5);
    expect(hasEnoughDeathsForFunnel(29)).toBe(false);
    expect(hasEnoughDeathsForFunnel(30)).toBe(true);
    expect(funnelLines(11.5, 1000).map((line) => line.dash)).toEqual(["dot", "dot", "dash", "dash"]);
  });
});
