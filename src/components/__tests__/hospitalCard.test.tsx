/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as baseRender, screen, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { HospitalPage } from "@/components/hospitals/HospitalPage";
import { buildHospitalPageData } from "@/lib/hospitalPage";
import { hospitalPageInput } from "@/lib/__tests__/fixtures/hospitalPageFixture";
import { contractsFixture, paymentFixture } from "@/lib/__tests__/fixtures/hospitalFinanceFixture";
import { buildHospitalFinance } from "@/lib/hospitalFinance";

// Wykres „Ile?” (Plotly) zapamiętuje ślady: test sprawdza linię odniesienia „Sieć PSZ”.
const react = vi.fn(async (...args: unknown[]) => {
  Object.assign(args[0] as HTMLElement, { on: () => {}, removeAllListeners: () => {}, _fullLayout: { _size: { l: 0, t: 0 }, xaxis: { l2p: () => 0, d2l: () => 0 }, yaxis: { l2p: () => 0 } } });
});
vi.mock("@/lib/plotlyLoader", () => ({ loadPlotly: async () => ({ react, restyle: async () => {} }) }));
// Mantine czyta preferowany motyw z `matchMedia`; jsdom go nie ma.
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;
const render = (node: ReactNode) => baseRender(<MantineProvider>{node}</MantineProvider>);

afterEach(() => {
  cleanup();
  react.mockClear();
  window.history.replaceState(null, "", "/szpitale/111");
});

const data = buildHospitalPageData(hospitalPageInput)!;
// Szpital z więcej niż 10 grupami JGP w roku (sekcja „Ile grup daje większość?”) i hospitalizacjami w 5 latach („Jak długo leżą?”).
const rich = {
  ...data,
  groups: Array.from({ length: 11 }, (_, i) => [`A${String(i + 1).padStart(2, "0")}`, `ZABIEG ${i + 1}`, [15, 30], [2, 2], [2, 3], [0, 3_000_000], [1, 2], [55, 100], [4, 2], [0, 10_000_000]] as (typeof data.groups)[number]),
};
type Trace = { name: string; line?: { dash?: string; color: string } };

describe("Karta szpitala", () => {
  it("nagłówek: ścieżka do katalogu, poziom sieci, liczby roku i link do porównania z podobnymi", () => {
    render(<HospitalPage data={data} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("SZPITAL ALFA");
    expect(screen.getByRole("link", { name: "Szpitale" })).toHaveAttribute("href", "/szpitale");
    expect(screen.getByText(/sieć szpitali \(PSZ\): III stopnia/)).toBeInTheDocument();
    const kpis = within(document.querySelector<HTMLElement>('dl[aria-label="Liczby szpitala"]')!);
    expect(kpis.getByText("Hospitalizacje 2025").nextSibling).toHaveTextContent("30");
    expect(kpis.getByText("+100,0% r/r")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Porównanie z podobnymi szpitalami/ })).toHaveAttribute("href", "/szpitale/eksplorator?hospital=16%7C111&hv=c");
  });

  it("jedna aktywna zakładka „Przegląd”; pozostałe zapowiedziane i wyłączone", () => {
    render(<HospitalPage data={data} />);
    expect(screen.getByRole("tab", { name: "Przegląd" })).toHaveAttribute("aria-selected", "true");
    for (const name of [/Finanse/, /Porównanie/]) expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-disabled", "true");
  });

  it("„Co leczy i za ile?”: grupa z kwotą, miejscem i śmiertelnością wobec Polski; link do karty grupy; rok zmienia tabelę i adres", () => {
    render(<HospitalPage data={data} />);
    const table = () => within(screen.getByRole("heading", { name: /Co leczy i za ile/ }).closest("section")!);
    const link = table().getByRole("link", { name: "A01" });
    expect(link).toHaveAttribute("href", "/jgp/A01?osrodek=16%7C111");
    const cells = within(link.closest("tr")!).getAllByRole("cell").map((cell) => cell.textContent);
    // 2025: 30 hosp., 3,0 mln zł, 2. z 3 ośrodków, 2 zgony (6,7%; Polska 2,0%), kwota nowa (w 2024 r. brak).
    expect(cells.slice(1, 5)).toEqual(["30", "3,0", "2. z 3", "6,7%"]);
    expect(cells[0]).toContain("Polska: 2,0% śmiertelności");
    // Za mało zgonów oczekiwanych (0,6) do oceny odchylenia: pusta kropka.
    expect(table().getByRole("img", { name: "za mało zgonów do oceny" })).toBeInTheDocument();
    fireEvent.change(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("combobox", { name: "Rok" }), { target: { value: "2024" } });
    expect(window.location.search).toBe("?rok=2024");
    // 2024 bez kwot NFZ: bez kolumny kwoty i zmiany.
    expect(within(table().getByRole("link", { name: "A01" }).closest("tr")!).getAllByRole("cell")[1]).toHaveTextContent("15");
    expect(table().queryByRole("columnheader", { name: /NFZ/ })).not.toBeInTheDocument();
  });

  it("„Co leczy i za ile?”: 10 grup i „Pokaż wszystkie”; sortowanie po kwocie NFZ", () => {
    const many = { ...rich, groups: [...rich.groups, ...Array.from({ length: 12 }, (_, i) => [`B${String(i + 1).padStart(2, "0")}`, `INNA ${i + 1}`, [1, 1], [9, 9], [9, 9], [0, 100_000 * (i + 1)], [0, 0], [10, 10], [0, 0], [0, 1_000_000]] as (typeof data.groups)[number])] };
    render(<HospitalPage data={many} />);
    const section = screen.getByRole("heading", { name: /Co leczy i za ile/ }).closest("section")!;
    expect(within(section).getAllByRole("row")).toHaveLength(11);
    fireEvent.click(within(section).getByRole("button", { name: "Pokaż wszystkie (23)" }));
    expect(within(section).getAllByRole("row")).toHaveLength(24);
    fireEvent.click(within(section).getByRole("button", { name: /^NFZ/ }));
    expect(within(section).getAllByRole("row")[1]).toHaveTextContent("B01");
  });

  it("„Czym dysponuje?”: plakietka sposobu zapłaty z oboma udziałami dla oddziału częściowo w ryczałcie", () => {
    render(<HospitalPage data={data} />);
    const cardiology = screen.getByText("Kardiologia").closest("tr")!;
    expect(within(cardiology).getByText("częściowo ryczałt")).toHaveAttribute("title", "100 hospitalizacji oddziału: 60% w ryczałcie · 40% za wykonanie");
    expect(within(screen.getByText("Wewnętrzny").closest("tr")!).getByText("ryczałt")).toBeInTheDocument();
  });

  it("rok bez kwot NFZ: „Kwota NFZ” wyłączona, wykres koncentracji pokazuje hospitalizacje; łóżka ze stanem rejestru", () => {
    render(<HospitalPage data={rich} />);
    expect(screen.getByText("Łóżka (stan 2026)")).toBeInTheDocument();
    expect(screen.getByText("2 oddziały i pododdziały")).toBeInTheDocument();
    fireEvent.change(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("combobox", { name: "Rok" }), { target: { value: "2024" } });
    const concentration = screen.getByRole("heading", { name: /Ile grup daje większość/ }).closest("section")!;
    expect(within(concentration).getByRole("button", { name: "Kwota NFZ" })).toBeDisabled();
    expect(within(concentration).getByRole("button", { name: "Hospitalizacje" })).toHaveAttribute("aria-pressed", "true");
  });

  it("szpital bez hospitalizacji w najnowszym roku: lista tylko lat z danymi, domyślnie ostatni z nich", () => {
    const ended = { ...data, monthly: { ...data.monthly, hospitalizations: data.monthly.hospitalizations.map((value, i) => i >= 12 ? 0 : value) } };
    render(<HospitalPage data={ended} />);
    const select = within(screen.getByRole("group", { name: "Rok karty" })).getByRole("combobox", { name: "Rok" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["2024"]);
    expect(select).toHaveValue("2024");
    expect(screen.getByText("Hospitalizacje 2024")).toBeInTheDocument();
  });

  it("„Ile?” domyślnie w latach; miesiące zapisuje adres", () => {
    render(<HospitalPage data={data} />);
    expect(screen.getByRole("heading", { name: /Ile\?/ })).toHaveTextContent("Hospitalizacje rocznie");
    fireEvent.click(screen.getByRole("button", { name: "Miesiące" }));
    expect(window.location.search).toBe("?okres=miesiace");
  });

  it("„Ile grup daje większość?”: suwak liczby grup i odpowiedź w zdaniu", () => {
    render(<HospitalPage data={rich} />);
    const section = screen.getByRole("heading", { name: /Ile grup daje większość/ }).closest("section")!;
    expect(section).toHaveTextContent("kodów JGP z 11 dają");
    expect(within(section).getByRole("slider")).toHaveAttribute("aria-valuemax", "11");
    fireEvent.click(within(section).getByRole("button", { name: "Hospitalizacje" }));
    expect(section).toHaveTextContent("hospitalizacji");
  });

  it("mała placówka: bez „Ile grup daje większość?” (najwyżej 10 grup) i bez „Jak długo leżą?” (mniej niż 5 lat z danymi)", () => {
    render(<HospitalPage data={data} />);
    expect(screen.queryByRole("heading", { name: /Ile grup daje większość/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Jak długo leżą/ })).not.toBeInTheDocument();
  });

  it("„Jak długo leżą?” od 5 lat z hospitalizacjami", () => {
    const years = ["2021", "2022", "2023", "2024", "2025"];
    const months = years.flatMap((year) => Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, "0")}`));
    const series = months.map(() => 1);
    render(<HospitalPage data={{ ...data, years, months, monthly: { hospitalizations: series, deaths: series.map(() => 0), urgent: series }, network: null, durations: { labels: data.durations.labels, values: years.map(() => [1, 1, 1]) } }} />);
    expect(screen.getByRole("heading", { name: /Jak długo leżą/ })).toBeInTheDocument();
  });

  it("„Czym dysponuje?”: jasny komunikat bez profilu RPWDL i bez danych o sposobie zapłaty", () => {
    const { unmount } = render(<HospitalPage data={{ ...data, wards: [], beds: null }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Brak danych o oddziałach i łóżkach.");
    unmount();
    render(<HospitalPage data={{ ...data, wardPayment: null }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Brak danych o sposobie zapłaty NFZ w 2025 r.");
  });

  it("śmiertelność szpitala sieci: kropkowana linia odniesienia „Sieć PSZ”; KPI z udziałem sieci", async () => {
    render(<HospitalPage data={data} />);
    expect(screen.getByText(/sieć PSZ \d/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("heading", { name: /Ile\?/ }).closest("section")!).getByRole("button", { name: "Śmiertelność" }));
    await waitFor(() => expect((react.mock.calls.at(-1)?.[1] as Trace[] | undefined)?.some((trace) => trace.name === "Sieć PSZ")).toBe(true));
    const traces = react.mock.calls.at(-1)![1] as unknown as Trace[];
    const reference = traces.find((trace) => trace.name === "Sieć PSZ" && trace.line);
    expect(reference?.line?.dash).toBe("dot");
    expect(screen.getByRole("list", { name: "Linie wykresu" })).toHaveTextContent("Sieć PSZ (wszystkie szpitale sieci w Polsce)");
  });

  it("szpital spoza sieci: bez linii odniesienia i bez udziału sieci w KPI", async () => {
    render(<HospitalPage data={{ ...data, pszLevel: null, network: null }} />);
    expect(screen.queryByText(/sieć PSZ \d/)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("heading", { name: /Ile\?/ }).closest("section")!).getByRole("button", { name: "Śmiertelność" }));
    await waitFor(() => expect((react.mock.calls.at(-1)?.[1] as Trace[] | undefined)?.some((trace) => trace.name?.startsWith("SZPITAL ALFA"))).toBe(true));
    expect((react.mock.calls.at(-1)![1] as unknown as Trace[]).some((trace) => trace.name?.startsWith("Sieć PSZ"))).toBe(false);
    expect(screen.queryByRole("list", { name: "Linie wykresu" })).not.toBeInTheDocument();
  });

  describe("zakładka Finanse", () => {
    const finance = buildHospitalFinance(contractsFixture, paymentFixture, { nip: "111", years: [{ year: 2025, revenue: 200_000_000, net_result: 5_000_000, net_margin: null }] }, data.years)!;
    const withFinance = { ...data, finance };

    it("bez danych umów: Finanse i Porównanie zapowiedziane, bez zakładki Grupy JGP", () => {
      render(<HospitalPage data={data} />);
      expect(screen.getByRole("tab", { name: /Finanse/ })).toHaveAttribute("aria-disabled", "true");
      expect(screen.queryByRole("tab", { name: /Grupy JGP/ })).not.toBeInTheDocument();
    });

    it("zakładka w adresie (widok=finanse); pięć sekcji od ogółu do szczegółu", () => {
      render(<HospitalPage data={withFinance} />);
      fireEvent.click(screen.getByRole("tab", { name: "Finanse" }));
      expect(window.location.search).toBe("?widok=finanse");
      expect(screen.getByRole("tab", { name: "Finanse" })).toHaveAttribute("aria-selected", "true");
      for (const question of ["Ile NFZ płaci szpitalowi?", "Za co płaci NFZ?", "Ile grup JGP idzie przez ryczałt?", "Jak NFZ płaci za oddziały?", "Gdzie są pieniądze?"]) {
        expect(screen.getByRole("heading", { name: new RegExp(question.replace("?", "\\?")) })).toBeInTheDocument();
      }
      // Umowy 2025: 170 mln zł, +97,7% r/r; umowy to 85% przychodów.
      expect(screen.getByText("Umowy z NFZ 2025").nextSibling).toHaveTextContent("170 mln zł");
      expect(screen.getByText("Umowy z NFZ / przychody").nextSibling).toHaveTextContent("85%");
      fireEvent.click(screen.getByRole("tab", { name: "Przegląd" }));
      expect(window.location.search).toBe("");
    });

    it("„Za co płaci NFZ?”: rozwinięcie pozycji pokazuje pozycje planu i grupy JGP; kliknięcie słupka zmienia rok", () => {
      window.history.replaceState(null, "", "/szpitale/111?widok=finanse");
      render(<HospitalPage data={withFinance} />);
      const section = screen.getByRole("heading", { name: /Za co płaci NFZ/ }).closest("section")!;
      fireEvent.click(within(section).getByRole("button", { name: /Kardiologia inwazyjna/ }));
      expect(within(section).getByText("Kardiologia - hospitalizacja E10, E11,E12G ,E15")).toBeInTheDocument();
      expect(within(section).getByRole("link", { name: "E10" })).toHaveAttribute("href", "/jgp/E10?osrodek=16%7C111");
      fireEvent.click(screen.getByRole("button", { name: /^2024: razem 86/ }));
      const params = new URLSearchParams(window.location.search);
      expect([params.get("rok"), params.get("widok")]).toEqual(["2024", "finanse"]);
      // 2024 bez zestawienia świadczeń: sekcje oddziałów i sekcji JGP mówią, od kiedy są rozliczenia.
      expect(screen.getAllByText(/Brak rozliczeń grup JGP w 2024 r\./)).toHaveLength(3);
    });

    it("„Jak rósł ryczałt?”: szpital wobec średniej swojego poziomu sieci; dymek z kwotą i zmianą r/r; bez indeksu — bez sekcji", () => {
      window.history.replaceState(null, "", "/szpitale/111?widok=finanse");
      const lumpIndex = { baseYear: "2024", ownValues: [93_800_000, 184_100_000], own: [100, 196], level: "III stopnia", levelMean: [100, 216], levelCount: [63, 63], allMean: [100, 229], allCount: [554, 554] };
      const { unmount } = render(<HospitalPage data={{ ...withFinance, finance: { ...finance, lumpIndex } }} />);
      const section = screen.getByRole("heading", { name: /Jak rósł ryczałt/ }).closest("section")!;
      // Pierwsza sekcja zakładki.
      expect(within(screen.getByRole("tabpanel")).getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("Jak rósł ryczałt?");
      expect(section).toHaveTextContent("W 2025 r. ryczałt szpitala to 184 mln zł, czyli 196 (2024 = 100): wzrost o 96%.");
      expect(section).toHaveTextContent("Średnia 63 szpitali PSZ III stopnia: 216, czyli ryczałt szpitala wzrósł o 20 pkt mniej niż średnia szpitali PSZ III stopnia.");
      const year = within(section).getByRole("button", { name: "2025: Ten szpital 196, Średnia szpitali PSZ III stopnia 216, Średnia sieci PSZ 229" });
      expect(year).toHaveAttribute("aria-pressed", "true");
      fireEvent.mouseEnter(year);
      const tooltip = within(section).getByRole("tooltip");
      expect(tooltip).toHaveTextContent("Ten szpital: 196 · 184 mln zł · +96,0% r/r");
      expect(tooltip).toHaveTextContent("Średnia szpitali PSZ III stopnia: 216 · +116,0% r/r");
      expect(tooltip).toHaveTextContent("Średnia sieci PSZ: 229 · +129,0% r/r");
      unmount();
      render(<HospitalPage data={withFinance} />);
      expect(screen.queryByRole("heading", { name: /Jak rósł ryczałt/ })).not.toBeInTheDocument();
    });

    it("„Jak NFZ płaci za oddziały?”: podział słowami i zakresy po rozwinięciu", () => {
      window.history.replaceState(null, "", "/szpitale/111?widok=finanse");
      render(<HospitalPage data={withFinance} />);
      const section = screen.getByRole("heading", { name: /Jak NFZ płaci za oddziały/ }).closest("section")!;
      const cardiology = within(section).getByRole("button", { name: /Kardiologia/ }).closest("tr")!;
      expect(cardiology).toHaveTextContent("81% ryczałt · 19% za wykonanie");
      fireEvent.click(within(cardiology).getByRole("button", { name: /Kardiologia/ }));
      expect(within(section).getByText("zakres 03.4100.130.02")).toBeInTheDocument();
    });
  });
});
