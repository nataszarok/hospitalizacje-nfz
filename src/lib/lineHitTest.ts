/**
 * Trafienie w linię wykresu „w czasie” (wiele ośrodków na jednym wykresie).
 * Plotly przy `hovermode: "closest"` traktuje wszystkie kropki w promieniu znacznika jak równo bliskie i wybiera
 * pierwszą serię. Kropki ośrodków w tym samym miesiącu się nakładają, więc krótka albo gęsta linia przegrywała
 * z liniami narysowanymi wcześniej, a odcinek między kropkami nie reagował wcale. Tu liczymy prawdziwą odległość
 * w pikselach: do kropek i do odcinków linii średniej.
 */

export interface PixelPoint { x: number; y: number }

/** Jedna seria w pikselach: kropki (wartości) i wierzchołki linii (np. średnia 3M); `null` = brak punktu. */
export interface PixelSeries { points: (PixelPoint | null)[]; line: (PixelPoint | null)[] }

export interface LineHit {
  /** Indeks serii na liście. */
  series: number;
  /** Indeks punktu (miesiąc albo rok) najbliżej kursora. */
  index: number;
  /** Odległość kursora od serii w pikselach. */
  distance: number;
}

const distanceToSegment = (p: PixelPoint, a: PixelPoint, b: PixelPoint) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return { distance: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t };
};

/** Przewaga (px) serii już wskazanej: przy nakładających się liniach kursor zostaje na linii, po której idzie. */
export const STICKY_DISTANCE = 3;

/**
 * Najbliższa seria w promieniu `maxDistance` px od kursora albo `null`.
 * `current`: seria wskazana poprzednio; przy remisie (np. te same wartości kilku ośrodków) wygrywa ona.
 */
export function nearestLine(series: PixelSeries[], cursor: PixelPoint, maxDistance: number, current: number | null = null): LineHit | null {
  let best: LineHit | null = null;
  let bestScore = Infinity;
  const consider = (hit: LineHit) => {
    if (hit.distance > maxDistance) return;
    const score = hit.series === current ? hit.distance - STICKY_DISTANCE : hit.distance;
    if (score < bestScore) { best = hit; bestScore = score; }
  };
  series.forEach((item, s) => {
    item.points.forEach((point, i) => {
      if (point) consider({ series: s, index: i, distance: Math.hypot(point.x - cursor.x, point.y - cursor.y) });
    });
    for (let i = 0; i < item.line.length - 1; i += 1) {
      const a = item.line[i];
      const b = item.line[i + 1];
      if (!a || !b) continue;
      const { distance, t } = distanceToSegment(cursor, a, b);
      consider({ series: s, index: t < 0.5 ? i : i + 1, distance });
    }
  });
  return best;
}
