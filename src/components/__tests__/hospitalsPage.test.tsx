/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HospitalsPage } from "@/components/hospitals/HospitalsPage";
import { HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT } from "@/lib/dashboardNavigation";

const loadStaticDataset = vi.fn();
// Plik roku w pamięci (pobrany z wyprzedzeniem): domyślnie brak.
const peeked: { dataset: unknown } = { dataset: null };
// Adres z routera Next (w aplikacji `useSearchParams`); w testach — bieżący adres okna.
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@/lib/staticData", () => ({
  peekStaticDataset: () => peeked.dataset,
  loadStaticDataset: (year?: string) => loadStaticDataset(year),
  referenceFromDataset: (d: { analysisYear: string }) => ({ analysisYear: d.analysisYear, products: [{ code: "P1", jgpCode: "E10", name: "OZW", label: "E10 — OZW" }] }),
}));
vi.mock("@/components/HospitalAnalysisTab", () => ({
  HospitalAnalysisTab: ({ hospitalKey, hospitalSubtab, setHospitalSubtab, method, products }: {
    hospitalKey: string; hospitalSubtab: string; setHospitalSubtab: (v: "summary" | "comparison") => void; method: string; products: unknown[];
  }) => <div>
    <span>szpital: {hospitalKey || "—"} · widok: {hospitalSubtab} · metoda: {method} · produkty: {products.length}</span>
    <button onClick={() => setHospitalSubtab("comparison")}>porównanie</button>
  </div>,
}));

const changed = vi.fn();
beforeEach(() => {
  window.history.replaceState(null, "", "/szpitale/eksplorator");
  loadStaticDataset.mockResolvedValue({ analysisYear: "2025" });
  changed.mockReset();
  peeked.dataset = null;
  window.addEventListener(HOSPITAL_VIEW_CHANGED_EVENT, changed);
});
afterEach(() => {
  window.removeEventListener(HOSPITAL_VIEW_CHANGED_EVENT, changed);
  cleanup();
});

describe("HospitalsPage", () => {
  it("plik roku już w pamięci: profil z adresu w pierwszym renderze, bez szkieletu i bez pobierania", () => {
    window.history.replaceState(null, "", "/szpitale/eksplorator?hospital=07%7C111&hv=c");
    peeked.dataset = { analysisYear: "2025" };
    render(<HospitalsPage />);
    expect(screen.getByText("szpital: 07|111 · widok: comparison · metoda: min · produkty: 1")).toBeInTheDocument();
    expect(loadStaticDataset).not.toHaveBeenCalled();
  });

  it("ładuje najnowszy rok i pokazuje profil", async () => {
    render(<HospitalsPage />);
    // Bez szpitala w adresie: szpital domyślny (Koszalin).
    expect(await screen.findByText("szpital: 16|6691044410 · widok: summary · metoda: min · produkty: 1")).toBeInTheDocument();
    expect(loadStaticDataset).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole("heading", { name: "Profil szpitala" })).toBeInTheDocument();
    expect(screen.getByText("NFZ · dane 2025")).toBeInTheDocument();
    expect(document.getElementById("hospital-sidebar-slot")).not.toBeNull();
    // Bez wyboru metody wartości „<5”.
    expect(screen.queryByText("Estymacja wartości ukrytych")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("odtwarza szpital i widok z adresu; metoda jest zawsze konserwatywna", async () => {
    window.history.replaceState(null, "", "/szpitale/eksplorator?hospital=07%7C111&hv=c&m=sim");
    render(<HospitalsPage />);
    expect(await screen.findByText("szpital: 07|111 · widok: comparison · metoda: min · produkty: 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Porównanie szpitali" })).toBeInTheDocument();
  });

  it("zapisuje zmiany w adresie i zgłasza widok nagłówkowi", async () => {
    window.history.replaceState(null, "", "/szpitale/eksplorator?hospital=07%7C111");
    render(<HospitalsPage />);
    fireEvent.click(await screen.findByText("porównanie"));
    await waitFor(() => expect(window.location.search).toBe("?hospital=07%7C111&hv=c"));
    expect(changed.mock.calls.at(-1)?.[0].detail).toEqual({ view: "comparison" });
  });

  it("przełącza widok po zdarzeniu z nagłówka", async () => {
    render(<HospitalsPage />);
    await screen.findByText(/widok: summary/);
    act(() => { window.dispatchEvent(new CustomEvent(HOSPITAL_VIEW_NAVIGATE_EVENT, { detail: { view: "comparison" } })); });
    expect(screen.getByText(/widok: comparison/)).toBeInTheDocument();
  });

  it("w czasie pobierania pokazuje szkielet strony (panel i nagłówek), nie komunikat na środku", () => {
    loadStaticDataset.mockReturnValueOnce(new Promise(() => {}));
    const { container } = render(<HospitalsPage />);
    expect(container.querySelector(".app-shell")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { name: "Profil szpitala" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Ładowanie profili szpitali…");
    expect(container.querySelector(".center-state")).toBeNull();
  });

  it("pokazuje błąd pobierania danych", async () => {
    loadStaticDataset.mockRejectedValueOnce(new Error("Brak danych."));
    render(<HospitalsPage />);
    expect(await screen.findByText("Brak danych.")).toBeInTheDocument();
  });
});
