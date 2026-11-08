/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PLAY_STEP_MS, RegionsTimelineMap } from "@/components/summary/RegionsTimelineMap";
import type { SummaryRegionTimeline } from "@/lib/hospitalizationSummary";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const timeline: SummaryRegionTimeline = {
  map: { version: 1, source: "", viewBox: [100, 100], regions: [["07", "Mazowieckie", "M0 0", [1, 1]], ["12", "Śląskie", "M0 0", [2, 2]]] },
  regions: [["07", "Mazowieckie"], ["12", "Śląskie"]],
  years: [
    { year: "2023", national: 15_000, per100k: [14_000, 16_000] },
    { year: "2024", national: 15_500, per100k: [15_000, 16_500] },
    { year: "2025", national: 16_000, per100k: [15_500, 18_000] },
  ],
};

const labels = () => [...document.querySelectorAll("text")].map((t) => t.textContent);

describe("RegionsTimelineMap", () => {
  it("zaczyna od ostatniego roku i podpisuje województwa liczbą na 100 tys. (w tysiącach)", () => {
    render(<RegionsTimelineMap timeline={timeline} />);
    expect(screen.getByRole("slider", { name: "Rok" })).toHaveValue("2");
    expect(labels()).toEqual(["15,5", "18,0"]);
    expect(screen.getByRole("link", { name: /Śląskie: 18\s000 hospitalizacji na 100 tys\. mieszkańców w 2025 r\./ })).toHaveAttribute("href", "/analizy?t=g&ow=12&y=2025");
    expect(screen.getByText(/Polska w 2025 r\./)).toHaveTextContent(/16\s000/);
  });

  it("suwak zmienia rok; skala koloru jest wspólna dla lat", () => {
    render(<RegionsTimelineMap timeline={timeline} />);
    const fillOf = (name: RegExp) => screen.getByRole("link", { name }).querySelector("path")!.getAttribute("fill");
    const latest = fillOf(/Śląskie/);
    fireEvent.change(screen.getByRole("slider", { name: "Rok" }), { target: { value: "0" } });
    expect(labels()).toEqual(["14,0", "16,0"]);
    expect(screen.getByRole("status")).toHaveTextContent("2023");
    // 16 000 w 2023 r. to mniej niż 18 000 w 2025 r.: inny (jaśniejszy) kolor.
    expect(fillOf(/Śląskie/)).not.toBe(latest);
  });

  it("odtwarza lata od pierwszego do ostatniego i zatrzymuje się na końcu", () => {
    vi.useFakeTimers();
    render(<RegionsTimelineMap timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "Odtwórz lata" }));
    expect(screen.getByRole("status")).toHaveTextContent("2023");
    expect(screen.getByRole("button", { name: "Zatrzymaj" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(PLAY_STEP_MS); });
    expect(screen.getByRole("status")).toHaveTextContent("2024");
    act(() => { vi.advanceTimersByTime(PLAY_STEP_MS * 3); });
    expect(screen.getByRole("status")).toHaveTextContent("2025");
    expect(screen.getByRole("button", { name: "Odtwórz lata" })).toBeInTheDocument();
  });

  it("przycisk zatrzymuje odtwarzanie", () => {
    vi.useFakeTimers();
    render(<RegionsTimelineMap timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "Odtwórz lata" }));
    fireEvent.click(screen.getByRole("button", { name: "Zatrzymaj" }));
    act(() => { vi.advanceTimersByTime(PLAY_STEP_MS * 3); });
    expect(screen.getByRole("status")).toHaveTextContent("2023");
  });
});
