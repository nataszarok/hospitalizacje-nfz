/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HomePage } from "@/components/portal/HomePage";
import type { HomeStats } from "@/lib/homeStats";
import type { HospitalHomeStats } from "@/lib/hospitalHomeStats";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const highlights = { yearFrom: "2024", yearTo: "2025", hospitalizations: 7_832_118, providers: 833, jgpGroups: 693 };

const group = (code: string, name: string, latest: number, previous: number) =>
  ({ code, name, latest, previous, changePct: ((latest - previous) / previous) * 100 });

const stats: HomeStats = {
  latestYear: "2025",
  previousYear: "2024",
  years: [
    { year: "2024", hospitalizations: 5_874_286, urgentPct: 38.6, plannedPct: 56.6, otherPct: 4.8, months: 12 },
    { year: "2025", hospitalizations: 5_972_504, urgentPct: 37.7, plannedPct: 57.6, otherPct: 4.7, months: 12 },
  ],
  topGroups: [group("B19G", "USUNIĘCIE ZAĆMY - KATEGORIA II", 341_910, 320_214), group("N01", "PORÓD", 126_576, 135_760)],
  changes: { up: [group("A66", "PADACZKA - DIAGNOSTYKA I LECZENIE", 11_374, 4_142)], down: [group("G36", "OSTRE ZAPALENIE TRZUSTKI", 2_712, 4_767)] },
  regions: {
    map: { version: 1, source: "test", viewBox: [100, 100], regions: [["07", "Mazowieckie", "M0 0h10v10z", [5, 5]], ["12", "Śląskie", "M20 20h10v10z", [25, 25]]] },
    cells: [
      { owNfz: "07", name: "Mazowieckie", population: 5_500_000, hospitalizations: 1_100, per100k: 20, deaths: 0, mortalityPct: 0, urgentPct: 0, column: 3, row: 1, shortName: "MAZ", ratio: 1.1, position: 0 },
      { owNfz: "12", name: "Śląskie", population: 4_300_000, hospitalizations: 731, per100k: 17, deaths: 0, mortalityPct: 0, urgentPct: 0, column: 2, row: 3, shortName: "ŚLĄ", ratio: 0.9, position: 0 },
    ],
    national: 18.7,
  },
};

const hospitals: HospitalHomeStats = {
  profiles: 833,
  withBeds: 712,
  medianBeds: 116.5,
  withSor: 243,
  beds: [{ label: "<100", count: 310 }, { label: "100–199", count: 189 }],
  finance: { year: 2025, reported: 631, loss: 286, netResult: -1_155_728_180, margins: [{ label: "−5…0", count: 137, negative: true }, { label: "0…5", count: 218, negative: false }] },
  comparison: {
    pairsA: 5056,
    hospitalsWithPeers: 452,
    example: { key: "04|9251723350", name: "SZPITAL W NOWEJ SOLI", city: "NOWA SÓL", peerCount: 40, peers: [{ key: "07|1111111111", name: "SZPITAL W OSTROŁĘCE", city: "OSTROŁĘKA", distance: 5.5 }] },
  },
};

const renderHome = (overrides: Partial<HomeStats> = {}, hospitalOverrides: Partial<HospitalHomeStats> = {}) =>
  render(<HomePage highlights={highlights} stats={{ ...stats, ...overrides }} hospitals={{ ...hospitals, ...hospitalOverrides }} />);

afterEach(cleanup);

describe("Strona główna", () => {
  it("pokazuje w hero wyszukiwarkę i jeden link do ścieżek", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Publiczna ochronazdrowia w liczbach.");
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).getByRole("search")).toBeInTheDocument();
    expect(within(hero).getByRole("combobox", { name: "Szukaj grupy JGP albo szpitala" })).toBeInTheDocument();
    expect(within(hero).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#odkrywaj"]);
    expect(screen.getByRole("img", { name: /szpital, rozliczenie z NFZ, kontrola/ })).toBeInTheDocument();
    expect(document.getElementById("odkrywaj")).toContainElement(screen.getByRole("heading", { name: "Trzy ścieżki przez dane." }));
  });

  it("pokazuje w pasku faktów liczby z danych, a nie same etykiety", () => {
    renderHome();
    const facts = screen.getByRole("region", { name: "Informacje o danych" });
    expect(facts).toHaveTextContent("2024–2025Zakres danych NFZ");
    expect(facts).toHaveTextContent("7,8 mlnHospitalizacji (szacunek)");
    expect(facts).toHaveTextContent("833Świadczeniodawców");
    expect(facts).toHaveTextContent("693Grup JGP");
  });

  it("prowadzi trzema ścieżkami do katalogu JGP, szpitali i eksploratora, z odnośnikami na skróty", () => {
    renderHome();
    const paths = screen.getByRole("region", { name: "Trzy ścieżki przez dane." });
    const items = within(paths).getAllByRole("listitem").filter((item) => item.querySelector("h3"));
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      "Co, gdzie i za ile leczą szpitale",
      "Jak wygląda konkretny szpital",
      "Własny zakres: grupy, obszar, okres",
    ]);
    expect(within(paths).getByRole("link", { name: /Katalog grup JGP/ })).toHaveAttribute("href", "/jgp");
    expect(within(paths).getByRole("link", { name: /Znajdź szpital/ })).toHaveAttribute("href", "/szpitale");
    expect(within(paths).getByRole("link", { name: /Otwórz eksplorator/ })).toHaveAttribute("href", "/analizy");
    expect(within(paths).getByRole("link", { name: "Porównanie z podobnymi" })).toHaveAttribute("href", "/szpitale?hv=c");
    expect(within(paths).getByRole("link", { name: "Największe zmiany" })).toHaveAttribute("href", "/jgp?sort=zmiana");
    expect(within(paths).getByRole("link", { name: "Gdzie" })).toHaveAttribute("href", "/analizy?t=g");
  });

  it("pokazuje w „Liczbach” dwa wykresy: hospitalizacje w latach i najczęstsze grupy", () => {
    renderHome();
    const data = screen.getByRole("region", { name: "Liczby, które warto znać." });
    expect(within(data).getAllByRole("article").map((card) => card.querySelector("h3")?.textContent)).toEqual([
      "Ile hospitalizacji rozlicza NFZ w roku?",
      "Które grupy JGP są najczęstsze?",
    ]);
    const years = within(data).getByRole("article", { name: "Ile hospitalizacji rozlicza NFZ w roku?" });
    expect(years).toHaveTextContent("6,0 mln w 2025 r. (+1,7% r/r)");
    expect(within(years).getByRole("img", { name: /2024 — 5,9 mln, 2025 — 6,0 mln/ })).toBeInTheDocument();
    expect(within(years).getByRole("link", { name: /W czasie/ })).toHaveAttribute("href", "/analizy");
    for (const card of within(data).getAllByRole("article")) expect(card).toHaveTextContent("Szacunek");
  });

  it("linkuje najczęstsze grupy do kart grup, z nazwami w formie zdania", () => {
    renderHome();
    const groups = screen.getByRole("article", { name: "Które grupy JGP są najczęstsze?" });
    const b19g = within(groups).getByRole("link", { name: /B19G/ });
    expect(b19g).toHaveAttribute("href", "/jgp/B19G");
    expect(b19g).toHaveTextContent("B19G Usunięcie zaćmy - kategoria II341 910");
    expect(within(groups).getByRole("link", { name: /Katalog grup JGP/ })).toHaveAttribute("href", "/jgp");
  });

  it("wprowadza do szpitali publicznych wykresem łóżek i wyników finansowych", () => {
    renderHome();
    const section = screen.getByRole("region", { name: "Jak wyglądają szpitale." });
    const beds = within(section).getByRole("article", { name: "Jakiej wielkości są szpitale?" });
    expect(beds).toHaveTextContent("Mediana: 117 łóżek. 243 z 833 ma szpitalny oddział ratunkowy (SOR).");
    expect(within(beds).getByRole("img", { name: /<100 łóżek — 310/ })).toBeInTheDocument();
    expect(within(beds).getByRole("link", { name: /Znajdź szpital/ })).toHaveAttribute("href", "/szpitale");
    expect(beds).not.toHaveTextContent("Szacunek");

    const finance = within(section).getByRole("article", { name: "Ile szpitali kończy rok ze stratą?" });
    expect(finance).toHaveTextContent("286 z 631 podmiotów (45%) miało stratę netto w 2025 r. Łączny wynik: −1,2 mld zł.");
    expect(within(finance).getByRole("link", { name: /Przykładowy profil/ })).toHaveAttribute("href", "/szpitale?hospital=04%7C9251723350");
  });

  it("pokazuje porównanie placówek na przykładzie szpitala i jego par klasy A", () => {
    renderHome();
    const section = screen.getByRole("region", { name: "Szpital na tle podobnych." });
    expect(section).toHaveTextContent("Pary klasy A5056");
    expect(section).toHaveTextContent("Szpitale z parą A452");
    const card = within(section).getByRole("article", { name: "Które szpitale są najbardziej podobne?" });
    expect(card).toHaveTextContent("SZPITAL W NOWEJ SOLI: 40 par klasy A. Poniżej 1 najbliższych.");
    expect(within(card).getByRole("link", { name: /SZPITAL W OSTROŁĘCE/ })).toHaveAttribute("href", "/szpitale?hospital=07%7C1111111111");
    expect(within(section).getByRole("link", { name: /Porównaj przykładowy szpital/ })).toHaveAttribute("href", "/szpitale?hospital=04%7C9251723350&hv=c");
  });

  it("pomija wykres finansów i przykład porównania bez danych", () => {
    renderHome({}, { finance: null, comparison: { pairsA: 0, hospitalsWithPeers: 0, example: null } });
    expect(screen.queryByRole("article", { name: "Ile szpitali kończy rok ze stratą?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Szpital na tle podobnych." })).not.toBeInTheDocument();
  });

  it("pokazuje działy portalu; wyceny JGP i artykuły jako planowane, bez linków", () => {
    renderHome();
    const sections = screen.getByRole("region", { name: "Wszystkie działy." });
    expect(within(sections).getByRole("link", { name: "Przeglądaj grupy JGP" })).toHaveAttribute("href", "/jgp");
    expect(within(sections).getByRole("link", { name: "Otwórz eksplorator" })).toHaveAttribute("href", "/analizy");
    expect(within(sections).getByRole("link", { name: "Znajdź szpital" })).toHaveAttribute("href", "/szpitale");
    expect(within(sections).getByRole("link", { name: "Porównaj szpitale" })).toHaveAttribute("href", "/szpitale?hv=c");
    for (const name of ["Wyceny JGP", "Artykuły"]) {
      const tile = within(sections).getByRole("article", { name: `${name} — planowane` });
      expect(tile).toHaveTextContent("Planowane");
      expect(within(tile).queryByRole("link")).not.toBeInTheDocument();
    }
  });

  it("nie linkuje do zewnętrznych stron; stopka prowadzi do metodologii", () => {
    renderHome();
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.startsWith("http"))).toEqual([]);
    expect(hrefs.filter((href) => href.startsWith("/porownaj"))).toEqual([]);
    expect(screen.getByRole("link", { name: "Metodologia" })).toHaveAttribute("href", "/o-danych");
  });
});
