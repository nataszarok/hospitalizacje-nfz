import type { ChartPeriod } from "@/lib/jgpCard";

/** Miary wykresów w czasie: karta grupy JGP („Ile?”) i widok „W czasie” eksploratora. */
export type TrendMetric = "hospitalizations" | "mortality" | "urgent";

// Przycisk, tytuł sekcji (bez okresu), jednostka w podpowiedzi i objaśnienie pod osią w obu okresach.
// Objaśnienie roczne ma tyle samo zdań co miesięczne: wykres ma tę samą wysokość w obu okresach.
export const TREND_METRICS: Record<TrendMetric, { button: string; title: string; unit: string; note: Record<ChartPeriod, string> }> = {
  hospitalizations: { button: "Hospitalizacje", title: "Hospitalizacje", unit: "hosp.", note: {
    month: "Kropka = miesiąc, linia = średnia z 3 miesięcy. Miesiące według daty wypisu, wartości <5 liczone jako 1.",
    year: "Kropka = suma roku. Lata według daty wypisu, wartości <5 liczone jako 1.",
  } },
  mortality: { button: "Śmiertelność", title: "Śmiertelność", unit: "zgonów", note: {
    month: "Zgony w szpitalu / hospitalizacje. Linia = udział z 3 miesięcy, miesiące według daty wypisu.",
    year: "Zgony w szpitalu / hospitalizacje w roku. Lata według daty wypisu.",
  } },
  urgent: { button: "% nagłych", title: "Udział przyjęć nagłych", unit: "nagłych", note: {
    month: "Przyjęcia nagłe (tryb 2 i 3) / hospitalizacje. Linia = udział z 3 miesięcy, miesiące według daty wypisu.",
    year: "Przyjęcia nagłe (tryb 2 i 3) / hospitalizacje w roku. Lata według daty wypisu.",
  } },
};
