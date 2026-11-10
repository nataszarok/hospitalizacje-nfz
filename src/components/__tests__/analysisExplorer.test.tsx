/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AnalysisExplorer } from "@/components/explorer/AnalysisExplorer";
import { DASHBOARD_TAB_NAVIGATE_EVENT } from "@/lib/dashboardNavigation";
import type { ReferencePayload } from "@/lib/types";

const reference: ReferencePayload = {
  analysisYear: "2025",
  defaultProductCode: "P1",
  products: [{ code: "P1", jgpCode: "E10", name: "OZW", label: "E10 — OZW" }, { code: "P2", jgpCode: "F99", name: "Inna", label: "F99 — Inna" }],
  regions: [{ owNfz: "07", name: "Mazowieckie" }],
  cities: ["Warszawa"],
  durations: ["0-1"],
};
const emptyKpi = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const trends = { years: ["2024", "2025"], products: [], monthly: [], regional: [] };
const emptyGeo = { regions: [], cities: [] };

const loadStaticDataset = vi.fn((year?: string) => Promise.resolve({
  analysisYear: year ?? "2025",
  facilities: [["07", "111", "Szpital", "Warszawa"], ["12", "222", "Filia", "Warszawa"]],
  facts: [["07", "111", "P1", "0-1", "6", 5, 5, 0, 0], ["12", "222", "P1", "0-1", "6", 9, 9, 0, 0]],
}));
// Liczba świadczeniodawców w KPI pokazuje, czy policzono kraj (2), czy obszar (1).
const mortalityFromDataset = vi.fn<(...args: unknown[]) => unknown>((_d, q) => {
  const facilities = (q as { areas?: unknown[] }).areas?.length ? 1 : 2;
  return { rows: Array.from({ length: facilities }, () => ({})), current: { ...emptyKpi, facilities, hospitalizations: 10, deaths: 1, mortalityPct: 10 }, baseline: emptyKpi, hasComparison: false, areaStats: emptyGeo, baselineAreaStats: emptyGeo };
});
// Dane w pamięci (pobrane z wyprzedzeniem): domyślnie brak, test startu bez szkieletu je ustawia.
const peeked: { index: unknown; dataset: unknown } = { index: null, dataset: null };
// Adres z routera Next (w aplikacji `useSearchParams`); w testach — bieżący adres okna.
// `router.search` ustawia test przejścia linkiem: router ma już nowy adres, a `window.location` jeszcze stary.
const router: { search: string | null } = { search: null };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(router.search ?? window.location.search) }));
vi.mock("@/lib/staticData", () => ({
  peekHospitalizationIndex: () => peeked.index,
  peekStaticDataset: () => peeked.dataset,
  peekTrends: () => null,
  loadHospitalizationIndex: () => Promise.resolve({ version: 1, years: ["2024", "2025"], latestYear: "2025", defaultProductCode: "P1" }),
  loadStaticDataset: (year?: string) => loadStaticDataset(year),
  referenceFromDataset: (d: { analysisYear: string }) => ({ ...reference, analysisYear: d.analysisYear }),
  mortalityFromDataset: (...args: unknown[]) => mortalityFromDataset(...args),
  admissionsFromDataset: (_d: unknown, q: { areas?: unknown[] }) => ({ rows: [{ urgentAdmissions: q.areas?.length ? 1 : 2 }], areaStats: emptyGeo }),
  loadTrends: () => Promise.resolve(trends),
  loadRegionalTrends: () => Promise.resolve({ owNfz: "07", rows: [] }),
  trendsForRegions: (t: unknown) => t,
  productTrend: () => ({ yearly: [{ year: "2024", hospitalizations: 100 }, { year: "2025", hospitalizations: 110 }], monthly: [] }),
}));
vi.mock("@/components/explorer/ExplorerSidebar", () => ({
  ExplorerSidebar: ({ view, years, year, setYear, setSelectedProducts, setAreas, durations, setDurations }: { view: string; years: string[]; year: string; setYear: (y: string) => void; setSelectedProducts: (v: string[]) => void; setAreas: (a: unknown[]) => void; durations: string[]; setDurations: (v: string[]) => void }) => <section>
    <span>kontekst: {view} · lata {years.join(",")} · rok {year}</span>
    <span>długość pobytu: {durations.join(",") || "wszystkie"}</span>
    <button onClick={() => setAreas([{ kind: "city", city: "Warszawa" }])}>miasto Warszawa</button>
    <button onClick={() => setAreas([{ kind: "region", owNfz: "07" }, { kind: "city", city: "Warszawa" }])}>województwo i miasto</button>
    <button onClick={() => setDurations(["0-1"])}>krótkie pobyty</button>
    <button onClick={() => setYear("2024")}>rok 2024</button>
    <button onClick={() => setSelectedProducts(["P1", "P2"])}>dwie grupy</button>
  </section>,
}));
vi.mock("@/components/InfoTip", () => ({ InfoTip: () => null, HelpLines: () => null }));
vi.mock("@/components/MortalityTab", () => ({
  MortalityTab: ({ data, highlightAreas }: { data: { rows: unknown[] }; highlightAreas: { kind: string; owNfz?: string; city?: string }[] }) =>
    <div>widok: kto leczy · punkty {data.rows.length} · wyróżnienie {highlightAreas.map((area) => area.owNfz ?? area.city).join(",")}</div>,
}));
vi.mock("@/components/AdmissionTab", () => ({ AdmissionTab: () => <div>widok: tryb przyjęcia</div> }));
vi.mock("@/components/explorer/RegionView", () => ({ RegionView: ({ year }: { year: string }) => <div>widok: gdzie/{year}</div> }));
vi.mock("@/components/trends/TrendView", () => ({
  TrendView: ({ productCodes, method, regions, areaLabel, areaNote, durations, displayMode, onDisplayModeChange }: { productCodes: string[]; method: string; regions?: string[]; areaLabel?: string; areaNote?: string | null; durations?: string[]; displayMode?: string; onDisplayModeChange?: (v: string) => void }) => <div>
    <div>trend długość pobytu: {durations?.join(",") || "wszystkie"}</div>
    <div>widok: w czasie/{productCodes.join(",")}/{method}</div>
    <div>zestawienie: {displayMode}</div>
    <button onClick={() => onDisplayModeChange?.("per_jgp")}>per jgp</button>
    {regions?.length ? <div>trend obszaru: {regions.join("+")} · {areaLabel}</div> : null}
    {areaNote ? <div>uwaga: {areaNote}</div> : null}
  </div>,
}));

const replace = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", "/analizy");
  window.localStorage.clear();
  loadStaticDataset.mockClear();
  mortalityFromDataset.mockClear();
  replace.mockReset();
  peeked.index = null;
  peeked.dataset = null;
  router.search = null;
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("AnalysisExplorer — start", () => {
  it("dane już w pamięci (pobrane z wyprzedzeniem): wyniki w pierwszym renderze, bez szkieletu i bez pobierania", () => {
    window.history.replaceState(null, "", "/analizy?t=k&ow=07");
    peeked.index = { version: 1, years: ["2024", "2025"], latestYear: "2025", defaultProductCode: "P1" };
    peeked.dataset = { analysisYear: "2025", facilities: [], facts: [] };
    render(<AnalysisExplorer />);
    // Bez `await`: widok i liczby obszaru są od razu, nie po załadowaniu.
    expect(screen.queryByText("Ładowanie analiz…")).not.toBeInTheDocument();
    expect(screen.getByText("Którzy świadczeniodawcy leczą i z jaką śmiertelnością?")).toBeInTheDocument();
    expect(loadStaticDataset).not.toHaveBeenCalled();
    // Wyniki policzone raz (kraj i obszar), bez drugiego przeliczenia po zamontowaniu.
    expect(mortalityFromDataset).toHaveBeenCalledTimes(2);
  });

  it("przejście linkiem: stan z adresu routera, nie ze starego `window.location`", () => {
    window.history.replaceState(null, "", "/");
    router.search = "?t=k";
    peeked.index = { version: 1, years: ["2024", "2025"], latestYear: "2025", defaultProductCode: "P1" };
    peeked.dataset = { analysisYear: "2025", facilities: [], facts: [] };
    render(<AnalysisExplorer />);
    expect(screen.getByText("Którzy świadczeniodawcy leczą i z jaką śmiertelnością?")).toBeInTheDocument();
  });

  it("bez danych w pamięci: szkielet, potem wyniki", async () => {
    render(<AnalysisExplorer />);
    expect(screen.getByText("Ładowanie analiz…")).toBeInTheDocument();
    expect(await screen.findByText("widok: w czasie/P1/min")).toBeInTheDocument();
  });
});

describe("AnalysisExplorer", () => {
  it("ma cztery widoki-pytania i domyślnie otwiera „W czasie”", async () => {
    render(<AnalysisExplorer />);
    expect(await screen.findByText("widok: w czasie/P1/min")).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Widoki analizy" });
    expect([...tabs.querySelectorAll("button[aria-current], button:not([aria-pressed])")].map((b) => b.textContent)).toEqual(["W czasie", "Kto leczy", "Tryb przyjęcia", "Gdzie"]);
    expect(screen.getByText("Jak zmieniała się liczba hospitalizacji?")).toBeInTheDocument();
    expect(screen.getByText("E10 — OZW · cała Polska · 2024–2025")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("ma tytuł i zwinięty wstęp, który rozwija „Jak korzystać?” i zapamiętuje", async () => {
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    expect(screen.getByRole("heading", { level: 1, name: "Eksplorator danych" })).toBeInTheDocument();
    expect(screen.getByText(/Hospitalizacje · grupy JGP · 2024–2025/)).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Jak korzystać\?/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Kiedy karta grupy JGP?" })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem("funduszdanych:explorer-intro")).toBe("1");
    expect(screen.getByRole("heading", { name: "Kiedy karta grupy JGP?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Karta grupy" })).toHaveAttribute("href", "/jgp");
    expect(screen.getByRole("link", { name: "Metodologia" })).toHaveAttribute("href", "/o-danych");
  });

  it("tryb analizy chowa nagłówek strony i jest w adresie (pelny=1), nie w pamięci przeglądarki", async () => {
    // Wartość zapisana przez starszą wersję strony nie włącza trybu.
    window.localStorage.setItem("funduszdanych:explorer-focus", "1");
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    expect(screen.getByRole("heading", { level: 1, name: "Eksplorator danych" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-explorer-focus");
    vi.stubGlobal("scrollTo", vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Tryb analizy" }));
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zakończ tryb analizy" })).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("pelny=1");
    // Pasek liczb chowa się płynnie (zostaje w DOM, poza drzewem dostępności); nagłówek portalu dostaje znacznik trybu.
    expect(document.querySelector('dl[aria-label="Liczby wybranego zakresu"]')?.closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
    expect(document.documentElement).toHaveAttribute("data-explorer-focus");
    // Odświeżenie strony z tym adresem: tryb od pierwszego renderu.
    cleanup();
    render(<AnalysisExplorer />);
    expect(await screen.findByRole("button", { name: "Zakończ tryb analizy" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Zakończ tryb analizy" }));
    expect(screen.getByRole("heading", { level: 1, name: "Eksplorator danych" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-explorer-focus");
    expect(window.location.search).not.toContain("pelny");
    window.localStorage.removeItem("funduszdanych:explorer-focus");
  });

  it("w „W czasie” przekazuje zestawienie JGP wspólne z „Kto leczy”", async () => {
    render(<AnalysisExplorer />);
    expect(await screen.findByText("zestawienie: combined")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "per jgp" }));
    expect(screen.getByText("zestawienie: per_jgp")).toBeInTheDocument();
  });

  it("w „Kto leczy” obszar wyróżnia punkty zamiast je odfiltrować, a karty liczb liczą obszar", async () => {
    window.history.replaceState(null, "", "/analizy?t=k&ow=07");
    render(<AnalysisExplorer />);
    expect(await screen.findByText("widok: kto leczy · punkty 2 · wyróżnienie 07")).toBeInTheDocument();
    expect(screen.getByText("Świadczeniodawcy").nextSibling).toHaveTextContent("1");
  });

  it("kilka obszarów: suma w liczbach, trend sumy województw (miasto → jego województwo), wyróżnienie każdego", async () => {
    window.history.replaceState(null, "", "/analizy?t=k");
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByRole("button", { name: "województwo i miasto" }));
    expect(await screen.findByText("widok: kto leczy · punkty 2 · wyróżnienie 07,Warszawa")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?ow=07&mc=Warszawa&t=k"));
    expect(screen.getByText(/woj\. mazowieckie, Warszawa · 2025/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "W czasie" }));
    // Warszawa: świadczeniodawcy z 12 mają więcej hospitalizacji (9 > 5), więc trend = woj. 07 + 12.
    expect(await screen.findByText(/trend obszaru: 07\+12/)).toBeInTheDocument();
    expect(screen.getByText(/uwaga: Trend miesięczny nie ma podziału na miasta/)).toBeInTheDocument();
  });

  it("filtr długości pobytu działa tylko w widoku, w którym go ustawiono", async () => {
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByRole("button", { name: "krótkie pobyty" }));
    expect(screen.getByText("trend długość pobytu: 0-1")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?d=0-1"));
    fireEvent.click(screen.getByRole("button", { name: "Kto leczy" }));
    expect(screen.getByText("długość pobytu: wszystkie")).toBeInTheDocument();
    await waitFor(() => expect(mortalityFromDataset).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ durations: [] })));
    fireEvent.click(screen.getByRole("button", { name: "W czasie" }));
    expect(screen.getByText("trend długość pobytu: 0-1")).toBeInTheDocument();
  });

  it("dla miasta wyróżnia świadczeniodawców z tego miasta", async () => {
    window.history.replaceState(null, "", "/analizy?t=k");
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByRole("button", { name: "miasto Warszawa" }));
    expect(await screen.findByText("widok: kto leczy · punkty 2 · wyróżnienie Warszawa")).toBeInTheDocument();
  });

  it("we wszystkich widokach pokazuje te same liczby w tej samej kolejności, ze zmianą r/r z trendów", async () => {
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    const labels = () => [...screen.getByLabelText("Liczby wybranego zakresu").querySelectorAll("dt")].map((dt) => dt.textContent);
    const order = ["Hospitalizacje 2025", "Śmiertelność", "Przyjęcia nagłe", "Świadczeniodawcy"];
    expect(labels()).toEqual(order);
    expect(await screen.findByText("+10,0% r/r")).toBeInTheDocument();
    // 2 przyjęcia nagłe na 10 hospitalizacji.
    expect(screen.getByText("20,0%")).toBeInTheDocument();
    for (const view of ["Kto leczy", "Tryb przyjęcia", "Gdzie"]) {
      fireEvent.click(screen.getByRole("button", { name: view }));
      expect(labels()).toEqual(order);
    }
  });

  it("opisuje zakres wielu grup liczbą w poprawnej formie", async () => {
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByText("dwie grupy"));
    expect(screen.getByText("2 grupy JGP łącznie · cała Polska · 2024–2025")).toBeInTheDocument();
  });

  it("czyta obszar z adresu: filtruje trend i liczy dane świadczeniodawców dla kraju i obszaru", async () => {
    window.history.replaceState(null, "", "/analizy?ow=07");
    render(<AnalysisExplorer />);
    expect(await screen.findByText("trend obszaru: 07 · woj. mazowieckie")).toBeInTheDocument();
    expect(screen.getByText(/· woj\. mazowieckie · 2024–2025/)).toBeInTheDocument();
    await waitFor(() => expect(mortalityFromDataset).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ areas: [{ kind: "region", owNfz: "07" }] })));
    expect(mortalityFromDataset).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ areas: expect.anything() }));
    expect(window.location.search).toBe("?ow=07");
  });

  it("dla miasta pokazuje trend województwa z największą liczbą hospitalizacji i wyjaśnia to", async () => {
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByRole("button", { name: "miasto Warszawa" }));
    expect(await screen.findByText(/trend obszaru: 12/)).toBeInTheDocument();
    expect(screen.getByText(/uwaga: Trend miesięczny nie ma podziału na miasta/)).toBeInTheDocument();
    expect(window.location.search).toBe("?mc=Warszawa");
  });

  it("nie ma profilu szpitala ani metodologii", async () => {
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    expect(screen.queryByRole("button", { name: /Profil szpitala|Metodologia/ })).not.toBeInTheDocument();
  });

  it("przełącza widok i zapisuje go w adresie", async () => {
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByRole("button", { name: "Kto leczy" }));
    expect(screen.getByText(/widok: kto leczy/)).toBeInTheDocument();
    expect(screen.getByText("Świadczeniodawcy").nextSibling).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Kto leczy" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("E10 — OZW · cała Polska · 2025")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?t=k"));
    fireEvent.click(screen.getByRole("button", { name: "Gdzie" }));
    expect(screen.getByText("widok: gdzie/2025")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?t=g"));
  });

  it("przełącza widok po zdarzeniu z nagłówka", async () => {
    render(<AnalysisExplorer />);
    await screen.findByText("widok: w czasie/P1/min");
    act(() => { window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_NAVIGATE_EVENT, { detail: { tab: "admissions" } })); });
    expect(screen.getByText("widok: tryb przyjęcia")).toBeInTheDocument();
  });

  it("odtwarza widok i rok z adresu", async () => {
    window.history.replaceState(null, "", "/analizy?t=g&y=2024&m=sim");
    render(<AnalysisExplorer />);
    expect(await screen.findByText("widok: gdzie/2024")).toBeInTheDocument();
    expect(screen.getByText("kontekst: regions · lata 2024,2025 · rok 2024")).toBeInTheDocument();
    expect(loadStaticDataset).toHaveBeenCalledWith("2024");
  });

  it("po zmianie roku ładuje dane tego roku i zapisuje rok w adresie", async () => {
    window.history.replaceState(null, "", "/analizy?t=k");
    render(<AnalysisExplorer />);
    fireEvent.click(await screen.findByText("rok 2024"));
    await waitFor(() => expect(window.location.search).toBe("?y=2024&t=k"));
    expect(loadStaticDataset).toHaveBeenCalledWith("2024");
  });

  it("linkuje stronę grupy JGP, gdy wybrano jedną grupę, która ją ma", async () => {
    render(<AnalysisExplorer />);
    const link = await screen.findByRole("link", { name: "Wszystko o grupie E10 →" });
    expect(link).toHaveAttribute("href", "/jgp/E10");
    // Obok przycisku trybu analizy (sama ikona), w pasku widoków.
    const nav = screen.getByRole("navigation", { name: "Widoki analizy" });
    expect(nav).toContainElement(link);
    expect(within(nav).getByRole("button", { name: "Tryb analizy" })).toHaveTextContent("");
    fireEvent.click(screen.getByText("dwie grupy"));
    expect(screen.queryByRole("link", { name: /Wszystko o grupie/ })).not.toBeInTheDocument();
  });

  it.each([
    ["?t=h&hospital=07%7C111&hv=c", "/szpitale?hospital=07%7C111&hv=c"],
    ["?t=m", "/o-danych"],
  ])("przekierowuje dawny adres %s", (search, target) => {
    vi.stubGlobal("location", { ...window.location, search, replace });
    render(<AnalysisExplorer />);
    expect(replace).toHaveBeenCalledWith(target);
    expect(loadStaticDataset).not.toHaveBeenCalled();
  });
});
