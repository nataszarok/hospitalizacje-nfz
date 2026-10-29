import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  datasetHighlights, loadHospitalizationIndex, loadStaticDataset, loadTrends, productTrend, resetStaticDataCache,
  type StaticDataset, type TrendsDataset,
} from "@/lib/staticData";

function dataset(year: string, facts: StaticDataset["facts"], products: StaticDataset["products"]): StaticDataset {
  return { version: 1, analysisYear: year, defaultProductCode: "P1", products, regions: [], facilities: [], populations: [], facts };
}

describe("datasetHighlights dla wielu lat", () => {
  it("sumuje hospitalizacje, łączy świadczeniodawców i grupy JGP oraz podaje zakres lat", () => {
    const d2025 = dataset("2025", [["07", "111", "P1", "0-1", "6", 10, 8, 1, 1]], [["P1", "A01", "Jeden"]]);
    const d2024 = dataset("2024", [
      ["07", "111", "P1", "0-1", "6", 5, 4, 0, 0],
      ["12", "333", "P2", "0-1", "2", 7, 6, 0, 0],
    ], [["P1", "A01", "Jeden"], ["P2", "F04", "Usunięta po 2024"]]);
    expect(datasetHighlights([d2025, d2024])).toEqual({ yearFrom: "2024", yearTo: "2025", hospitalizations: 22, providers: 2, jgpGroups: 2 });
  });

  it("odrzuca pustą listę", () => {
    expect(() => datasetHighlights([])).toThrow();
  });
});

const trends: TrendsDataset = {
  version: 1,
  years: ["2023", "2024", "2025"],
  products: [
    ["P1", "A01", "Stały produkt", ["2023", "2024", "2025"]],
    ["P2", "F04", "Usunięty po 2024", ["2023", "2024"]],
    ["P3", "F99", "Nowy w 2025", ["2025"]],
  ],
  monthly: [
    ["2023", 1, 0, "p", 10, 8, 1, 1],
    ["2024", 1, 0, "u", 6, 5, 2, 1],
    ["2024", 2, 0, "o", 3, 3, 0, 0],
    ["2024", 1, 1, "p", 4, 4, 0, 0],
    ["2025", 1, 0, "p", 12, 9, 0, 0],
    ["2025", 3, 2, "u", 2, 1, 1, 1],
  ],
  regional: [],
};

describe("productTrend", () => {
  it("liczy punkty roczne i miesięczne dla wybranego produktu metodą sim", () => {
    const t = productTrend(trends, ["P1"], "sim");
    expect(t.yearly).toEqual([
      { year: "2023", hospitalizations: 10, deaths: 1, planned: 10, urgent: 0 },
      { year: "2024", hospitalizations: 9, deaths: 2, planned: 0, urgent: 6 },
      { year: "2025", hospitalizations: 12, deaths: 0, planned: 12, urgent: 0 },
    ]);
    expect(t.monthly.map((p) => `${p.year}-${p.month}:${p.hospitalizations}`)).toEqual(["2023-1:10", "2024-1:6", "2024-2:3", "2025-1:12"]);
  });

  it("używa metody min", () => {
    expect(productTrend(trends, ["P1"], "min").yearly[1]).toMatchObject({ hospitalizations: 8, deaths: 1 });
  });

  it("zostawia przerwę (null) w latach, w których produktu nie ma w katalogu", () => {
    const removed = productTrend(trends, ["P2"], "sim").yearly;
    expect(removed[0]).toMatchObject({ year: "2023", hospitalizations: 0 });
    expect(removed[1]).toMatchObject({ year: "2024", hospitalizations: 4 });
    expect(removed[2]).toBeNull();
    expect(productTrend(trends, ["P3"], "sim").yearly.slice(0, 2)).toEqual([null, null]);
  });

  it("pusta lista produktów oznacza wszystkie produkty", () => {
    expect(productTrend(trends, [], "sim").yearly.map((p) => p?.hospitalizations)).toEqual([10, 13, 14]);
  });
});

function gzipResponse(payload: unknown) {
  return new Response(gzipSync(JSON.stringify(payload)));
}

describe("ładowanie plików z danymi", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetStaticDataCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const index = { version: 1, years: ["2024", "2025"], latestYear: "2025", defaultProductCode: "P1" };

  it("bez roku ładuje najnowszy rok z index.json i trzyma wynik w pamięci", async () => {
    fetchMock.mockImplementation(async (url: string) => url.endsWith("index.json") ? Response.json(index) : gzipResponse(dataset("2025", [], [])));
    await expect(loadStaticDataset()).resolves.toMatchObject({ analysisYear: "2025" });
    await loadStaticDataset("2025");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/data/hospitalizations/index.json", "/data/hospitalizations/2025.json.gz"]);
  });

  it("ładuje wybrany rok", async () => {
    fetchMock.mockResolvedValue(gzipResponse(dataset("2024", [], [])));
    await expect(loadStaticDataset("2024")).resolves.toMatchObject({ analysisYear: "2024" });
    expect(fetchMock).toHaveBeenCalledWith("/data/hospitalizations/2024.json.gz");
  });

  it("po błędzie pozwala spróbować ponownie", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(loadStaticDataset("2024")).rejects.toThrow("Nie udało się pobrać");
    fetchMock.mockResolvedValueOnce(gzipResponse(dataset("2024", [], [])));
    await expect(loadStaticDataset("2024")).resolves.toMatchObject({ analysisYear: "2024" });
  });

  it("zgłasza błąd, gdy brak listy lat", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    await expect(loadHospitalizationIndex()).rejects.toThrow("listy lat");
  });

  it("ładuje trendy", async () => {
    fetchMock.mockResolvedValue(gzipResponse(trends));
    await expect(loadTrends()).resolves.toMatchObject({ years: ["2023", "2024", "2025"] });
    expect(fetchMock).toHaveBeenCalledWith("/data/hospitalizations/trends.json.gz");
  });
});
