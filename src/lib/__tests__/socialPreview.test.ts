import { describe, expect, it } from "vitest";
import { jgpPreviewAlt, jgpPreviewCard } from "@/lib/jgpPreview";
import type { JgpPageData } from "@/lib/jgpPage";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata, previewImagePath } from "@/lib/pageMetadata";
import { PREVIEW_SIZE, previewBars, renderPreviewPng } from "@/lib/socialPreview";
import { CHART_COLORS } from "@/lib/chartPalette";

const monthsOf = (years: string[]) => years.flatMap((year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));

function pageData(overrides: Partial<JgpPageData> = {}): JgpPageData {
  const months = monthsOf(["2017", "2018", "2019"]);
  return {
    jgpCode: "E53G", name: "NIEWYDOLNOŚĆ KRĄŻENIA", procedural: false, productCodes: ["P"], catalogYears: ["2017", "2018", "2019"], year: "2019",
    providerCount: 0, hospitalizations: 0, topProviders: [], providers: [], regions: [], regionYears: [],
    admissions: [], admissionYears: ["2017", "2018", "2019"], months,
    national: { hospitalizations: months.map((month) => month.startsWith("2019") ? 200 : 100), deaths: months.map(() => 0), urgent: months.map(() => 0) },
    previousHospitalizations: null, valuation: null, valuePln: [], family: null, description: null,
    ...overrides,
  } as JgpPageData;
}

describe("pageMetadata — podgląd linku", () => {
  it("daje tytuł z nazwą portalu, Open Graph i kartę X z obrazem 1200×630", () => {
    const meta = pageMetadata({ title: "Szpitale publiczne", description: "Opis.", path: "/szpitale" });
    expect(meta.title).toBe("Szpitale publiczne | funduszdanych.pl");
    expect(meta.openGraph).toMatchObject({ url: "/szpitale", title: "Szpitale publiczne", locale: "pl_PL", siteName: "funduszdanych.pl" });
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: DEFAULT_PREVIEW_IMAGE, width: 1200, height: 630 })]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Szpitale publiczne", images: meta.openGraph?.images });
  });

  it("nie dubluje nazwy portalu w tytule", () => {
    expect(pageMetadata({ title: "funduszdanych.pl | Start", description: "", path: "/" }).title).toBe("funduszdanych.pl | Start");
  });

  it("karta grupy ma własny obraz pod /og/jgp/<KOD>.png", () => {
    expect(previewImagePath.jgp("E53G")).toBe("/og/jgp/E53G.png");
    const meta = pageMetadata({ title: "E53G", description: "", path: "/jgp/E53G", image: { url: previewImagePath.jgp("E53G"), alt: "E53G" } });
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: "/og/jgp/E53G.png", alt: "E53G" })]);
  });
});

describe("jgpPreviewCard — treść obrazu karty grupy", () => {
  it("sumuje hospitalizacje kraju w latach i podaje ostatni rok", () => {
    const card = jgpPreviewCard(pageData());
    expect(card).toMatchObject({ title: "E53G", subtitle: "Niewydolność krążenia", eyebrow: "Grupa JGP · hospitalizacje 2017–2019" });
    expect(card.series).toEqual({ labels: ["2017", "2018", "2019"], values: [1200, 1200, 2400] });
    expect(card.fact).toEqual({ value: "2400", label: "hospitalizacji w 2019 r." });
    expect(jgpPreviewAlt(card)).toBe("E53G Niewydolność krążenia: 2400 hospitalizacji w 2019 r.; wykres słupkowy hospitalizacji w latach 2017–2019.");
  });

  it("pokazuje tylko lata grupy w katalogu", () => {
    const card = jgpPreviewCard(pageData({ catalogYears: ["2017", "2018"] }));
    expect(card.series?.labels).toEqual(["2017", "2018"]);
  });

  it("bez miesięcy (brak pliku grupy) nie rysuje wykresu", () => {
    const card = jgpPreviewCard(pageData({ months: [], national: { hospitalizations: [], deaths: [], urgent: [] }, hospitalizations: 77 }));
    expect(card.series).toBeUndefined();
    expect(card.fact).toEqual({ value: "77", label: "hospitalizacji w 2019 r." });
  });
});

describe("previewBars", () => {
  it("słupki od zera, ostatni granatem, pozostałe błękitem (bez legendy, DESIGN.md 6.2a)", () => {
    const bars = previewBars({ labels: ["a", "b", "c"], values: [50, 100, 0] }, 200);
    expect(bars.map((bar) => bar.height)).toEqual([100, 200, 0]);
    expect(bars.map((bar) => bar.color)).toEqual([CHART_COLORS.dataSoft, CHART_COLORS.dataSoft, CHART_COLORS.dataStrong]);
  });
});

describe("renderPreviewPng", () => {
  it("daje PNG 1200×630 mniejszy niż 60 KB", async () => {
    const png = await renderPreviewPng(jgpPreviewCard(pageData()));
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    // Nagłówek IHDR: szerokość i wysokość od bajtu 16.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([PREVIEW_SIZE.width, PREVIEW_SIZE.height]);
    expect(png.length).toBeLessThan(60 * 1024);
  }, 30_000);
});
