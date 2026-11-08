/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { placeTooltip, plotlyObjectBox, TOOLTIP_GAP, type Box } from "@/lib/tooltipPosition";

const viewport: Box = { left: 0, top: 0, width: 1200, height: 800 };
const tooltip = { width: 300, height: 200 };

/** Czy dymek nachodzi na obiekt. */
function overlaps(anchor: Box, place: { left: number; top: number }) {
  return place.left < anchor.left + anchor.width && place.left + tooltip.width > anchor.left
    && place.top < anchor.top + anchor.height && place.top + tooltip.height > anchor.top;
}

describe("placeTooltip — dymek obok obiektu", () => {
  it("punkt: domyślnie po prawej, za strefą ochronną, wyśrodkowany na punkcie", () => {
    const anchor = { left: 400, top: 390, width: 10, height: 10 };
    const place = placeTooltip({ anchor, tooltip, viewport });
    expect(place.placement).toBe("right");
    expect(place.left).toBe(410 + TOOLTIP_GAP);
    expect(place.top).toBe(395 - 100);
    expect(place.arrow).toBe(100);
    expect(place.fits).toBe(true);
    expect(overlaps(anchor, place)).toBe(false);
  });

  it("punkt przy prawej krawędzi: dymek po lewej", () => {
    const anchor = { left: 1000, top: 390, width: 10, height: 10 };
    const place = placeTooltip({ anchor, tooltip, viewport });
    expect(place.placement).toBe("left");
    expect(place.left).toBe(1000 - TOOLTIP_GAP - 300);
    expect(overlaps(anchor, place)).toBe(false);
  });

  it("słupek pionowy: nad końcem słupka, wyśrodkowany", () => {
    const anchor = { left: 500, top: 400, width: 40, height: 300 };
    const place = placeTooltip({ anchor, tooltip, viewport, kind: "bar" });
    expect(place.placement).toBe("above");
    expect(place.top).toBe(400 - TOOLTIP_GAP - 200);
    expect(place.left).toBe(520 - 150);
    expect(overlaps(anchor, place)).toBe(false);
  });

  it("słupek pionowy bez miejsca nad nim: obok", () => {
    const anchor = { left: 500, top: 100, width: 40, height: 600 };
    const place = placeTooltip({ anchor, tooltip, viewport, kind: "bar" });
    expect(place.placement).toBe("right");
    expect(overlaps(anchor, place)).toBe(false);
  });

  it("kafel szeroki prawie jak okno: dymek nad albo pod kaflem, nie na nim", () => {
    const anchor = { left: 20, top: 300, width: 1150, height: 150 };
    const place = placeTooltip({ anchor, tooltip, viewport, kind: "area" });
    expect(["above", "below"]).toContain(place.placement);
    expect(overlaps(anchor, place)).toBe(false);
  });

  it("dymek nie wychodzi poza okno (punkt przy górnej krawędzi)", () => {
    const anchor = { left: 400, top: 2, width: 10, height: 10 };
    const place = placeTooltip({ anchor, tooltip, viewport });
    expect(place.top).toBeGreaterThanOrEqual(8);
    expect(place.arrow).toBeLessThan(100);
    expect(place.arrow).toBeGreaterThanOrEqual(14);
  });

  it("pozycja jest względem kontenera", () => {
    const anchor = { left: 400, top: 390, width: 10, height: 10 };
    const place = placeTooltip({ anchor, tooltip, viewport, container: { left: 100, top: 50 } });
    expect(place.left).toBe(410 + TOOLTIP_GAP - 100);
    expect(place.top).toBe(295 - 50);
  });

  it("brak miejsca wszędzie: strona z największym miejscem, w oknie", () => {
    const small: Box = { left: 0, top: 0, width: 320, height: 220 };
    const place = placeTooltip({ anchor: { left: 150, top: 100, width: 10, height: 10 }, tooltip, viewport: small });
    expect(place.fits).toBe(false);
    expect(place.left).toBeGreaterThanOrEqual(8);
    expect(place.top).toBeGreaterThanOrEqual(8);
  });
});

describe("plotlyObjectBox — prostokąt obiektu wykresu", () => {
  function plot(html: string) {
    const element = document.createElement("div");
    element.innerHTML = html;
    return element;
  }

  it("znajduje punkt serii po numerze serii i punktu", () => {
    const element = plot(`<svg><g class="scatterlayer"><g class="trace"><path class="point"></path></g><g class="trace"><path class="point"></path><path class="point" id="hit"></path></g></g></svg>`);
    const hit = element.querySelector("#hit")!;
    hit.getBoundingClientRect = () => ({ left: 5, top: 6, width: 7, height: 8 }) as DOMRect;
    expect(plotlyObjectBox(element, "scatter", 1, 1)).toEqual({ left: 5, top: 6, width: 7, height: 8 });
    expect(plotlyObjectBox(element, "scatter", 3, 0)).toBeNull();
  });

  it("słupek serii bar i kafel mapy drzewa z elementu pod kursorem", () => {
    const element = plot(`<svg><g class="barlayer"><g class="trace"><g class="point" id="bar"></g></g></g><g class="slice" id="slice"><text id="label"></text></g></svg>`);
    element.querySelector("#bar")!.getBoundingClientRect = () => ({ left: 1, top: 2, width: 3, height: 4 }) as DOMRect;
    element.querySelector("#slice")!.getBoundingClientRect = () => ({ left: 10, top: 20, width: 30, height: 40 }) as DOMRect;
    expect(plotlyObjectBox(element, "bar", 0, 0)).toEqual({ left: 1, top: 2, width: 3, height: 4 });
    expect(plotlyObjectBox(element, "treemap", 0, 0, element.querySelector("#label"))).toEqual({ left: 10, top: 20, width: 30, height: 40 });
  });
});
