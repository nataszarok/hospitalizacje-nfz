/**
 * Koncentracja: wartości od największej i ich skumulowany udział (%). Odpowiada na pytanie
 * „ile największych pozycji daje X% sumy” (np. kody JGP i kwota NFZ).
 */
export function concentration(values: number[]): { sorted: number[]; cumulativePct: number[]; total: number } {
  const sorted = values.filter((value) => value > 0).sort((a, b) => b - a);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  let running = 0;
  const cumulativePct = sorted.map((value) => { running += value; return total ? (running / total) * 100 : 0; });
  return { sorted, cumulativePct, total };
}

/** Najmniejsza liczba pozycji, które dają co najmniej `pct`% sumy (0, gdy brak wartości). */
export const itemsForShare = (cumulativePct: number[], pct: number) => {
  const index = cumulativePct.findIndex((value) => value >= pct - 1e-9);
  return index < 0 ? cumulativePct.length : index + 1;
};
