import { CHART_COLORS, DEVIATION_COLORS } from "@/lib/chartPalette";
import { funnelCurves, funnelStatus, MIN_FUNNEL_DEATHS, OUTLIER_MIN_HOSPITALIZATIONS, type FunnelStatus } from "@/lib/jgpCard";

/**
 * Wspólna logika wykresu śmiertelności ośrodków (karta grupy JGP i eksplorator „Kto leczy”):
 * kolory statusu lejka, pozycje legendy i tekst objaśnienia w ikonie „?”.
 */

/** Kolor punktu według statusu na lejku (skala odchylenia, `DEVIATION_COLORS`). */
export const FUNNEL_STATUS_COLORS: Record<FunnelStatus, string> = {
  "powyżej 99,8%": DEVIATION_COLORS.up998,
  "powyżej 95%": DEVIATION_COLORS.up95,
  "w granicach": DEVIATION_COLORS.within,
  "poniżej 95%": DEVIATION_COLORS.down95,
  "poniżej 99,8%": DEVIATION_COLORS.down998,
};

/** Pozycje legendy lejka w kolejności od góry. */
export const FUNNEL_LEGEND: { status: FunnelStatus; label: string }[] = [
  { status: "powyżej 99,8%", label: "powyżej 99,8%" },
  { status: "powyżej 95%", label: "powyżej 95%" },
  { status: "w granicach", label: "w granicach" },
  { status: "poniżej 95%", label: "poniżej 95%" },
  { status: "poniżej 99,8%", label: "poniżej 99,8%" },
];

/** Kolor punktu ośrodka na lejku: śmiertelność ośrodka wobec średniej grupy przy jego liczbie hospitalizacji. */
export function funnelPointColor(mortalityPct: number, meanPct: number, hospitalizations: number): string {
  return FUNNEL_STATUS_COLORS[funnelStatus(mortalityPct, meanPct, hospitalizations)];
}

/**
 * Linie lejka dla osi X do `xMax` hospitalizacji: granice 95% (kropki) i 99,8% (kreski) nad i pod średnią,
 * kolor `--color-text-tertiary` (DESIGN.md 6.2, „Granica”).
 */
export function funnelLines(meanPct: number, xMax: number): { x: number[]; y: number[]; color: string; dash: "dot" | "dash" }[] {
  const max = Math.max(xMax, 10);
  const c = funnelCurves(meanPct, Math.max(5, Math.round(max * 0.01)), Math.round(max * 1.05));
  const color = CHART_COLORS.textTertiary;
  return [
    { x: c.x, y: c.inner[0], color, dash: "dot" }, { x: c.x, y: c.inner[1], color, dash: "dot" },
    { x: c.x, y: c.outer[0], color, dash: "dash" }, { x: c.x, y: c.outer[1], color, dash: "dash" },
  ];
}

/** Lejek ma sens dopiero od `MIN_FUNNEL_DEATHS` zgonów w grupie. */
export const hasEnoughDeathsForFunnel = (deaths: number) => deaths >= MIN_FUNNEL_DEATHS;

/**
 * Stan lejka na wykresie:
 * „funnel” — lejek narysowany; „few-deaths” — za mało zgonów; „off” — lejek wyłączony przełącznikiem;
 * „unavailable” — oś X lub układ wykresu nie pozwala na lejek (np. hospitalizacje na 100 tys., grupy JGP osobno).
 */
export type FunnelState = "funnel" | "few-deaths" | "off" | "unavailable";

/**
 * Stan lejka w eksploratorze: przełącznik `enabled`; lejek tylko dla osi „liczba hospitalizacji” i grup JGP razem
 * (na 100 tys. mieszkańców granice nie mają sensu, a osobne grupy mają różne średnie).
 */
export function explorerFunnelState({ enabled, deaths, perCapita, separateGroups }: { enabled: boolean; deaths: number; perCapita: boolean; separateGroups: boolean }): FunnelState {
  if (!enabled) return "off";
  if (perCapita || separateGroups) return "unavailable";
  return hasEnoughDeathsForFunnel(deaths) ? "funnel" : "few-deaths";
}

/** Zgony, hospitalizacje i średnia śmiertelność (zgony / hospitalizacje, %) wszystkich wierszy wykresu. */
export function mortalityTotals(rows: readonly { hospitalizations: number; deaths: number }[]) {
  const hospitalizations = rows.reduce((sum, row) => sum + row.hospitalizations, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  return { hospitalizations, deaths, meanPct: hospitalizations ? (deaths / hospitalizations) * 100 : 0 };
}

const centersWord = (n: number) => n === 1 ? "ośrodek" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "ośrodki" : "ośrodków";

/**
 * Objaśnienie wykresu śmiertelności (treść ikony „?” przy tytule), jeden krótki standard dla wszystkich wykresów.
 * Tylko to, co jest na wykresie: punkt, linia średniej (gdy jest), lejek (gdy jest), punkty ponad skalą (▲)
 * i kliknięcie. Bez zdań o tym, czego na wykresie nie ma.
 */
/** Powód, dla którego lejka nie ma (stan „unavailable”): dymek przełącznika i objaśnienie „?”. */
export const FUNNEL_UNAVAILABLE_REASON = "Lejek działa dla liczby hospitalizacji i grup JGP razem.";

export function mortalityChartHelp({ state, showsMean, aboveCap, selectable = false }: {
  state: FunnelState;
  /** Czy wykres ma linię średniej (`showsMortalityReference`). */
  showsMean: boolean;
  /** Punkty ponad skalą osi Y (`outlierCap`). */
  aboveCap?: { count: number; cap: number } | null;
  selectable?: boolean;
}): string[] {
  const lines = ["Punkt to ośrodek: liczba hospitalizacji i śmiertelność (zgony w szpitalu / hospitalizacje)."];
  if (showsMean) lines.push("Linia kropkowana: średnia wszystkich ośrodków.");
  if (state === "funnel") lines.push("Lejek: granice 95% i 99,8% wokół średniej. Kolor punktu to jego położenie wobec granic. Punkt poza granicą to sygnał do sprawdzenia, nie ocena jakości.");
  if (state === "unavailable") lines.push(FUNNEL_UNAVAILABLE_REASON);
  if (aboveCap?.count) {
    lines.push(`▲: ${aboveCap.count.toLocaleString("pl-PL")} ${centersWord(aboveCap.count)} poniżej ${OUTLIER_MIN_HOSPITALIZATIONS} hospitalizacji ze śmiertelnością ponad ${aboveCap.cap}%. Prawdziwa wartość jest w dymku.`);
  }
  if (selectable) lines.push("Kliknięcie punktu wybiera ośrodek.");
  return lines;
}
