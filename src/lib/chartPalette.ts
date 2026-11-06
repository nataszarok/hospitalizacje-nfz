/**
 * Wspólna paleta wykresów punktowych świadczeniodawców (karta grupy JGP i eksplorator).
 * Kolory wybranych województw i miast: kontrastowe wobec niebieskiej skali mapy, bez czerwieni i pomarańczu
 * (zarezerwowanych dla wybranego ośrodka). Sprawdzone walidatorem palety (jasność, nasycenie, odstęp ΔE ≥ 15
 * przy normalnym widzeniu; dla daltonizmu dodatkowo podpisy w legendzie).
 */
export const REGION_PICK_COLORS = ["#7B3FA0", "#1A9850", "#D6338A", "#B88A00", "#0097A7", "#9A5B13"];
/** Ośrodki spoza wybranych obszarów, gdy coś jest wyróżnione. */
export const OTHER_POINT = "rgba(152, 162, 179, 0.5)";
/** Ośrodki, gdy nic nie jest wyróżnione. */
export const BASE_POINT = "rgba(40, 86, 163, 0.55)";
