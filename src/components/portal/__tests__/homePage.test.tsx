/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HomePage } from "@/components/portal/HomePage";

const highlights = { yearFrom: "2025", yearTo: "2025", hospitalizations: 7_832_118, providers: 833, jgpGroups: 693 };

afterEach(cleanup);

describe("Strona główna", () => {
  it("pokazuje hero z jedną akcją prowadzącą do sekcji tematów", () => {
    render(<HomePage highlights={highlights} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Publiczna ochronazdrowia w liczbach.");
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#odkrywaj"]);
    expect(screen.getByRole("img", { name: /szpital, rozliczenie z NFZ, kontrola/ })).toBeInTheDocument();
  });

  it("pokazuje w pasku faktów liczby z danych, a nie same etykiety", () => {
    render(<HomePage highlights={highlights} />);
    const facts = screen.getByRole("region", { name: "Informacje o danych" });
    expect(facts).toHaveTextContent("2025Zakres danych NFZ");
    expect(facts).toHaveTextContent("7,8 mlnHospitalizacji (szacunek)");
    expect(facts).toHaveTextContent("833Świadczeniodawców");
    expect(facts).toHaveTextContent("693Grup JGP");
  });

  it("pokazuje zakres lat, gdy zbiór obejmie historię", () => {
    render(<HomePage highlights={{ ...highlights, yearFrom: "2019" }} />);
    expect(screen.getByRole("region", { name: "Informacje o danych" })).toHaveTextContent("2019–2025Zakres danych NFZ");
  });

  it("kieruje kafle działających modułów do podstron dashboardu", () => {
    render(<HomePage highlights={highlights} />);
    const discover = screen.getByRole("region", { name: "Co chcesz sprawdzić?" });
    expect(within(discover).getByRole("link", { name: "Analizuj hospitalizacje" })).toHaveAttribute("href", "/analizy");
    expect(within(discover).getByRole("link", { name: "Analizuj tryb przyjęcia" })).toHaveAttribute("href", "/analizy?t=a");
    expect(within(discover).getByRole("link", { name: "Znajdź szpital" })).toHaveAttribute("href", "/analizy?t=h");
    expect(within(discover).getByRole("link", { name: "Porównaj szpitale" })).toHaveAttribute("href", "/analizy?t=h&hv=c");
  });

  it("pokazuje wyceny JGP i artykuły jako moduły planowane, bez linków", () => {
    render(<HomePage highlights={highlights} />);
    const discover = screen.getByRole("region", { name: "Co chcesz sprawdzić?" });
    for (const name of ["Wyceny JGP", "Artykuły"]) {
      const tile = within(discover).getByRole("article", { name: `${name} — planowane` });
      expect(tile).toHaveTextContent("Planowane");
      expect(within(tile).queryByRole("link")).not.toBeInTheDocument();
    }
    expect(within(discover).getAllByText("Planowane")).toHaveLength(2);
  });

  it("ma jedno wejście do dashboardu poza kaflami i nie linkuje do zewnętrznych licencji", () => {
    render(<HomePage highlights={highlights} />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "/analizy")).toHaveLength(2);
    expect(hrefs.filter((href) => href.startsWith("http"))).toEqual([]);
    expect(hrefs.filter((href) => href.startsWith("/szpitale") || href.startsWith("/porownaj"))).toEqual([]);
    expect(screen.getByRole("link", { name: "Metodologia" })).toHaveAttribute("href", "/analizy?t=m");
  });
});
