/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HomePage } from "@/components/portal/HomePage";

const highlights = { analysisYear: "2025", hospitalizations: 7_832_118, providers: 833, jgpGroups: 693 };

afterEach(cleanup);

describe("Strona główna", () => {
  it("pokazuje hero z jedną akcją prowadzącą do sekcji tematów", () => {
    render(<HomePage highlights={highlights} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Polskie szpitalnictwo");
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#odkrywaj"]);
    expect(screen.getByRole("img", { name: "Ilustracja: korytarz szpitala" })).toBeInTheDocument();
  });

  it("pokazuje w pasku faktów liczby z danych, a nie same etykiety", () => {
    render(<HomePage highlights={highlights} />);
    const facts = screen.getByRole("region", { name: "Informacje o danych" });
    expect(facts).toHaveTextContent("2025Rok danych NFZ");
    expect(facts).toHaveTextContent("7,8 mlnHospitalizacji (szacunek)");
    expect(facts).toHaveTextContent("833Świadczeniodawców");
    expect(facts).toHaveTextContent("693Grup JGP");
  });

  it("kieruje kafle tematów do działających podstron dashboardu", () => {
    render(<HomePage highlights={highlights} />);
    const discover = screen.getByRole("region", { name: "Co chcesz sprawdzić?" });
    expect(within(discover).getByRole("link", { name: "Analizuj śmiertelność" })).toHaveAttribute("href", "/analizy");
    expect(within(discover).getByRole("link", { name: "Analizuj hospitalizacje" })).toHaveAttribute("href", "/analizy?t=a");
    expect(within(discover).getByRole("link", { name: "Znajdź szpital" })).toHaveAttribute("href", "/analizy?t=h");
    expect(within(discover).getByRole("link", { name: "Porównaj szpitale" })).toHaveAttribute("href", "/analizy?t=h&hv=c");
    expect(within(discover).queryByText("Planowane")).not.toBeInTheDocument();
  });

  it("ma jedno wejście do dashboardu poza kaflami i nie linkuje do zewnętrznych licencji", () => {
    render(<HomePage highlights={highlights} />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(screen.getAllByRole("link", { name: /analiz/i }).filter((link) => link.getAttribute("href") === "/analizy")).toHaveLength(2);
    expect(hrefs.filter((href) => href.startsWith("http"))).toEqual([]);
    expect(hrefs.filter((href) => href.startsWith("/szpitale") || href.startsWith("/porownaj"))).toEqual([]);
    expect(screen.getByRole("link", { name: "Metodologia" })).toHaveAttribute("href", "/analizy?t=m");
  });
});
