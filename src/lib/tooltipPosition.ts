/**
 * Pozycja dymka HTML (DESIGN.md, 6.3): liczona z prostokąta obiektu (punkt, słupek, kafel), nie z kursora,
 * więc dymek nigdy nie zasłania obiektu, który opisuje. Jedna funkcja dla wszystkich dymków rozszerzonych.
 */

/** Prostokąt we współrzędnych okna (jak `getBoundingClientRect`). */
export interface Box { left: number; top: number; width: number; height: number }

/** Rodzaj obiektu: od niego zależy kolejność stron. */
export type AnchorKind = "point" | "bar" | "bar-horizontal" | "area";
export type Placement = "right" | "left" | "above" | "below";

export interface TooltipPlacement {
  /** Pozycja lewego górnego rogu dymka względem kontenera (`position: absolute`). */
  left: number;
  top: number;
  placement: Placement;
  /** Położenie strzałki wzdłuż krawędzi dymka (px od lewej albo od góry dymka). */
  arrow: number;
  /** `false`: dymek nie mieści się po żadnej stronie; stoi po stronie z największym miejscem. */
  fits: boolean;
}

/** Odstęp od obiektu: strefa ochronna za krawędzią znacznika. */
export const TOOLTIP_GAP = 12;
/** Margines od krawędzi okna. */
const VIEWPORT_PAD = 8;
/** Strzałka nie dochodzi do zaokrąglonego rogu dymka. */
const ARROW_INSET = 14;

const ORDER: Record<AnchorKind, Placement[]> = {
  // Punkt i linia: prawo, lewo, nad, pod.
  point: ["right", "left", "above", "below"],
  // Słupek pionowy: nad końcem, potem obok.
  bar: ["above", "right", "left", "below"],
  // Słupek poziomy: za końcem (prawo), potem lewo.
  "bar-horizontal": ["right", "left", "above", "below"],
  // Kafel mapy drzewa i obszar mapy: poza krawędzią.
  area: ["right", "left", "above", "below"],
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Wybiera stronę obiektu dla dymka: pierwszą z kolejności dla rodzaju obiektu, na której dymek się mieści;
 * gdy nie mieści się nigdzie — stronę z największym miejscem. Dymek nie wychodzi poza okno.
 */
export function placeTooltip({ anchor, tooltip, viewport, container = { left: 0, top: 0 }, kind = "point", gap = TOOLTIP_GAP }: {
  anchor: Box;
  tooltip: { width: number; height: number };
  viewport: Box;
  container?: { left: number; top: number };
  kind?: AnchorKind;
  gap?: number;
}): TooltipPlacement {
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  const room: Record<Placement, number> = {
    right: viewport.left + viewport.width - VIEWPORT_PAD - right - gap,
    left: anchor.left - viewport.left - VIEWPORT_PAD - gap,
    above: anchor.top - viewport.top - VIEWPORT_PAD - gap,
    below: viewport.top + viewport.height - VIEWPORT_PAD - bottom - gap,
  };
  const need = (side: Placement) => side === "left" || side === "right" ? tooltip.width : tooltip.height;
  const order = ORDER[kind];
  const fitting = order.find((side) => room[side] >= need(side));
  const placement = fitting ?? [...order].sort((a, b) => (room[b] - need(b)) - (room[a] - need(a)))[0];

  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const minX = viewport.left + VIEWPORT_PAD;
  const maxX = viewport.left + viewport.width - VIEWPORT_PAD - tooltip.width;
  const minY = viewport.top + VIEWPORT_PAD;
  const maxY = viewport.top + viewport.height - VIEWPORT_PAD - tooltip.height;

  let x: number;
  let y: number;
  if (placement === "right" || placement === "left") {
    x = placement === "right" ? right + gap : anchor.left - gap - tooltip.width;
    y = clamp(centerY - tooltip.height / 2, minY, Math.max(minY, maxY));
  } else {
    y = placement === "above" ? anchor.top - gap - tooltip.height : bottom + gap;
    x = clamp(centerX - tooltip.width / 2, minX, Math.max(minX, maxX));
  }
  // Gdy dymek nie mieści się nigdzie, zostaje w oknie (może wtedy dotknąć obiektu).
  if (!fitting) {
    x = clamp(x, minX, Math.max(minX, maxX));
    y = clamp(y, minY, Math.max(minY, maxY));
  }
  const vertical = placement === "right" || placement === "left";
  const arrow = vertical
    ? clamp(centerY - y, ARROW_INSET, Math.max(ARROW_INSET, tooltip.height - ARROW_INSET))
    : clamp(centerX - x, ARROW_INSET, Math.max(ARROW_INSET, tooltip.width - ARROW_INSET));
  return { left: x - container.left, top: y - container.top, placement, arrow, fits: Boolean(fitting) };
}

/** Prostokąt okna przeglądarki. */
export function viewportBox(): Box {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** Prostokąt elementu DOM jako `Box`. */
export function elementBox(element: Element): Box {
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Prostokąt 1 × 1 px w miejscu kursora: zapas, gdy nie da się znaleźć obiektu. */
export function pointerBox(clientX: number, clientY: number): Box {
  return { left: clientX, top: clientY, width: 1, height: 1 };
}

/**
 * Prostokąt obiektu wykresu Plotly (SVG): punktu serii `scatter`, słupka serii `bar` albo kafla mapy drzewa
 * (z elementu pod kursorem). `null`, gdy element nie istnieje.
 */
export function plotlyObjectBox(plot: HTMLElement, type: "scatter" | "bar" | "treemap", curveNumber: number, pointIndex: number, target?: EventTarget | null): Box | null {
  if (type === "treemap") {
    const element = target instanceof Element ? target.closest("g.slice") : null;
    return element ? elementBox(element) : null;
  }
  const layer = type === "scatter" ? ".scatterlayer" : ".barlayer";
  const trace = plot.querySelectorAll(`${layer} > .trace`).item(curveNumber);
  const node = trace?.querySelectorAll(type === "scatter" ? "path.point" : ".point").item(pointIndex);
  return node ? elementBox(node) : null;
}
