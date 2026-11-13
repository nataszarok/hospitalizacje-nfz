/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdmissionBars, ChangeList, Histogram, RegionsMiniMap } from "@/components/portal/HomeCharts";
import type { HomeStats } from "@/lib/homeStats";

afterEach(cleanup);

const regions: NonNullable<HomeStats["regions"]> = {
  map: { version: 1, source: "test", viewBox: [100, 100], regions: [["07", "Mazowieckie", "M0 0h10v10z", [5, 5]], ["12", "Śląskie", "M20 20h10v10z", [25, 25]]] },
  cells: [
    { owNfz: "07", name: "Mazowieckie", population: 5_500_000, hospitalizations: 1_100, per100k: 20, deaths: 0, mortalityPct: 0, urgentPct: 0, column: 3, row: 1, shortName: "MAZ", ratio: 1.1, position: 0 },
    { owNfz: "12", name: "Śląskie", population: 4_300_000, hospitalizations: 731, per100k: 17, deaths: 0, mortalityPct: 0, urgentPct: 0, column: 2, row: 3, shortName: "ŚLĄ", ratio: 0.9, position: 0 },
  ],
  national: 18.7,
};

describe("Wykresy strony głównej", () => {
  it("rysuje mapę województw z linkami do widoku „Gdzie” z wybranym obszarem", () => {
    render(<RegionsMiniMap regions={regions} />);
    const map = screen.getByRole("group", { name: /Mapa województw/ });
    expect(within(map).getByRole("link", { name: /Mazowieckie: 20 na 100 tys\. \(\+10% wobec średniej Polski\)/ })).toHaveAttribute("href", "/analizy?t=g&ow=07");
    expect(map).toHaveTextContent("−10%");
  });

  it("linkuje zmiany r/r do kart grup", () => {
    render(<ChangeList title="Największe spadki" direction="down" groups={[{ code: "G36", name: "OSTRE ZAPALENIE TRZUSTKI", latest: 2_712, previous: 4_767, changePct: -43.1 }]} />);
    const link = screen.getByRole("link", { name: /G36/ });
    expect(link).toHaveAttribute("href", "/jgp/G36");
    expect(link).toHaveTextContent("G36Ostre zapalenie trzustki−43%");
  });

  it("opisuje udział przyjęć nagłych w latach", () => {
    render(<AdmissionBars years={[{ year: "2025", hospitalizations: 10, urgentPct: 37.7, plannedPct: 57.6, otherPct: 4.7, months: 12 }]} />);
    expect(screen.getByRole("img", { name: "Przyjęcia nagłe w latach: 2025 — 38%" })).toBeInTheDocument();
  });

  it("rysuje histogram z liczbami i przedziałami straty w innym kolorze", () => {
    const { container } = render(<Histogram label="Marża" unit="%" bins={[{ label: "−5…0", count: 137, negative: true }, { label: "0…5", count: 218 }]} />);
    expect(screen.getByRole("img", { name: "Marża: −5…0 % — 137, 0…5 % — 218" })).toBeInTheDocument();
    const [loss, profit] = container.querySelectorAll("rect");
    expect(loss.getAttribute("class")).not.toBe(profit.getAttribute("class"));
  });
});
