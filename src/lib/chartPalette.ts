/**
 * Kolory wykresów: te same wartości co tokeny --color-* w globals.css (Plotly i atrybuty SVG nie czytają zmiennych CSS;
 * zgodność pilnuje test designTokens). Błękity i granat = dane, sygnał = jedno wyróżnienie na wykres (DESIGN.md, 2.2).
 */
export const CHART_COLORS = {
  text: "#253B3A",
  textSecondary: "#536C68",
  textTertiary: "#6C827E",
  border: "#D9E6E3",
  borderStrong: "#B9CEC9",
  grid: "#E6EFEC",
  background: "#FFFFFF",
  backgroundMuted: "#EDF4F1",
  dataStrong: "#1B3D78",
  data: "#2856A3",
  dataSoft: "#9DB4DB",
  dataMuted: "#B5C7E6",
  dataFaint: "#E4EAF4",
  signal: "#C65D2E",
  positive: "#1D6B3A",
} as const;

/**
 * Skala odchylenia (lejek, różnica wobec podobnych): ciepłe w górę, w granicach błękit fartucha, poniżej 95% neutralna
 * szarość z zielenią (niższa śmiertelność bez pewności nie przyciąga wzroku), poniżej 99,8% granat.
 * Na wykresie z tą skalą wyróżnienie jest grafitowe, nie w kolorze sygnału (DESIGN.md, 6.2a).
 */
export const DEVIATION_COLORS = { up95: "#E3A27F", up998: "#B4441B", down95: "#A9BCB7", down998: "#2856A3", within: "#9DB4DB" } as const;

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
