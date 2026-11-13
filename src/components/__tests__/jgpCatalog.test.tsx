/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { JgpCatalogPage } from "@/components/jgp/JgpCatalogPage";
import { Sparkline } from "@/components/jgp/JgpCatalog";
import { buildJgpCatalog } from "@/lib/jgpCatalog";
import { trendsFixture } from "@/lib/__tests__/fixtures/trendsFixture";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/jgp");
});

const catalog = buildJgpCatalog(trendsFixture);
const codes = () => within(screen.getByRole("region", { name: "Grupy JGP" })).getAllByRole("row").slice(2)
  // Pierwszy link w wierszu to kod grupy (kod i nazwa są w jednej komórce).
  .map((row) => within(row).getAllByRole("link")[0].textContent);

describe("Katalog grup JGP", () => {
  it("pokazuje grupy z najnowszego roku z linkami do kart; wycofane po zaznaczeniu", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Grupy JGP");
    expect(codes()).toEqual(["A01", "F99"]);
    expect(screen.getByRole("link", { name: "A01" })).toHaveAttribute("href", "/jgp/A01");
    fireEvent.click(screen.getByRole("checkbox", { name: /pokaż grupy wycofane \(1\)/i }));
    // Wycofane na górze listy — bez danych w najnowszym roku zniknęłyby na końcu.
    expect(codes()).toEqual(["F04", "A01", "F99"]);
    expect(screen.getByText("do 2024")).toHaveAttribute("title", "Grupa wycofana z katalogu");
  });

  it("pokazuje rozliczenia NFZ i ich zmianę, sortuje po kwocie; bez kwot tych kolumn nie ma", () => {
    render(<JgpCatalogPage catalog={buildJgpCatalog(trendsFixture, { A01: { "2024": 2_000_000_000, "2025": 2_500_000_000 }, F99: { "2025": 3_400_000 } })} />);
    const cells = (code: string) => within(screen.getByRole("link", { name: code }).closest("tr")!).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells("A01").slice(5)).toEqual(["2,5 mld zł", "+25%"]);
    expect(cells("F99").slice(5)).toEqual(["3,4 mln zł", "—"]);
    fireEvent.click(screen.getByRole("button", { name: /^Rozliczenia\s*NFZ 2025$/ }));
    expect(codes()).toEqual(["A01", "F99"]);
    fireEvent.click(screen.getByRole("button", { name: /^Rozliczenia\s*NFZ 2025/ }));
    expect(codes()).toEqual(["F99", "A01"]);
    expect(window.location.search).toBe("?sort=kwota&kier=rosnaco");
    expect(screen.getByRole("button", { name: /^Zmiana\s*od 2024$/ })).toBeInTheDocument();
    cleanup();
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.queryByRole("button", { name: /Rozliczenia/ })).not.toBeInTheDocument();
  });

  it("zakładka Grupy liczy wszystkie grupy, także wycofane", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("tab", { name: /Grupy/ })).toHaveTextContent("Grupy 3");
  });

  it("badge z latami tylko przy kodach, których nie było przez cały okres", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /pokaż grupy wycofane/i }));
    const badge = (code: string) => within(screen.getByRole("link", { name: code }).closest("tr")!).getAllByRole("cell")[0].querySelector("[title]")?.textContent;
    expect(badge("A01")).toBeUndefined();
    expect(badge("F99")).toBe("od 2025");
    expect(badge("F04")).toBe("do 2024");
  });

  it("rozróżnia „—” (grupy nie było w katalogu) od liczby; KPI nowych i wycofanych osobno", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /pokaż grupy wycofane/i }));
    const cells = (code: string) => within(screen.getByRole("link", { name: code }).closest("tr")!).getAllByRole("cell");
    // Kolumny: grupa (kod + nazwa), wykres, 2025, r/r (poprzedni rok w dymku), śmiertelność.
    expect(cells("F99")[2]).toHaveTextContent("1");
    expect(cells("F99")[3]).toHaveAttribute("title", "2024: —");
    expect(cells("F04")[2]).toHaveTextContent("—");
    expect(cells("F04")[3]).toHaveAttribute("title", "2024: 4");
    expect(screen.getByText("Nowe grupy w 2025 r.").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Grupy wycofane").nextElementSibling).toHaveTextContent("1");
  });

  it("zapisuje filtry i sortowanie w adresie i odczytuje je po wejściu", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "f" } });
    fireEvent.click(screen.getByRole("button", { name: "Grupa JGP" }));
    expect(window.location.search).toBe("?q=f&sort=kod");
    cleanup();
    window.history.replaceState(null, "", "/jgp?wycofane=1&sort=kod&kier=malejaco");
    render(<JgpCatalogPage catalog={catalog} />);
    expect(codes()).toEqual(["F99", "F04", "A01"]);
    expect(screen.getByRole("checkbox", { name: /pokaż grupy wycofane/i })).toBeChecked();
  });

  it("„Wyczyść filtry” jest zawsze na miejscu, aktywny przy filtrach; zostawia sortowanie", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).toBeDisabled();
    expect(screen.getByText("Wyświetlono 2 z 2 grup")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grupa JGP" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "staly" } });
    expect(screen.getByText("Wyświetlono 1 z 1 pasujących grup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(window.location.search).toBe("?sort=kod");
  });

  it("listy zmian podają porównywane lata", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("heading", { name: "Największe wzrosty 2024 → 2025" })).toBeInTheDocument();
    expect(screen.getByText(/co najmniej 1\s?000 hospitalizacji w 2024 r\./)).toBeInTheDocument();
  });

  it("przypięty nagłówek tabeli ma tytuł i liczbę wyników na tle wszystkich grup", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    const title = within(screen.getByRole("table")).getAllByRole("row")[0];
    expect(title).toHaveTextContent("Grupy JGP2 z 3");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "staly" } });
    expect(title).toHaveTextContent("Grupy JGP1 z 3");
  });

  it("mini-wykres nie ma przerywanej linii w środku", () => {
    const { container } = render(<JgpCatalogPage catalog={catalog} />);
    expect(container.querySelector("svg line")).toBeNull();
  });

  it("filtruje po kodzie i nazwie bez polskich znaków", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "staly" } });
    expect(codes()).toEqual(["A01"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "f9" } });
    expect(codes()).toEqual(["F99"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
    expect(screen.getByText("Brak grup dla tych filtrów.")).toBeInTheDocument();
  });

  it("sortuje po kliknięciu nagłówka i filtruje minimalną liczbą hospitalizacji", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: "Grupa JGP" }));
    expect(codes()).toEqual(["A01", "F99"]);
    fireEvent.click(screen.getByRole("button", { name: /Grupa JGP/ }));
    expect(codes()).toEqual(["F99", "A01"]);
    fireEvent.change(screen.getByRole("combobox", { name: /Min. hospitalizacji \(2025\)/ }), { target: { value: "100" } });
    expect(screen.getByText("Brak grup dla tych filtrów.")).toBeInTheDocument();
  });

  it("wstęp: jedno zdanie o katalogu i link do artykułu „Czym są grupy JGP?”", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByText(/Przeglądaj wszystkie grupy JGP/)).toBeInTheDocument();
    expect(screen.queryByText(/system klasyfikacji hospitalizacji/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Czym są grupy JGP\? Wyjaśniamy od zera/ })).toHaveAttribute("href", "/artykuly/czym-sa-jgp");
  });

  it("pokazuje zakładkę Rodziny jako planowaną", () => {
    render(<JgpCatalogPage catalog={catalog} />);
    expect(screen.getByRole("tab", { name: /Rodziny/ })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Sparkline", () => {
  const path = (values: (number | null)[]) => render(<Sparkline values={values} />).container.querySelector("path")?.getAttribute("d");

  it("rysuje osobny odcinek dla każdego okresu, gdy kod istniał, na wspólnej osi", () => {
    const d = path([null, 1, 3, null, null, 2, 2])!;
    expect(d.match(/M/g)).toHaveLength(2);
    // Pierwszy punkt w drugim miesiącu (x = 1/6 szerokości), nie na początku osi.
    expect(d.startsWith("M20.0 ")).toBe(true);
  });

  it("pojedynczy miesiąc to krótka kreska; same przerwy — brak linii", () => {
    expect(path([null, 5, null])).toMatch(/^M60\.0 \S+ h0\.01$/);
    cleanup();
    expect(path([null, null])).toBeUndefined();
  });
});
