/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HospitalsPage } from "@/components/hospitals/HospitalsPage";
import { HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT } from "@/lib/dashboardNavigation";

vi.mock("@mantine/core", () => ({
  Select: ({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) => (
    <select data-testid={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="min">min</option><option value="sim">sim</option>
    </select>
  ),
}));
const loadStaticDataset = vi.fn();
vi.mock("@/lib/staticData", () => ({
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
  window.history.replaceState(null, "", "/szpitale");
  loadStaticDataset.mockResolvedValue({ analysisYear: "2025" });
  changed.mockReset();
  window.addEventListener(HOSPITAL_VIEW_CHANGED_EVENT, changed);
});
afterEach(() => {
  window.removeEventListener(HOSPITAL_VIEW_CHANGED_EVENT, changed);
  cleanup();
});

describe("HospitalsPage", () => {
  it("ładuje najnowszy rok i pokazuje profil", async () => {
    render(<HospitalsPage />);
    expect(await screen.findByText("szpital: — · widok: summary · metoda: min · produkty: 1")).toBeInTheDocument();
    expect(loadStaticDataset).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole("heading", { name: "Profil szpitala" })).toBeInTheDocument();
    expect(screen.getByText("NFZ · dane 2025")).toBeInTheDocument();
    expect(document.getElementById("hospital-sidebar-slot")).not.toBeNull();
  });

  it("odtwarza szpital, widok i metodę z adresu", async () => {
    window.history.replaceState(null, "", "/szpitale?hospital=07%7C111&hv=c&m=sim");
    render(<HospitalsPage />);
    expect(await screen.findByText("szpital: 07|111 · widok: comparison · metoda: sim · produkty: 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Porównanie szpitali" })).toBeInTheDocument();
  });

  it("zapisuje zmiany w adresie i zgłasza widok nagłówkowi", async () => {
    window.history.replaceState(null, "", "/szpitale?hospital=07%7C111");
    render(<HospitalsPage />);
    fireEvent.click(await screen.findByText("porównanie"));
    fireEvent.change(screen.getByTestId("method"), { target: { value: "sim" } });
    await waitFor(() => expect(window.location.search).toBe("?hospital=07%7C111&hv=c&m=sim"));
    expect(changed.mock.calls.at(-1)?.[0].detail).toEqual({ view: "comparison" });
  });

  it("przełącza widok po zdarzeniu z nagłówka", async () => {
    render(<HospitalsPage />);
    await screen.findByText(/widok: summary/);
    act(() => { window.dispatchEvent(new CustomEvent(HOSPITAL_VIEW_NAVIGATE_EVENT, { detail: { view: "comparison" } })); });
    expect(screen.getByText(/widok: comparison/)).toBeInTheDocument();
  });

  it("pokazuje błąd pobierania danych", async () => {
    loadStaticDataset.mockRejectedValueOnce(new Error("Brak danych."));
    render(<HospitalsPage />);
    expect(await screen.findByText("Brak danych.")).toBeInTheDocument();
  });
});
