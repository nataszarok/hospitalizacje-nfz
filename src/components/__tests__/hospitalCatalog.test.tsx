/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as baseRender, screen, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { HospitalCatalogPage } from "@/components/hospitals/HospitalCatalogPage";
import type { HospitalCatalog, HospitalCatalogRow } from "@/lib/hospitalCatalog";
import { CATALOG_DOT_RADIUS, catalogDotRadius } from "@/lib/hospitalCatalog";

// Mapa: dwa województwa i trzy miasta w słowniku (Warszawa, sąsiednie Piaseczno, Koszalin); bez pobierania plików.
vi.mock("@/lib/staticData", () => ({
  loadRegionsMap: async () => ({ version: 1, source: "", viewBox: [1000, 946], regions: [["16", "zachodniopomorskie", "M0 0h10v10z", [5, 5]], ["07", "mazowieckie", "M20 0h10v10z", [25, 5]]] }),
  loadCitiesMap: async () => ({ version: 1, source: "", viewBox: [1000, 946], cities: [["KOSZALIN", "16", 100, 50, 100000, "2021"], ["WARSZAWA", "07", 600, 400, 1800000, "2021"], ["PIASECZNO", "07", 603, 402, 50000, "2021"]] }),
}));

// Mantine czyta preferowany motyw z `matchMedia`; jsdom go nie ma.
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
// `InfoTip` (podpowiedź „?”) to komponent Mantine.
const render = (node: ReactNode) => baseRender(<MantineProvider>{node}</MantineProvider>);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/szpitale");
});

const row = (patch: Partial<HospitalCatalogRow>): HospitalCatalogRow => ({
  key: "", owNfz: "07", nip: "", name: "", city: "WARSZAWA", psz: null, series: [0, 0], latest: 0, previous: 0, changePct: null, mortalityPct: null, beds: null, net: null, ...patch,
});
const catalog: HospitalCatalog = {
  years: ["2024", "2025"], latestYear: "2025", previousYear: "2024",
  pszLevels: ["I stopnia", "II stopnia", "III stopnia"],
  regions: { "16": "zachodniopomorskie", "07": "mazowieckie" },
  rows: [
    row({ key: "16|6691044410", owNfz: "16", nip: "6691044410", name: "SZPITAL WOJEWÓDZKI W KOSZALINIE", city: "KOSZALIN", psz: 2, series: [22716, 24500], latest: 24500, previous: 22716, changePct: 7.85, mortalityPct: 2.59, beds: 557, net: { year: 2025, value: 15_100_000 } }),
    row({ key: "07|222", nip: "222", name: "Szpital Beta", series: [8000, 6000], latest: 6000, previous: 8000, changePct: -25, mortalityPct: 1.5 }),
    row({ key: "07|333", nip: "333", name: "Klinika Oka", series: [900, 800], latest: 800, previous: 900, changePct: -11.1 }),
    // Bez hospitalizacji w najnowszym roku: na liście (na końcu, „—”), bez kropki na mapie.
    row({ key: "07|444", nip: "444", name: "Zamknięty szpital", series: [500, 0], latest: 0, previous: 500 }),
  ],
  totals: { providers: 3, inPsz: 1, inPszLatest: 24500, latest: 31300, previous: 31616, beds: 557 },
};
// Nazwa szpitala: link do karty albo (bez karty) sam tekst.
const names = () => within(screen.getByRole("region", { name: "Szpitale" })).getAllByRole("row").slice(2).map((tr) => tr.querySelector("td")!.firstElementChild!.textContent);

describe("Katalog szpitali", () => {
  it("pokazuje wszystkich świadczeniodawców (bez progu) z poziomem sieci; szpital z kartą linkuje do karty, inne są bez linku", () => {
    render(<HospitalCatalogPage catalog={catalog} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Szpitale");
    expect(names()).toEqual(["SZPITAL WOJEWÓDZKI W KOSZALINIE", "Szpital Beta", "Klinika Oka", "Zamknięty szpital"]);
    // Zakładki: Mapa pierwsza; liczba na Liście = wszyscy świadczeniodawcy, także bez hospitalizacji w najnowszym roku.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Mapa", "Lista 4"]);
    expect(screen.queryByRole("link", { name: "Zamknięty szpital" })).not.toBeInTheDocument();
    const closed = within(screen.getByText("Zamknięty szpital").closest("tr")!).getAllByRole("cell");
    expect(closed[2]).toHaveTextContent("—");
    const table = within(screen.getByRole("region", { name: "Szpitale" }));
    expect(table.getByRole("link", { name: "SZPITAL WOJEWÓDZKI W KOSZALINIE" })).toHaveAttribute("href", "/szpitale/6691044410-16");
    expect(table.queryByRole("link", { name: "Szpital Beta" })).not.toBeInTheDocument();
    expect(screen.getByText("PSZ III st.")).toHaveAttribute("title", "Sieć szpitali (PSZ): III stopnia");
    const cells = within(table.getByText("Szpital Beta").closest("tr")!).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells.slice(2)).toEqual(["6000", "−25,0%", "1,5%", "—", "—"]);
  });

  it("filtruje po województwie, sieci i progu, zapisuje filtry w adresie; wyszukiwanie pomija próg", () => {
    render(<HospitalCatalogPage catalog={catalog} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Min\. hospitalizacji/ }), { target: { value: "5000" } });
    expect(names()).toEqual(["SZPITAL WOJEWÓDZKI W KOSZALINIE", "Szpital Beta"]);
    expect(window.location.search).toBe("?min=5000");
    fireEvent.change(screen.getByRole("combobox", { name: "Województwo" }), { target: { value: "07" } });
    expect(names()).toEqual(["Szpital Beta"]);
    expect(window.location.search).toBe("?woj=07&min=5000");
    fireEvent.change(screen.getByRole("combobox", { name: "Województwo" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Sieć szpitali (PSZ)" }), { target: { value: "in" } });
    expect(names()).toEqual(["SZPITAL WOJEWÓDZKI W KOSZALINIE"]);
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    fireEvent.change(screen.getByRole("combobox", { name: /Min\. hospitalizacji/ }), { target: { value: "5000" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Szukaj" }), { target: { value: "oka" } });
    expect(names()).toEqual(["Klinika Oka"]);
  });

  it("sortuje po kolumnie i pokazuje największe zmiany r/r", () => {
    window.history.replaceState(null, "", "/szpitale?min=5000");
    render(<HospitalCatalogPage catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: "r/r" }));
    expect(names()).toEqual(["SZPITAL WOJEWÓDZKI W KOSZALINIE", "Szpital Beta"]);
    fireEvent.click(screen.getByRole("button", { name: /r\/r/ }));
    expect(names()).toEqual(["Szpital Beta", "SZPITAL WOJEWÓDZKI W KOSZALINIE"]);
    expect(screen.getByRole("region", { name: "Największe spadki 2024 → 2025" })).toHaveTextContent("Szpital Beta");
  });

  it("mapa: kropka na szpital (wielkość = hospitalizacje), kliknięcie wybiera miasto szpitala; lista pokazuje tylko szpitale miasta", async () => {
    window.history.replaceState(null, "", "/szpitale?widok=mapa");
    render(<HospitalCatalogPage catalog={catalog} />);
    const map = await screen.findByRole("group", { name: /Mapa: hospitalizacje szpitali w 2025 r\./ });
    // Szpital bez hospitalizacji w najnowszym roku nie ma kropki.
    expect(within(map).getAllByRole("button", { name: /hospitalizacji$/ }).map((dot) => dot.getAttribute("aria-label"))).toEqual(expect.arrayContaining([
      expect.stringMatching(/^SZPITAL WOJEWÓDZKI W KOSZALINIE, Koszalin: 24\s500/), "Szpital Beta, Warszawa: 6000 hospitalizacji", "Klinika Oka, Warszawa: 800 hospitalizacji",
    ]));
    expect(within(map).queryByRole("button", { name: /^Zamknięty szpital/ })).not.toBeInTheDocument();
    const beta = within(map).getByRole("button", { name: /^Szpital Beta/ });
    const koszalin = within(map).getByRole("button", { name: /^SZPITAL WOJEWÓDZKI/ });
    expect(Number(koszalin.getAttribute("r"))).toBeGreaterThan(Number(beta.getAttribute("r")));
    fireEvent.click(beta);
    expect(window.location.search).toBe("?widok=mapa&miasto=WARSZAWA");
    expect(screen.getByRole("complementary", { name: "Szpitale na mapie" })).toHaveTextContent("Szpital Beta");
    fireEvent.click(screen.getByRole("tab", { name: /Lista/ }));
    expect(window.location.search).toBe("?widok=lista&miasto=WARSZAWA");
    expect(names()).toEqual(["Szpital Beta", "Klinika Oka", "Zamknięty szpital"]);
    fireEvent.click(screen.getByRole("button", { name: "Usuń filtr miasta Warszawa" }));
    expect(names()).toHaveLength(4);
  });

  it("bez wyboru w adresie: na komputerze aktywna zakładka Mapa (lista w HTML, ukryta przez CSS)", async () => {
    render(<HospitalCatalogPage catalog={catalog} />);
    expect(screen.getByRole("tab", { name: "Mapa" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("group", { name: /Mapa:/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Szpitale" })).toBeInTheDocument();
  });

  it("mapa: kropki spoza filtrów zostają szare w tym samym miejscu; wielkość nie zależy od filtrów", async () => {
    window.history.replaceState(null, "", "/szpitale?widok=mapa");
    render(<HospitalCatalogPage catalog={catalog} />);
    // Po wyszukaniu „Beta” zostaje sam ten szpital (6000 hosp.): kropka na skali wszystkich szpitali (Koszalin 24 500), nie największa.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Beta" } });
    const warsaw = within(await screen.findByRole("group", { name: /Mapa:/ })).getByRole("button", { name: /^Szpital Beta/ });
    expect(Number(warsaw.getAttribute("r"))).toBeCloseTo(catalogDotRadius(6000, 24500));
    expect(Number(warsaw.getAttribute("r"))).toBeLessThan(CATALOG_DOT_RADIUS.max);
    // Koszalin i Klinika Oka nie pasują do wyszukiwania: szare kropki bez kliknięcia, nadal na mapie.
    const map = await screen.findByRole("group", { name: /Mapa:/ });
    expect(map.querySelectorAll("circle")).toHaveLength(3);
    expect(within(map).getAllByRole("button", { name: /hospitalizacji$/ })).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Legenda mapy" })).toHaveTextContent("poza filtrami");
  });

  it("mapa: kropki szpitali jednego miasta i sąsiednich miast nie nachodzą na siebie; wielkość z catalogDotRadius", async () => {
    window.history.replaceState(null, "", "/szpitale?widok=mapa");
    // Trzy szpitale: dwa w Warszawie, jeden w sąsiednim Piasecznie (punkt 3 jednostki obok).
    const near = { ...catalog, rows: [...catalog.rows, { ...catalog.rows[2], key: "07|555", nip: "555", name: "Szpital Gamma", city: "PIASECZNO", latest: 30, series: [0, 30] }] };
    render(<HospitalCatalogPage catalog={near} />);
    const map = await screen.findByRole("group", { name: /Mapa:/ });
    const dots = within(map).getAllByRole("button", { name: /hospitalizacji$/ }).map((node) => ({ x: Number(node.getAttribute("cx")), y: Number(node.getAttribute("cy")), r: Number(node.getAttribute("r")) }));
    for (const [i, a] of dots.entries()) for (const b of dots.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
    expect(Number(within(map).getByRole("button", { name: /^Szpital Gamma/ }).getAttribute("r"))).toBeCloseTo(catalogDotRadius(30, 24500));
  });

  it("mapa: kliknięcie województwa ustawia filtr województwa", async () => {
    window.history.replaceState(null, "", "/szpitale?widok=mapa");
    render(<HospitalCatalogPage catalog={catalog} />);
    const map = await screen.findByRole("group", { name: /Mapa:/ });
    fireEvent.click(within(map).getByRole("button", { name: "Województwo zachodniopomorskie" }));
    expect(window.location.search).toBe("?widok=mapa&woj=16");
    expect(within(map).queryByRole("button", { name: /^Szpital Beta/ })).not.toBeInTheDocument();
  });
});
