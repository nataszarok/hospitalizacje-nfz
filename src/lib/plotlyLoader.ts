// Jeden dynamiczny import biblioteki na całą stronę (widoki przełączają wykresy wiele razy).
let plotlyPromise: Promise<typeof import("plotly.js-dist-min")["default"]> | null = null;

export function loadPlotly() {
  plotlyPromise ??= import("plotly.js-dist-min").then((module) => module.default);
  return plotlyPromise;
}
