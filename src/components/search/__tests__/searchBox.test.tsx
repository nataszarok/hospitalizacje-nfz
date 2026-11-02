/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetSearchIndexCache, SearchBox } from "@/components/search/SearchBox";
import { searchIndexFixture } from "@/lib/__tests__/fixtures/searchIndexFixture";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn();

beforeEach(() => {
  resetSearchIndexCache();
  push.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => searchIndexFixture });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const input = () => screen.getByRole("combobox", { name: "Szukaj grupy JGP albo szpitala" });
const type = (value: string) => {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value } });
};

describe("SearchBox", () => {
  it("pobiera indeks dopiero przy pierwszym użyciu pola", async () => {
    render(<SearchBox />);
    expect(fetchMock).not.toHaveBeenCalled();
    type("e10");
    await screen.findByRole("option", { name: /OZW - diagnostyka inwazyjna/ });
    expect(fetchMock).toHaveBeenCalledWith("/szukaj.json");
  });

  it("pokazuje grupy i szpitale w sekcjach z liczbą hospitalizacji", async () => {
    render(<SearchBox />);
    type("ozw");
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringMatching(/^E11OZW - leczenie inwazyjne dwuetapowe > 3 dni9\s?888 hosp\. · 2025$/),
      expect.stringMatching(/^E10OZW - diagnostyka inwazyjna8\s?326 hosp\. · 2025$/),
    ]);
    expect(screen.getByText("Grupy JGP")).toBeInTheDocument();
  });

  it("Enter otwiera pierwszy wynik; strzałki zmieniają wybór", async () => {
    render(<SearchBox />);
    type("nowa sol");
    await screen.findAllByRole("option");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.submit(input().closest("form")!);
    expect(push).toHaveBeenCalledWith("/szpitale?hospital=04%7C9251723350");
  });

  it("zdanie z grupą i szpitalem prowadzi do karty grupy z wyróżnionym szpitalem", async () => {
    const onNavigate = vi.fn();
    render(<SearchBox onNavigate={onNavigate} />);
    type("E10 Nowa Sól na tle innych");
    expect(await screen.findByText("Rozumiem pytanie jako")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    expect(push).toHaveBeenCalledWith("/jgp/E10?osrodek=04%7C9251723350");
    expect(onNavigate).toHaveBeenCalled();
    expect(input()).toHaveValue("");
  });

  it("mówi, gdy nic nie pasuje, i gdy indeksu nie da się pobrać", async () => {
    render(<SearchBox />);
    type("qwerty");
    expect(await screen.findByText(/Brak wyników dla „qwerty”/)).toBeInTheDocument();
    cleanup();
    resetSearchIndexCache();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<SearchBox />);
    type("e10");
    expect(await screen.findByText(/Nie udało się pobrać wyszukiwarki/)).toBeInTheDocument();
  });

  it("Escape zamyka listę", async () => {
    render(<SearchBox />);
    type("e10");
    await screen.findAllByRole("option");
    fireEvent.keyDown(input(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });
});
