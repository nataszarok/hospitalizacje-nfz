/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GroupLineChart, type ChartLine } from "@/components/jgp/GroupLineChart";

// Po narysowaniu wykres podpina zdarzenia Plotly do elementu: zapamiętujemy obsługę zdarzeń.
// Osie z `_fullLayout`: x = indeks miesiąca × 10 px (daty przez `d2l`), y = 200 − wartość; marginesy 0.
type Handler = (event?: unknown) => void;
const handlers: Record<string, Handler[]> = {};
let monthIndex: Map<string, number> = new Map();
const react = vi.fn(async (plot: HTMLElement) => {
  Object.assign(plot, {
    on: (name: string, fn: Handler) => { (handlers[name] ??= []).push(fn); },
    removeAllListeners: (name: string) => { handlers[name] = []; },
    _fullLayout: {
      _size: { l: 0, t: 0 },
      xaxis: { l2p: (v: number) => v * 10, d2l: (v: string) => monthIndex.get(v) ?? 0 },
      yaxis: { l2p: (v: number) => 200 - v },
    },
  });
});
const restyle = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("@/lib/plotlyLoader", () => ({
  loadPlotly: async () => ({ react, restyle }),
}));
afterEach(() => { cleanup(); react.mockClear(); restyle.mockClear(); for (const key of Object.keys(handlers)) delete handlers[key]; });

// Trzy miesiące 2023 (rok niepełny) i dwanaście 2024.
const months = ["2023-10", "2023-11", "2023-12", ...Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, "0")}`)];
monthIndex = new Map(months.map((month, i) => [`${month}-01`, i]));
const values = months.map((_, i) => i + 1);
type Trace = { mode: string; x: string[]; y: (number | null)[]; hoverinfo?: string; opacity: number };
type Layout = { height: number; xaxis: { ticklabelmode?: string; range?: string[] }; annotations: { text: string }[] };

async function draw(lines: ChartLine[], props: { period?: "month" | "year"; selectedLabel?: string; onSelect?: (key: string) => void } = {}) {
  render(<GroupLineChart months={months} lines={lines} valueLabel="hosp." ariaLabel="wykres" height={300} {...props} />);
  await waitFor(() => expect(react).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole("img", { name: "wykres" }).onmousemove).toBeTruthy());
  const [plot, traces, layout] = react.mock.calls.at(-1) as unknown as [HTMLElement, Trace[], Layout];
  return { plot, traces, layout };
}
// Kursor w pikselach wykresu (x = indeks miesiąca × 10, y = 200 − wartość).
const hoverAt = (clientX: number, clientY: number) => fireEvent.mouseMove(screen.getByRole("img", { name: "wykres" }), { clientX, clientY });

describe("GroupLineChart — okres", () => {
  it("domyślnie miesiące: kropka na miesiąc i linia średniej 3M; Plotly nie rysuje dymka", async () => {
    const { traces } = await draw([{ key: "pl", name: "Polska", values }]);
    const [markers, line] = traces;
    expect(markers.x).toHaveLength(15);
    expect(line.y[2]).toBe(2);
    expect(markers.hoverinfo).toBe("none");
  });

  it("`activeOnly`: bez zer przed i po okresie aktywności; średnia 3M liczy się od pierwszego aktywnego miesiąca", async () => {
    const active = months.map((_, i) => i >= 2 && i <= 5 ? 10 * i : 0);
    const { traces } = await draw([{ key: "s", name: "Szpital", values: active, activeOnly: true }]);
    const [markers, line] = traces;
    expect(markers.y).toEqual([null, null, 20, 30, 40, 50, ...Array(9).fill(null)]);
    expect(line.y.slice(0, 4)).toEqual([null, null, 20, 25]);
    cleanup();
    react.mockClear();
    const yearly = await draw([{ key: "s", name: "Szpital", values: months.map((_, i) => i >= 3 ? 1 : 0), activeOnly: true }], { period: "year" });
    expect(yearly.traces[0].y).toEqual([null, 12]);
  });

  it("`activeYearsOnly`: rok bez hospitalizacji to przerwa (null), nie zero; oś miesięcy ma stały zakres wszystkich lat", async () => {
    // Hospitalizacje tylko w 2023 r.; śmiertelność (udział) z mianownikiem hospitalizacji.
    const hosp = months.map((_, i) => i < 3 ? 4 : 0);
    const deaths = months.map((_, i) => i === 1 ? 2 : 0);
    const { traces, layout } = await draw([{ key: "s", name: "Szpital", values: hosp, activeYearsOnly: true }]);
    expect(traces[0].y).toEqual([4, 4, 4, ...Array(12).fill(null)]);
    expect(traces[1].y).toEqual([4, 4, 4, ...Array(12).fill(null)]);
    expect(layout.xaxis.range).toEqual(["2023-09-16", "2024-12-16"]);
    cleanup();
    react.mockClear();
    const rate = await draw([{ key: "s", name: "Szpital", values: deaths, base: hosp, activeYearsOnly: true }], { period: "year" });
    expect(rate.traces[0].y).toEqual([(2 / 12) * 100, null]);
  });

  it("lata: suma roku w połowie roku, ta sama wysokość, rok niepełny z liczbą miesięcy w dymku", async () => {
    const { traces, layout } = await draw([{ key: "pl", name: "Polska", values }], { period: "year" });
    const [markers, line] = traces;
    expect(markers.x).toEqual(["2023-07-01", "2024-07-01"]);
    expect(markers.y).toEqual([6, 114]);
    expect(line.y).toEqual([6, 114]);
    expect(layout.height).toBe(300);
    expect(layout.xaxis).toMatchObject({ ticklabelmode: "period", range: ["2023-01-01", "2024-12-31"] });
    hoverAt(0, 194);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Polska2023 (3 mies.)6 hosp.");
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("średnia 3M");
  });

  it("lata dla udziału: procent z sum roku, nie średnia procentów miesięcy; dymek z liczbami", async () => {
    const base = months.map(() => 10);
    const { traces } = await draw([{ key: "pl", name: "Polska", values, base }], { period: "year" });
    // 2023: 6 / 30; 2024: 114 / 120.
    expect(traces[0].y).toEqual([20, 95]);
    // Punkt roku 2024 stoi 1 lipca (w osi testu miesiąc 9 → x = 90).
    hoverAt(90, 105);
    expect(screen.getByRole("tooltip")).toHaveTextContent("95,0% (114 hosp. z 120 hosp.)");
  });
});

describe("GroupLineChart — dymek HTML", () => {
  it("najechanie pokazuje nazwę, miejscowość, miesiąc, wartość i średnią 3M; zjechanie chowa dymek", async () => {
    await draw([{ key: "a", name: "Szpital A", detail: "Koszalin · OW Zachodniopomorskie", values }]);
    hoverAt(30, 196);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Szpital AKoszalin · OW Zachodniopomorskie · sty 20244 hosp.średnia 3M: 3 hosp.");
    // Dymek obok kropki: środek (30, 196), znacznik 14 px, strefa ochronna 12 px.
    expect(tooltip.dataset.placement).toBe("right");
    expect(parseFloat(tooltip.style.left)).toBeCloseTo(30 + 7 + 12);
    fireEvent.mouseLeave(screen.getByRole("img", { name: "wykres" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("GroupLineChart — wybrany ośrodek", () => {
  const name = "SZPITAL WOJEWÓDZKI IM. MIKOŁAJA KOPERNIKA W KOSZALINIE";
  const lines: ChartLine[] = [
    { key: "a", name: "Inny ośrodek", values: values.map((v) => v + 100) },
    { key: "b", name, values, tone: "selected" },
  ];

  it("bez wybranego ośrodka wszystkie linie mają dymek", async () => {
    const { traces } = await draw(lines.map((line) => ({ ...line, tone: undefined })));
    expect(traces.slice(0, 4).map((trace) => trace.hoverinfo)).toEqual(["none", "none", "none", "none"]);
  });

  it("z wybranym ośrodkiem pozostałe linie są przygaszone, ale reagują na najechanie", async () => {
    const { traces } = await draw(lines);
    // Serie: inny ośrodek (kropki, średnia), wybrany (kropki, średnia).
    expect(traces.slice(0, 4).map((trace) => trace.hoverinfo)).toEqual(["none", "none", "none", "none"]);
    expect(traces[0].opacity).toBeLessThan(0.5);
    hoverAt(0, 199);
    expect(screen.getByRole("tooltip")).toHaveTextContent(name);
  });

  it("najechanie na linię tła podświetla samą linię na niebiesko, bez kropek serii; wybrana linia ma też kropki", async () => {
    await draw(lines);
    const overlay = () => restyle.mock.calls.at(-1)![1] as { y: unknown[][]; "line.color": string[] };
    hoverAt(30, 96);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Inny ośrodek");
    expect(overlay()["line.color"][0]).toBe("#2856A3");
    expect(overlay().y[0]).toHaveLength(months.length);
    expect(overlay().y[1]).toEqual([null]);
    hoverAt(30, 196);
    expect(overlay().y[1]).toHaveLength(months.length);
  });

  it("kliknięcie przy innej linii wybiera ją; kliknięcie z dala od linii nic nie robi", async () => {
    const onSelect = vi.fn();
    const { plot } = await draw(lines, { onSelect });
    // Linia „Inny ośrodek”: miesiąc 5 → wartość 106 → piksel (50, 94).
    fireEvent.click(plot, { clientX: 52, clientY: 96 });
    expect(onSelect).toHaveBeenLastCalledWith("a");
    fireEvent.click(plot, { clientX: 50, clientY: 194 });
    expect(onSelect).toHaveBeenLastCalledWith("b");
    onSelect.mockClear();
    fireEvent.click(plot, { clientX: 50, clientY: 150 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("najechanie i kliknięcie: linia najbliżej kursora, także gdy kropki linii się nakładają; dymek znika po kliknięciu", async () => {
    const onSelect = vi.fn();
    // „c” ma kropki w tych samych miesiącach co „a”, 3 jednostki niżej (kropki się nakładają); „a” jest pierwsza na liście.
    const overlapping: ChartLine[] = [lines[0], { key: "c", name: "Krótka linia", values: values.map((v, i) => i >= 4 && i <= 6 ? v + 97 : 0), activeOnly: true }];
    const { plot } = await draw(overlapping, { onSelect });
    // Miesiąc 5: „a” = 106 (y 94), „c” = 103 (y 97). Kursor na kropce „c”.
    hoverAt(50, 97);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Krótka linia");
    fireEvent.click(plot, { clientX: 50, clientY: 97 });
    expect(onSelect).toHaveBeenLastCalledWith("c");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    // Odcinek średniej między kropkami też jest trafieniem.
    hoverAt(45, 94.5);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Inny ośrodek");
  });

  it("podpis wybranej linii stoi przy jej ostatnim punkcie, także gdy linia kończy się wcześniej", async () => {
    const short: ChartLine = { key: "s", name: "Ośrodek zamknięty", values: values.map((v, i) => i <= 4 ? v : 0), activeOnly: true, tone: "selected" };
    const { layout } = await draw([short], { selectedLabel: "Ośrodek zamknięty" });
    expect(layout.annotations[0]).toMatchObject({ text: "Ośrodek zamknięty", x: `${months[4]}-01` });
  });

  it("długą nazwę w podpisie łamie na linie, bez skracania", async () => {
    const { layout } = await draw(lines, { selectedLabel: name });
    expect(layout.annotations[0].text).toBe("SZPITAL WOJEWÓDZKI IM. MIKOŁAJA<br>KOPERNIKA W KOSZALINIE");
  });
});
