/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JgpPage } from "@/components/jgp/JgpPage";
import { buildJgpPageData } from "@/lib/jgpPage";
import { extrasFixture } from "@/lib/__tests__/fixtures/jgpCardFixture";
import { latestDatasetFixture, trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

// Wykresy Plotly zastępujemy przyciskami: test sprawdza linie i wybór ośrodka.
vi.mock("@/components/jgp/GroupLineChart", () => ({
  GroupLineChart: ({ lines, onSelect, onHover, note, period }: { lines: { key: string; name: string; values: number[]; base?: number[]; tone?: string }[]; onSelect?: (key: string) => void; onHover?: (key: string | null) => void; note?: string; period?: string }) => <ul aria-label="Linie wykresu" data-note={note ?? ""} data-period={period ?? "month"}>
    {lines.map((line) => <li key={line.key} data-tone={line.tone ?? ""} data-base={line.base ? "tak" : ""}>
      <button type="button" onClick={() => onSelect?.(line.key)} onMouseEnter={() => onHover?.(line.key)} onMouseLeave={() => onHover?.(null)}>{line.name}: {line.values.reduce((a, b) => a + b, 0)}</button>
    </li>)}
  </ul>,
}));
vi.mock("@/components/jgp/ProviderScatter", () => ({
  STAR_COLOR: "#D92D20",
  ProviderScatter: ({ points, ariaLabel, curves }: { points: { key: string; name: string; color?: string; label?: string }[]; ariaLabel: string; curves?: unknown[] }) => <div role="group" aria-label={ariaLabel} data-curves={curves?.length ?? 0}>
    {points.map((point) => <span key={point.key} data-color={point.color ?? ""} data-label={point.label ?? ""}>{point.name}</span>)}
  </div>,
}));

const data = buildJgpPageData(trendsFixture, latestDatasetFixture, "A01", "min", 15, extrasFixture)!;
const open = (search = "") => window.history.replaceState(null, "", `/jgp/A01${search}`);
const renderCard = () => render(<JgpPage data={data} />);

beforeEach(() => open());
afterEach(cleanup);

describe("Karta w zakładkach — nagłówek i Przegląd", () => {
  it("pasek zakładek ma kod i nazwę grupy (widoczne po przewinięciu nagłówka karty)", () => {
    const { container } = renderCard();
    const title = container.querySelector('[role="tablist"]')!.previousElementSibling!;
    expect(title).toHaveTextContent(`A01 ${data.name}`);
    expect(title).toHaveAttribute("aria-hidden", "true");
  });

  it("nagłówek ma cztery liczby 2×2 i obszar", () => {
    const { container } = renderCard();
    const kpis = container.querySelector('dl[aria-label="Liczby grupy"]')!;
    expect(kpis.children).toHaveLength(4);
    expect(kpis).toHaveTextContent("Hospitalizacje 202530+100,0% r/r");
    expect(kpis).toHaveTextContent("Kwota świadczeń NFZ 20251,2 mln zł+33,3% r/r");
    expect(screen.getByText("cała Polska · kliknij województwo na mapie")).toBeInTheDocument();
  });

  it("Przegląd ma sekcje-pytania w kolejności Ile? → Gdzie? → Za ile? → Jak przyjmowani?", () => {
    renderCard();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.split(" ")[0])).toEqual(["Ile?", "Gdzie?", "Za", "Jak"]);
    expect(within(panel).getByRole("region", { name: "Mapa ciepła: województwa w latach" })).toBeInTheDocument();
  });

  it("„Za ile?” ma wycenę i kwotę, bez średniej na hospitalizację; obok tryb przyjęcia bez śmiertelności", () => {
    renderCard();
    const panel = screen.getByRole("tabpanel");
    const cost = within(panel).getByRole("region", { name: /Za ile\?/ });
    const profile = within(panel).getByRole("region", { name: /Jak przyjmowani/ });
    expect(cost).toHaveTextContent("Kwota świadczeń 2025");
    expect(cost).not.toHaveTextContent("Średnio na hospitalizację");
    expect(cost).not.toHaveTextContent(/\d zł(?! )/);
    expect(cost.parentElement).toBe(profile.parentElement);
    expect(within(profile).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Rok", "Struktura przyjęć", "Nagłe", "Planowe"]);
  });

  it("mapa ciepła podaje liczby na 100 tys. bez miejsc dziesiętnych", () => {
    renderCard();
    const heat = screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" });
    const cells = within(heat).getAllByRole("button", { name: /^\d[\d\s\u00a0]*$/ });
    expect(cells.length).toBeGreaterThan(0);
    expect(within(heat).queryAllByRole("button", { name: /\d,\d/ })).toEqual([]);
  });

  it("kliknięcie województwa w tabeli lat zawęża kartę i trafia do adresu", () => {
    renderCard();
    const heat = screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" });
    fireEvent.click(within(heat).getByRole("button", { name: "Mazowieckie" }));
    expect(window.location.search).toBe("?ow=07");
    expect(screen.getByRole("button", { name: "woj. mazowieckie ✕" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveTextContent("Ośrodki1");
  });
});

describe("Karta w zakładkach — Ośrodki", () => {
  it("zakładka zapisuje się w adresie jako widok=osrodki", () => {
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: /Ośrodki/ }));
    expect(window.location.search).toBe("?widok=osrodki");
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("list", { name: "Linie wykresu" })).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(["1. Szpital Beta: 28", "2. Szpital Alfa: 17"]);
  });

  it("najechanie na linię pokazuje pasek ośrodka, kliknięcie go wybiera; Szczegóły rozwijają porównanie", () => {
    open("?widok=osrodki");
    renderCard();
    expect(screen.getByText(/Najedź na linię albo wiersz rankingu/)).toBeInTheDocument();
    const alfa = screen.getByRole("button", { name: "2. Szpital Alfa: 17" });
    fireEvent.mouseEnter(alfa);
    expect(screen.getByText("kliknij, żeby wybrać")).toBeInTheDocument();
    fireEvent.click(alfa);
    fireEvent.mouseLeave(alfa);
    expect(window.location.search).toBe("?osrodek=07%7C111");
    expect(screen.queryByRole("region", { name: "Szczegóły wybranego ośrodka" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Szczegóły" }));
    expect(screen.getByRole("region", { name: "Szczegóły wybranego ośrodka" })).toHaveTextContent("Rozliczenia NFZ za A010,5 mln zł41,7% kraju");
    fireEvent.click(screen.getByRole("button", { name: "Usuń wybór" }));
    expect(window.location.search).toBe("?widok=osrodki");
  });

  it("link z wybranym ośrodkiem otwiera zakładkę Ośrodki", () => {
    open("?osrodek=12%7C222");
    renderCard();
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("list", { name: "Linie wykresu" }).querySelector('[data-tone="selected"]')).toHaveTextContent("Szpital Beta");
  });

  it("ranking: struktura, kliknięcie wiersza wybiera ośrodek", () => {
    open("?widok=osrodki");
    renderCard();
    expect(screen.getByRole("img", { name: /3 największe: 100,0%/ })).toBeInTheDocument();
    const rows = within(screen.getByRole("region", { name: /^Lista ośrodków/ })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[1]);
    expect(window.location.search).toBe("?osrodek=07%7C111");
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
  });

  it("Jak leczą?: przy mniej niż 30 zgonach śmiertelność jako punkty bez granic lejka", () => {
    open("?widok=osrodki");
    renderCard();
    expect(screen.getByRole("group", { name: /udział przyjęć nagłych/ })).toBeInTheDocument();
    const mortality = screen.getByRole("group", { name: /Wykres punktowy: 2 ośrodków, śmiertelność/ });
    expect(mortality).toHaveAttribute("data-curves", "0");
    expect(within(mortality).getAllByText(/Szpital/)).toHaveLength(2);
    expect(screen.queryByRole("group", { name: /Wykres lejkowy/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Bez granic lejka/)).toBeInTheDocument();
  });

  it("Jak leczą? przy wybranym województwie: wszystkie ośrodki, wybrane w kolorze, reszta szara", () => {
    open("?widok=osrodki&ow=07");
    renderCard();
    const urgent = screen.getByRole("group", { name: /udział przyjęć nagłych/ });
    expect(within(urgent).getByText("Szpital Alfa")).toHaveAttribute("data-color", "#7B3FA0");
    expect(within(urgent).getByText("Szpital Beta").getAttribute("data-color")).toMatch(/^rgba\(152/);
    expect(screen.getByRole("list", { name: "Legenda województw" })).toHaveTextContent("mazowieckiepozostałe ośrodki");
  });
});

describe("Karta w zakładkach — wybór roku, opis i rodzina", () => {
  it("rok na pasku zmienia liczby i ranking oraz trafia do adresu", () => {
    const { container } = renderCard();
    fireEvent.click(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("button", { name: "2024" }));
    expect(window.location.search).toBe("?rok=2024");
    expect(container.querySelector('dl[aria-label="Liczby grupy"]')).toHaveTextContent("Hospitalizacje 202415");
    fireEvent.click(screen.getByRole("tab", { name: /Ośrodki/ }));
    const rows = within(screen.getByRole("region", { name: /^Lista ośrodków/ })).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[2].textContent)).toEqual(["10", "5"]);
    fireEvent.click(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("button", { name: "2025" }));
    expect(window.location.search).toBe("?widok=osrodki");
  });

  it("odczytuje rok z adresu i ignoruje rok spoza danych", () => {
    open("?rok=2024");
    renderCard();
    expect(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("button", { name: "2024" })).toHaveAttribute("aria-pressed", "true");
    cleanup();
    open("?rok=1999");
    renderCard();
    expect(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("button", { name: "2025" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opis redakcyjny i sekcja rodziny z udziałami w latach", () => {
    const withFamily = { ...data, description: "Opis grupy testowej.", family: { id: "t", name: "Rodzina testowa", variants: [
      { code: "A01", name: "STAŁY PRODUKT", values: [8, 8, 9] },
      { code: "A02", name: "INNY WARIANT", values: [2, 8, 1] },
    ] } };
    render(<JgpPage data={withFamily} />);
    expect(screen.getByText(/Opis grupy testowej\./)).toHaveTextContent("opis redakcyjny");
    const section = screen.getByRole("region", { name: /Jak wygląda rodzina\?/ });
    expect(section).toHaveTextContent("A01 to 90% hospitalizacji rodziny w 2025 r. (w 2023 r.: 80%)");
    expect(within(section).getByRole("img", { name: "2024: A01 50,0%, A02 50,0%" })).toBeInTheDocument();
  });
});

describe("Karta w zakładkach — Gdzie?", () => {
  const heat = () => screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" });

  it("kliknięcie roku w mapie ciepła zmienia rok mapy i karty", () => {
    renderCard();
    fireEvent.click(within(heat()).getByRole("button", { name: "2024" }));
    expect(window.location.search).toBe("?rok=2024");
    expect(within(heat()).getByRole("button", { name: "2024" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /Gdzie\?.*mapa 2024/ })).toBeInTheDocument();
  });

  it("kliknięcie komórki wybiera rok i województwo; przycisk prowadzi do Ośrodków, drugi czyści wybór", () => {
    renderCard();
    const row = within(heat()).getByRole("button", { name: "Mazowieckie" }).closest("tr")!;
    fireEvent.click(within(row).getAllByRole("button")[1]);
    expect(window.location.search).toBe("?ow=07&rok=2024");
    expect(screen.getByText(/Wybrane:/)).toHaveTextContent("Wybrane: mazowieckie · 1 ośrodków");
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść wybór (1)" }));
    expect(window.location.search).toBe("?rok=2024");
    fireEvent.click(within(row).getAllByRole("button")[2]);
    fireEvent.click(screen.getByRole("button", { name: "Ośrodki w województwie mazowieckie →" }));
    expect(screen.getByRole("tab", { name: /Ośrodki/ })).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?widok=osrodki&ow=07");
  });
});

describe("Karta w zakładkach — wybrany ośrodek przy wybranych województwach", () => {
  it("gwiazdka w tabeli i legendzie, bez podpisu na wykresie; województwa w kolorach mapy", () => {
    open("?osrodek=07%7C111&ow=07&ow=12");
    renderCard();
    const rows = within(screen.getByRole("region", { name: /^Lista ośrodków/ })).getAllByRole("row").slice(1);
    const alfa = rows.find((row) => row.textContent?.includes("Szpital Alfa"))!;
    expect(within(alfa).getByLabelText("wybrany ośrodek")).toHaveTextContent("★");
    expect(screen.getByRole("list", { name: "Legenda województw" })).toHaveTextContent("★wybrany ośrodek: Szpital Alfa");
    const urgent = screen.getByRole("group", { name: /udział przyjęć nagłych/ });
    expect(within(urgent).getByText("Szpital Alfa")).toHaveAttribute("data-label", "");
    expect(within(urgent).getByText("Szpital Beta")).toHaveAttribute("data-color", "#1A9850");
    const lines = screen.getByRole("list", { name: "Linie wykresu" });
    expect(lines.querySelector('[data-tone="selected"]')).toHaveTextContent("Szpital Alfa");
  });
});

describe("Karta w zakładkach — zmiana województw a wybrany ośrodek", () => {
  it("ośrodek przestaje być wybrany, gdy jego województwo przestaje być aktywne", () => {
    open("?osrodek=07%7C111&ow=07");
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: /Przegląd/ }));
    const heat = screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" });
    fireEvent.click(within(heat).getByRole("button", { name: "Mazowieckie" }));
    fireEvent.click(within(heat).getByRole("button", { name: "Śląskie" }));
    expect(window.location.search).toBe("?ow=12");
    cleanup();
    open("?osrodek=07%7C111&ow=07");
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: /Przegląd/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść wybór (1)" }));
    expect(window.location.search).toBe("");
    cleanup();
    // Odznaczenie województwa ośrodka (bez wyboru innego) też go odznacza.
    open("?osrodek=07%7C111&ow=07");
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: /Przegląd/ }));
    fireEvent.click(within(screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" })).getByRole("button", { name: "Mazowieckie" }));
    expect(window.location.search).toBe("");
    cleanup();
    // Ośrodek wybrany bez filtra województw zostaje, gdy dodajemy jego województwo.
    open("?osrodek=07%7C111");
    renderCard();
    fireEvent.click(screen.getByRole("tab", { name: /Przegląd/ }));
    fireEvent.click(within(screen.getByRole("region", { name: "Mapa ciepła: województwa w latach" })).getByRole("button", { name: "Mazowieckie" }));
    expect(window.location.search).toBe("?osrodek=07%7C111&ow=07");
  });
});

describe("Karta w zakładkach — miary w „Ile?”", () => {
  it("przycisk miary zmienia tytuł sekcji; śmiertelność i % nagłych to udziały (mianownik = hospitalizacje)", () => {
    renderCard();
    const heading = () => screen.getByRole("heading", { level: 2, name: /^Ile\?/ });
    const chart = () => screen.getByRole("list", { name: "Linie wykresu" });
    expect(heading()).toHaveTextContent("Ile? Hospitalizacje miesięcznie, wszystkie lata");
    expect(chart().querySelector("li")).toHaveAttribute("data-base", "");
    const group = screen.getByRole("group", { name: "Miara" });
    fireEvent.click(within(group).getByRole("button", { name: "Śmiertelność" }));
    expect(heading()).toHaveTextContent("Ile? Śmiertelność miesięcznie, wszystkie lata");
    expect(chart().querySelector("li")).toHaveAttribute("data-base", "tak");
    expect(chart()).toHaveAttribute("data-note", expect.stringContaining("Zgony w szpitalu / hospitalizacje"));
    fireEvent.click(within(group).getByRole("button", { name: "% nagłych" }));
    expect(heading()).toHaveTextContent("Ile? Udział przyjęć nagłych miesięcznie, wszystkie lata");
    expect(screen.getByRole("button", { name: "% nagłych" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Karta w zakładkach — okres w „Ile?” (miesiące albo lata)", () => {
  it("przełącznik w nagłówku sekcji zmienia okres wykresu, tytuł i objaśnienie; okres zostaje po zmianie zakładki", () => {
    renderCard();
    const heading = () => screen.getByRole("heading", { level: 2, name: /^Ile\?/ });
    const chart = () => screen.getByRole("list", { name: "Linie wykresu" });
    const toggle = () => screen.getByRole("group", { name: "Okres na wykresie" });
    expect(chart()).toHaveAttribute("data-period", "month");
    expect(within(toggle()).getByRole("button", { name: "Miesiące" })).toHaveAttribute("aria-pressed", "true");
    // Przełącznik stoi w nagłówku sekcji, w miejscu etykiety zakresu (bez dodatkowego wiersza nad wykresem).
    expect(heading().parentElement).toContainElement(toggle());
    fireEvent.click(within(toggle()).getByRole("button", { name: "Lata" }));
    expect(chart()).toHaveAttribute("data-period", "year");
    expect(window.location.search).toBe("?okres=lata");
    expect(heading()).toHaveTextContent("Ile? Hospitalizacje rocznie, wszystkie lata");
    expect(chart()).toHaveAttribute("data-note", expect.stringContaining("Kropka = suma roku"));
    fireEvent.click(screen.getByRole("tab", { name: /Ośrodki/ }));
    expect(chart()).toHaveAttribute("data-period", "year");
    expect(heading()).toHaveTextContent(/^Ile\? Hospitalizacje rocznie, \d+ największych ośrodków/);
    fireEvent.click(within(toggle()).getByRole("button", { name: "Miesiące" }));
    expect(chart()).toHaveAttribute("data-period", "month");
    expect(window.location.search).toBe("?widok=osrodki");
  });

  it("odczytuje okres z adresu (`okres=lata`) i ignoruje nieznaną wartość", () => {
    open("?okres=lata");
    renderCard();
    expect(screen.getByRole("list", { name: "Linie wykresu" })).toHaveAttribute("data-period", "year");
    cleanup();
    open("?okres=tygodnie");
    renderCard();
    expect(screen.getByRole("list", { name: "Linie wykresu" })).toHaveAttribute("data-period", "month");
  });
});

describe("Karta w zakładkach — linie województw w „Ile?”", () => {
  it("nie zmieniają się po zmianie roku (wszystkie lata, ośrodki ze wszystkich lat)", () => {
    open("?ow=07");
    renderCard();
    const before = screen.getByRole("list", { name: "Linie wykresu" }).textContent;
    fireEvent.click(within(screen.getByRole("group", { name: "Rok karty" })).getByRole("button", { name: "2024" }));
    expect(screen.getByRole("list", { name: "Linie wykresu" }).textContent).toBe(before);
    expect(before).toBe("Mazowieckie: 17");
  });
});
