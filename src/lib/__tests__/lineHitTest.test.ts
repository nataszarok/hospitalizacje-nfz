import { describe, expect, it } from "vitest";
import { nearestLine, type PixelSeries } from "@/lib/lineHitTest";

const series = (points: [number, number][], line = points): PixelSeries => ({
  points: points.map(([x, y]) => ({ x, y })),
  line: line.map(([x, y]) => ({ x, y })),
});

describe("nearestLine — trafienie w linię wykresu", () => {
  it("nakładające się kropki: wygrywa najbliższa, nie pierwsza seria", () => {
    const first = series([[0, 100], [10, 100]]);
    const second = series([[0, 104], [10, 104]]);
    expect(nearestLine([first, second], { x: 10, y: 103 }, 12)).toMatchObject({ series: 1, index: 1 });
  });

  it("odcinek linii między kropkami też jest trafieniem; indeks = bliższy koniec odcinka", () => {
    const line = series([[0, 0], [100, 0]]);
    expect(nearestLine([line], { x: 70, y: 5 }, 12)).toMatchObject({ series: 0, index: 1, distance: 5 });
    expect(nearestLine([line], { x: 30, y: 5 }, 12)).toMatchObject({ index: 0 });
  });

  it("poza promieniem i przy przerwie (null) nic nie trafia", () => {
    const gap: PixelSeries = { points: [{ x: 0, y: 0 }, null, { x: 100, y: 0 }], line: [{ x: 0, y: 0 }, null, { x: 100, y: 0 }] };
    expect(nearestLine([gap], { x: 50, y: 0 }, 12)).toBeNull();
    expect(nearestLine([gap], { x: 0, y: 20 }, 12)).toBeNull();
  });

  it("remis (nakładające się linie): zostaje seria wskazana poprzednio", () => {
    const a = series([[0, 100], [10, 100]]);
    const b = series([[0, 100], [10, 100]]);
    expect(nearestLine([a, b], { x: 10, y: 100 }, 12)).toMatchObject({ series: 0 });
    expect(nearestLine([a, b], { x: 10, y: 100 }, 12, 1)).toMatchObject({ series: 1 });
    // Wyraźnie bliższa inna linia wygrywa mimo przewagi.
    const c = series([[0, 90], [10, 90]]);
    expect(nearestLine([a, c], { x: 10, y: 91 }, 12, 0)).toMatchObject({ series: 1 });
  });
});
