/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DOT_SCALE_FLOOR, DOT_VALUE_FLOOR, dotRadius, dotScaleMax, MAX_DOT, RegionView } from "@/components/explorer/RegionView";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";
import { REGION_PICK_COLORS } from "@/lib/chartPalette";
import type { RegionsMap } from "@/lib/jgpCard";
import type { CitiesMap, FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";

vi.mock("@/components/InfoTip", () => ({ InfoTip: ({ label, ariaLabel }: { label: string; ariaLabel?: string }) => <span role="note" aria-label={ariaLabel}>{label}</span> }));
vi.mock("@/components/TableLinks", () => ({ ProviderLink: ({ name }: { name: string }) => <span>{name}</span> }));

const regionsMap: RegionsMap = {
  version: 1, source: "test", viewBox: [1000, 946],
  regions: [["07", "mazowieckie", "M600 300l100 0 0 100-100 0z", [650, 350]], ["12", "śląskie", "M400 700l100 0 0 100-100 0z", [450, 750]]],
};
// Gliwice celowo bez punktu (jak wieś spoza słownika miast).
const citiesMap: CitiesMap = {
  version: 1, source: "test", viewBox: [1000, 946],
  cities: [["WARSZAWA", "07", 650, 350, 1_800_000, "2024"], ["KATOWICE", "12", 450, 750, 280_000, "2024"]],
};
// Placówki: 0 Alfa (Warszawa), 1 Beta (Katowice), 2 Gamma (Gliwice), 3 Delta (Katowice, bez wybranych grup w 2025).
const facilityIndex: FacilityYearsIndex = {
  version: 1, years: ["2023", "2024", "2025"],
  facilities: [["07", "111", "Szpital Alfa", "WARSZAWA"], ["12", "222", "Szpital Beta", "KATOWICE"], ["12", "333", "Szpital Gamma", "GLIWICE"], ["12", "444", "Szpital Delta", "KATOWICE"]],
  active: [0b111, 0b111, 0b100, 0b100],
};
// P1 (A01): Beta 40 w 2023 (największa wartość okresu) i 18 w 2025, Alfa 12 w 2025. P3 (F99): Gamma 50 w 2025.
const sections: Record<string, FacilityYearsSection> = {
  A: { version: 2, products: ["P1"], rows: { product: [0, 0, 0], facility: [1, 1, 0], year: [0, 2, 2], hMin: [40, 18, 12], hSim: [40, 18, 12], dMin: [4, 3, 0], dSim: [4, 3, 0] } },
  F: { version: 2, products: ["P3"], rows: { product: [0], facility: [2], year: [2], hMin: [50], hSim: [50], dMin: [0], dSim: [0] } },
};

const loadTrends = vi.fn();
const loadStaticDataset = vi.fn();
const loadFacilityYearsSection = vi.fn((section: string) => Promise.resolve(sections[section]));
vi.mock("@/lib/staticData", () => ({
  loadTrends: () => loadTrends(),
  loadStaticDataset: (year: string) => loadStaticDataset(year),
  loadRegionsMap: () => Promise.resolve(regionsMap),
  loadCitiesMap: () => Promise.resolve(citiesMap),
  loadFacilityYearsIndex: () => Promise.resolve(facilityIndex),
  loadFacilityYearsSection: (section: string) => loadFacilityYearsSection(section),
}));

beforeEach(() => {
  loadTrends.mockResolvedValue(trendsFixture);
  loadStaticDataset.mockResolvedValue(latestDatasetFixture);
  loadFacilityYearsSection.mockClear();
});
afterEach(cleanup);

const tableRows = (name: RegExp) => within(screen.getByRole("region", { name })).getAllByRole("row").slice(1);
const cellText = (row: HTMLElement, column: number) => within(row).getAllByRole("cell")[column].textContent;
const openCities = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Miasta" }));
  return screen.findByRole("group", { name: /Mapa placówek/ });
};

describe("RegionView", () => {
  it("startuje od województw: mapa i tabela województw w roku z panelu", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    expect(await screen.findByRole("heading", { name: /Województwa na 100 tys\. mieszkańców/ })).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Jak czytać mapę" })).toHaveTextContent("wspólny dla wszystkich lat");
    const map = screen.getByRole("group", { name: /Mapa województw/ });
    expect(within(map).getAllByRole("button").map((shape) => shape.getAttribute("aria-label")?.split(":")[0])).toEqual(["Mazowieckie", "Śląskie"]);
    expect(tableRows(/Województwa · 2025/).map((row) => cellText(row, 1))).toEqual(["Śląskie", "Mazowieckie"]);
    expect(screen.queryByRole("region", { name: /Miasta · / })).not.toBeInTheDocument();
  });

  it("rok mapy i tabeli przychodzi z panelu (oś czasu jest w panelu, nie w widoku)", async () => {
    const { rerender } = render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    await screen.findByRole("region", { name: /Województwa · 2025/ });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    rerender(<RegionView productCodes={["P1"]} year="2024" method="min" />);
    expect(await screen.findByRole("region", { name: /Województwa · 2024/ })).toBeInTheDocument();
  });

  it("kliknięcie województwa dodaje je do obszarów (do 5) albo usuwa", async () => {
    const onAreasChange = vi.fn();
    const { rerender } = render(<RegionView productCodes={["P1"]} year="2025" method="min" areas={[{ kind: "city", city: "KRAKÓW" }]} onAreasChange={onAreasChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Śląskie:/ }));
    expect(onAreasChange).toHaveBeenLastCalledWith([{ kind: "city", city: "KRAKÓW" }, { kind: "region", owNfz: "12" }]);
    rerender(<RegionView productCodes={["P1"]} year="2025" method="min" areas={[{ kind: "city", city: "KRAKÓW" }, { kind: "region", owNfz: "12" }]} onAreasChange={onAreasChange} />);
    expect(screen.getByRole("button", { name: /^Śląskie:/ })).toHaveAttribute("aria-pressed", "true");
    const current = tableRows(/Województwa · 2025/).find((row) => row.getAttribute("aria-current") === "true");
    fireEvent.click(within(current!).getByRole("button", { name: "Śląskie" }));
    expect(onAreasChange).toHaveBeenLastCalledWith([{ kind: "city", city: "KRAKÓW" }]);
    onAreasChange.mockClear();
    const five = ["01", "02", "03", "04", "05"].map((owNfz) => ({ kind: "region" as const, owNfz }));
    rerender(<RegionView productCodes={["P1"]} year="2025" method="min" areas={five} onAreasChange={onAreasChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^Śląskie:/ }));
    expect(onAreasChange).not.toHaveBeenCalled();
  });

  it("miasta: kropki tylko placówek z ≥ 10 hospitalizacjami wybranych grup, w skali wspólnej dla lat", async () => {
    const { rerender } = render(<RegionView productCodes={["P1", "P3"]} year="2025" method="min" />);
    const map = await openCities();
    expect(loadFacilityYearsSection.mock.calls.map(([section]) => section).sort()).toEqual(["A", "F"]);
    // 2025: Beta 18 i Alfa 12; Delta bez wybranych grup — bez kropki; Gamma bez miasta w słowniku — bez kropki.
    expect(within(map).getAllByRole("button").map((dot) => dot.getAttribute("aria-label")?.split(" (")[0]).sort()).toEqual(["Szpital Alfa", "Szpital Beta"]);
    // Największa wartość placówki w okresie to 50 (Gamma 2025, bez kropki): mniej niż próg skali, więc skala kończy się na progu.
    expect(Number(within(map).getByRole("button", { name: /^Szpital Beta/ }).getAttribute("r"))).toBeCloseTo(dotRadius(18, DOT_SCALE_FLOOR));
    expect(tableRows(/Miasta · 2025/).map((row) => cellText(row, 1))).toEqual(["Gliwice", "Katowice", "Warszawa"]);
    expect(cellText(tableRows(/Miasta · 2025/)[0], 3)).toBe("—");
    rerender(<RegionView productCodes={["P1", "P3"]} year="2023" method="min" />);
    const map2023 = await screen.findByRole("group", { name: /Mapa placówek: hospitalizacje w 2023/ });
    expect(Number(within(map2023).getByRole("button", { name: /^Szpital Beta/ }).getAttribute("r"))).toBeCloseTo(dotRadius(40, DOT_SCALE_FLOOR));
    expect(within(map2023).queryByRole("button", { name: /^Szpital Alfa/ })).not.toBeInTheDocument();
    expect(dotRadius(50, 50)).toBe(MAX_DOT);
  });

  it("skala kropek: pole ∝ hospitalizacjom (5 × więcej = 5 × większe pole); koniec skali nie niżej niż próg", () => {
    const area = (value: number) => dotRadius(value, 8_000) ** 2;
    expect(area(500) / area(100)).toBeCloseTo(5);
    expect(dotScaleMax(100)).toBe(DOT_SCALE_FLOOR);
    expect(dotScaleMax(8_000)).toBe(8_000);
    // Koniec skali rośnie z dużą grupą: max(największa placówka, próg).
    expect(dotScaleMax(8_512)).toBe(8_512);
    // Największa kropka grupy ze 100 hospitalizacjami jest mniejsza niż największa kropka dużej grupy.
    expect(dotRadius(100, dotScaleMax(100))).toBeLessThan(dotRadius(8_000, dotScaleMax(8_000)));
  });

  it("skala kropek: poniżej 25 hospitalizacji jedna wielkość (jak 25); kropka nie mniejsza niż minimum", () => {
    expect(dotRadius(10, 500)).toBe(dotRadius(DOT_VALUE_FLOOR, 500));
    expect(dotRadius(24, 500)).toBe(dotRadius(DOT_VALUE_FLOOR, 500));
    expect(dotRadius(26, 500)).toBeGreaterThan(dotRadius(DOT_VALUE_FLOOR, 500));
    // Duża grupa (B18, ok. 8 500): kropka 25 hospitalizacji ma najmniejszy promień.
    expect(dotRadius(DOT_VALUE_FLOOR, 8_512)).toBe(2);
    expect(dotRadius(0, 500)).toBe(0);
  });

  it("legenda: kolory i wielkość kropek w jednym układzie", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" areas={[{ kind: "city", city: "KATOWICE" }]} />);
    await openCities();
    expect(screen.getByText(/Hospitalizacje placówki wobec mediany roku/)).toBeInTheDocument();
    expect(screen.getByText("Hospitalizacje w roku")).toBeInTheDocument();
    expect(screen.getByText("Obszary")).toBeInTheDocument();
    expect(screen.getAllByText("Katowice").length).toBeGreaterThan(0);
  });

  it("kolor kropki: hospitalizacje placówki wobec mediany placówek w roku mapy", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    const map = await openCities();
    const alfa = within(map).getByRole("button", { name: /^Szpital Alfa/ });
    const beta = within(map).getByRole("button", { name: /^Szpital Beta/ });
    expect(alfa.getAttribute("fill")).toMatch(/^rgb\(/);
    expect(alfa.getAttribute("fill")).not.toBe(beta.getAttribute("fill"));
    expect(beta).not.toHaveAttribute("opacity");
  });

  it("wybrane obszary mają obwódkę w kolorze wyróżnienia, pozostałe kropki są przygaszone; tabela miast tylko z obszarów", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" areas={[{ kind: "region", owNfz: "07" }]} />);
    const map = await openCities();
    expect(within(map).getByRole("button", { name: /^Szpital Alfa/ }).getAttribute("style")).toContain(`--area-color: ${REGION_PICK_COLORS[0]}`);
    expect(within(map).getByRole("button", { name: /^Szpital Beta/ })).toHaveAttribute("opacity", "0.3");
    expect(tableRows(/Miasta · 2025/).map((row) => cellText(row, 1))).toEqual(["Warszawa"]);
  });

  it("najechanie na kropkę pokazuje podpowiedź i nie zmienia tabeli miast", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    const map = await openCities();
    fireEvent.mouseEnter(within(map).getByRole("button", { name: /^Szpital Beta/ }), { clientX: 10, clientY: 10 });
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Szpital Beta");
    expect(tip).toHaveTextContent("Hospitalizacje 2025: 18");
    expect(tip).toHaveTextContent("Katowice · Śląskie");
    expect(tip).toHaveTextContent(/× mediany roku/);
    // Śmiertelność placówki: 3 zgony na 18 hospitalizacji.
    expect(tip).toHaveTextContent("Śmiertelność: 16,7% (3 zgony na 18 hosp.)");
    expect(screen.getByRole("region", { name: /Miasta · 2025/ })).toBeInTheDocument();
    fireEvent.mouseLeave(within(map).getByRole("button", { name: /^Szpital Beta/ }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dymek kropki to wspólny `ChartTooltip` (pozycja z kropki, może wyjść poza mapę); działa też z klawiatury", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    const map = await openCities();
    const dot = within(map).getByRole("button", { name: /^Szpital Beta/ });
    fireEvent.focus(dot);
    const tip = screen.getByRole("tooltip");
    expect(tip.className).toMatch(/tooltip/);
    expect(tip).toHaveAttribute("data-ready", "true");
    fireEvent.blur(dot);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("kliknięcie kropki pokazuje placówki miasta z wyróżnioną placówką; można dodać miasto do obszarów i wrócić", async () => {
    const onAreasChange = vi.fn();
    render(<RegionView productCodes={["P1"]} year="2025" method="min" onAreasChange={onAreasChange} />);
    fireEvent.click(within(await openCities()).getByRole("button", { name: /^Szpital Beta/ }));
    const panel = await screen.findByRole("region", { name: "Katowice · 2025" });
    expect(await within(panel).findByText("Szpital Beta")).toBeInTheDocument();
    expect(within(panel).getByText("Szpital Beta").closest("tr")).toHaveAttribute("aria-current", "true");
    // Wybrana placówka: pasek w kolorze sygnału, jak w tabeli ośrodków karty JGP.
    expect(within(panel).getByText("Szpital Beta").closest("tr")!.className).toMatch(/facilitySelected/);
    fireEvent.click(within(panel).getByRole("button", { name: "Dodaj miasto do obszaru analizy" }));
    expect(onAreasChange).toHaveBeenCalledWith([{ kind: "city", city: "KATOWICE" }]);
    fireEvent.click(within(panel).getByRole("button", { name: "← Wszystkie miasta" }));
    expect(screen.getByRole("region", { name: /Miasta · 2025/ })).toBeInTheDocument();
  });

  it("kliknięcie miasta w tabeli też pokazuje jego placówki", async () => {
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    await openCities();
    fireEvent.click(within(screen.getByRole("region", { name: /Miasta · 2025/ })).getByRole("button", { name: "Warszawa" }));
    expect(await screen.findByText("Szpital Alfa")).toBeInTheDocument();
  });

  it("prosi o wybór produktu i pokazuje błąd pobierania", async () => {
    render(<RegionView productCodes={[]} year="2025" method="min" />);
    expect(screen.getByText("Wybierz co najmniej jeden produkt.")).toBeInTheDocument();
    cleanup();
    loadTrends.mockRejectedValueOnce(new Error("Brak trendów."));
    render(<RegionView productCodes={["P1"]} year="2025" method="min" />);
    expect(await screen.findByText("Brak trendów.")).toBeInTheDocument();
  });
});
