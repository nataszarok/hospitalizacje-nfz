/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { formatPln, MonthLines, StayShares, ValueBars, ValueRows } from "@/components/summary/SummaryCharts";

afterEach(cleanup);

describe("Wykresy karty „Hospitalizacje w Polsce”", () => {
  it("dopisuje pod rokiem notkę (np. zmianę r/r) w kolorze kierunku", () => {
    const { container } = render(<ValueBars years={["2024", "2025"]} values={[50, 60]} format={String} notes={["", "+20,0%"]} label="Kwoty" />);
    expect(screen.getByRole("img", { name: "Kwoty: 2024 — 50, 2025 — 60 (+20,0%)" })).toBeInTheDocument();
    expect([...container.querySelectorAll("text")].map((t) => t.textContent)).toEqual(["50", "’24", "60", "’25", "+20,0%"]);
  });

  it("opisuje słupki lat w podanym formacie i wyróżnia ostatni rok", () => {
    const { container } = render(<ValueBars years={["2024", "2025"]} values={[2.42, 2.38]} format={(v) => v.toFixed(1)} label="Odsetek zgonów" />);
    expect(screen.getByRole("img", { name: "Odsetek zgonów: 2024 — 2.4, 2025 — 2.4" })).toBeInTheDocument();
    const [previous, latest] = container.querySelectorAll("rect");
    expect(previous.getAttribute("class")).not.toBe(latest.getAttribute("class"));
  });

  it("rysuje linie miesięcy bez miesięcy bez danych; oś zaczyna się od zaokrąglonego minimum", () => {
    const months = [
      { year: "2024", values: [460_000, 470_000, ...Array<null>(10).fill(null)] },
      { year: "2025", values: [480_000, null, 500_000, ...Array<null>(9).fill(null)] },
    ];
    const { container } = render(<MonthLines months={months} />);
    expect(screen.getByRole("img", { name: /2025: sty 480\s000, lut brak, mar 500\s000/ })).toBeInTheDocument();
    const [previous, latest] = container.querySelectorAll("polyline");
    expect(previous.getAttribute("points")!.split(" ")).toHaveLength(2);
    expect(latest.getAttribute("points")!.split(" ")).toHaveLength(2);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect([...container.querySelectorAll("text")].slice(0, 3).map((t) => t.textContent)).toEqual(["450 tys.", "475 tys.", "500 tys."]);
  });

  it("rysuje linię udziału (%) dla każdego przedziału długości pobytu", () => {
    const { container } = render(<StayShares stays={[{ year: "2017", buckets: [10, 20, 30, 40] }, { year: "2025", buckets: [25, 25, 25, 25] }]} />);
    expect(screen.getByRole("img", { name: /0 dni: 2017 10,0%, 2025 25,0%; .*6 i więcej dni: 2017 40,0%, 2025 25,0%/ })).toBeInTheDocument();
    expect(container.querySelectorAll("polyline")).toHaveLength(4);
    const texts = [...container.querySelectorAll("text")].map((t) => t.textContent);
    // Oś do 40% (zaokrąglone w górę do 10 p.p.), podpis końcowy każdej linii.
    expect(texts.slice(0, 5)).toEqual(["0%", "10%", "20%", "30%", "40%"]);
    expect(texts.filter((t) => t === "25%")).toHaveLength(4);
  });

  it("pokazuje tylko wybrane przedziały długości pobytu", () => {
    const { container } = render(<StayShares stays={[{ year: "2017", buckets: [10, 20, 30, 40] }, { year: "2025", buckets: [25, 25, 25, 25] }]} buckets={[0, 3]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Udział hospitalizacji według długości pobytu (%): 0 dni: 2017 10,0%, 2025 25,0%; 6 i więcej dni: 2017 40,0%, 2025 25,0%");
  });

  it("rozsuwa podpisy końcowe linii, które kończą się w tym samym miejscu", () => {
    const { container } = render(<StayShares stays={[{ year: "2024", buckets: [1, 1, 1, 1] }, { year: "2025", buckets: [1, 1, 1, 1] }]} />);
    const ys = [...container.querySelectorAll("text")].filter((t) => t.textContent === "25%").map((t) => Number(t.getAttribute("y"))).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(13);
  });

  it("podaje kwoty od 1 mld zł w miliardach z 2 miejscami, mniejsze w pełnych milionach", () => {
    expect(formatPln(64_277_000_000)).toBe("64,28 mld zł");
    expect(formatPln(1_000_000_000)).toBe("1,00 mld zł");
    expect(formatPln(994_400_000)).toBe("994 mln zł");
    expect(formatPln(12_340_000)).toBe("12 mln zł");
    expect(formatPln(450_400)).toBe("450 tys. zł");
  });

  it("pokazuje kwoty z paskiem względem największej; grupy linkuje do karty", () => {
    const rows = [
      { code: "E53G", label: "NIEWYDOLNOŚĆ KRĄŻENIA", valuePln: 1_494_000_000, hospitalizations: 142_000, perStayPln: 10_521, sharePct: 2.3, changePct: 135.4 },
      { code: "A48", label: "UDAR", valuePln: 747_000_000, hospitalizations: 0, perStayPln: null, sharePct: 1.15, changePct: null },
    ];
    const { container } = render(<ValueRows rows={rows} label="Grupy" firstYear="2019" linkGroups />);
    const [first, second] = screen.getAllByRole("link");
    expect(first).toHaveAttribute("href", "/jgp/E53G");
    // Układ jak lista najczęstszych grup: kod i nazwa, pasek, kwota, zmiana — bez dodatkowych opisów.
    expect(first).toHaveTextContent(/^E53G Niewydolność krążenia1,49 mld zł\+135%$/);
    expect(first).toHaveAttribute("title", "E53G Niewydolność krążenia: 1,49 mld zł, 10\u00a0521 zł na hospitalizację");
    expect(second).toHaveTextContent(/^A48 Udar747 mln zł—$/);
    expect(screen.getByTitle("Brak kwot w 2019 r.")).toBeInTheDocument();
    expect([...container.querySelectorAll("[style]")].map((el) => (el as HTMLElement).style.width)).toEqual(["100%", "50%"]);
  });

  it("skraca długie nazwy grup; pełna nazwa zostaje w dymku", () => {
    const label = "ENDOPROTEZOPLASTYKA PIERWOTNA CAŁKOWITA BIODRA Z REKONSTRUKCJĄ KOSTNĄ, ENDOPROTEZOPLASTYKA STAWU BIODROWEGO";
    render(<ValueRows rows={[{ code: "H14", label, valuePln: 967_000_000, hospitalizations: 1, perStayPln: null, sharePct: 1, changePct: 10 }]} label="Grupy" firstYear="2019" linkGroups />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent(/^H14 Endoprotezoplastyka pierwotna całkowita biodra…967 mln zł\+10%$/);
    expect(link.getAttribute("title")).toContain("z rekonstrukcją kostną, endoprotezoplastyka stawu biodrowego");
  });

  it("bez linków pokazuje sekcje jako zwykłe wiersze", () => {
    render(<ValueRows rows={[{ code: "E", label: "Układ krążenia", valuePln: 10, hospitalizations: 1, perStayPln: 10, sharePct: 100, changePct: -5 }]} label="Sekcje" firstYear="2019" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Sekcje" })).toHaveTextContent("Obszar leczeniaKwotaod 2019EUkład krążenia0 tys. zł−5%");
    expect(screen.getByRole("list", { name: "Sekcje" })).toHaveTextContent("Układ krążenia");
  });
});
