import { describe, expect, it } from "vitest";
import { hospitalPreviewAlt, hospitalPreviewCard, hospitalPreviewInput, type HospitalPreviewInput } from "@/lib/hospitalPreview";
import type { FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";
import { pageMetadata, previewImagePath } from "@/lib/pageMetadata";
import { PREVIEW_SIZE, renderPreviewPng } from "@/lib/socialPreview";

const YEARS = ["2021", "2022", "2023", "2024"];

/** Dane obrazu: hospitalizacje w latach (`perMonth[rok]` × 12 miesięcy). */
function pageData(perMonth: number[], overrides: Partial<HospitalPreviewInput> = {}): HospitalPreviewInput {
  return {
    name: "Szpital Wojewódzki im. Mikołaja Kopernika w Koszalinie", city: "KOSZALIN", region: "zachodniopomorskie",
    years: YEARS, hospitalizations: perMonth.map((value) => value * 12),
    ...overrides,
  };
}

describe("hospitalPreviewInput — hospitalizacje szpitala z plików placówek", () => {
  const index: FacilityYearsIndex = {
    version: 1, years: ["2024", "2025"], active: [3, 3],
    facilities: [["16", "6691044410", " SZPITAL ALFA ", "KOSZALIN"], ["16", "1111111111", "SZPITAL BETA", "KOSZALIN"]],
  };
  const section = (rows: [product: number, facility: number, year: number, hMin: number][]): FacilityYearsSection => ({
    version: 2, products: ["A", "B"],
    rows: {
      product: rows.map((row) => row[0]), facility: rows.map((row) => row[1]), year: rows.map((row) => row[2]), hMin: rows.map((row) => row[3]),
      hSim: rows.map((row) => row[3] + 1), dMin: rows.map(() => 0), dSim: rows.map(() => 0),
    },
  });
  const sections = [section([[0, 0, 0, 10], [1, 0, 0, 5], [0, 1, 0, 99]]), section([[0, 0, 1, 7]])];

  it("sumuje hospitalizacje (min) wszystkich produktów i sekcji placówki w latach", () => {
    expect(hospitalPreviewInput("16|6691044410", index, sections, "zachodniopomorskie")).toEqual({
      name: "SZPITAL ALFA", city: "KOSZALIN", region: "zachodniopomorskie", years: ["2024", "2025"], hospitalizations: [15, 7],
    });
  });

  it("placówki spoza indeksu nie ma", () => {
    expect(hospitalPreviewInput("16|0000000000", index, sections, "")).toBeNull();
  });
});

describe("hospitalPreviewCard — treść obrazu karty szpitala", () => {
  it("sumuje hospitalizacje szpitala w latach i podaje ostatni rok", () => {
    const card = hospitalPreviewCard(pageData([100, 110, 120, 200]));
    expect(card).toMatchObject({
      eyebrow: "Szpital · hospitalizacje 2021–2024",
      title: "Szpital Wojewódzki im. Mikołaja Kopernika w Koszalinie",
      subtitle: "Koszalin · woj. zachodniopomorskie",
    });
    expect(card.series).toEqual({ labels: YEARS, values: [1200, 1320, 1440, 2400] });
    expect(card.fact).toEqual({ value: (2400).toLocaleString("pl-PL"), label: "hospitalizacji w 2024 r." });
  });

  it("pomija lata przed pierwszą hospitalizacją", () => {
    const card = hospitalPreviewCard(pageData([0, 0, 10, 20]));
    expect(card.series).toEqual({ labels: ["2023", "2024"], values: [120, 240] });
    expect(card.eyebrow).toBe("Szpital · hospitalizacje 2023–2024");
  });

  it("szpital bez hospitalizacji w ostatnim roku: liczba kluczowa z ostatniego roku z danymi, wykres do końca okresu", () => {
    const card = hospitalPreviewCard(pageData([10, 20, 0, 0]));
    expect(card.series?.labels).toEqual(YEARS);
    expect(card.fact).toEqual({ value: "240", label: "hospitalizacji w 2022 r." });
  });

  it("jeden rok z danymi: bez wykresu", () => {
    const card = hospitalPreviewCard(pageData([0, 0, 0, 5]));
    expect(card.series).toBeUndefined();
    expect(card.fact).toEqual({ value: "60", label: "hospitalizacji w 2024 r." });
  });

  it("bez województwa: podtytuł z samym miastem", () => {
    expect(hospitalPreviewCard(pageData([1, 1, 1, 1], { region: "" })).subtitle).toBe("Koszalin");
  });

  it("tekst alternatywny mówi to samo co obraz", () => {
    const card = hospitalPreviewCard(pageData([10, 20, 30, 40]));
    expect(hospitalPreviewAlt(card)).toBe("Szpital Wojewódzki im. Mikołaja Kopernika w Koszalinie, Koszalin · woj. zachodniopomorskie: 480 hospitalizacji w 2024 r.; wykres słupkowy hospitalizacji w latach 2021–2024.");
  });
});

describe("pageMetadata — karta szpitala", () => {
  it("ma własny obraz pod /og/szpital/<NIP>-<OW>.png", () => {
    expect(previewImagePath.szpital("6691044410-16")).toBe("/og/szpital/6691044410-16.png");
    const meta = pageMetadata({ title: "Szpital", description: "", path: "/szpitale/6691044410-16", image: { url: previewImagePath.szpital("6691044410-16"), alt: "Szpital" } });
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: "/og/szpital/6691044410-16.png", width: 1200, height: 630 })]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: meta.openGraph?.images });
  });
});

describe("renderPreviewPng — karta szpitala", () => {
  it("długa nazwa szpitala daje PNG 1200×630 mniejszy niż 60 KB", async () => {
    const png = await renderPreviewPng(hospitalPreviewCard(pageData([100, 110, 120, 200], {
      name: "Samodzielny Publiczny Zakład Opieki Zdrowotnej Wojewódzki Szpital Specjalistyczny im. Stefana Kardynała Wyszyńskiego",
    })));
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([PREVIEW_SIZE.width, PREVIEW_SIZE.height]);
    expect(png.length).toBeLessThan(60 * 1024);
  }, 30_000);
});
