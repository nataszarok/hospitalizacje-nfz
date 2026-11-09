import { beforeEach, describe, expect, it, vi } from "vitest";

const loadHospitalizationIndex = vi.fn(async () => ({ years: ["2024", "2025"], latestYear: "2025" }));
const loadStaticDataset = vi.fn(async (year?: string) => ({ year }));
const loadTrends = vi.fn(async () => ({}));
vi.mock("@/lib/staticData", () => ({
  loadHospitalizationIndex: () => loadHospitalizationIndex(),
  loadStaticDataset: (year?: string) => loadStaticDataset(year),
  loadTrends: () => loadTrends(),
}));
const fetchMock = vi.fn(async (url: string) => new Response(url));
vi.stubGlobal("fetch", fetchMock);

const { prefetchForHref } = await import("@/lib/dataPrefetch");

beforeEach(() => { vi.clearAllMocks(); });

describe("prefetchForHref — dane strony docelowej linku", () => {
  it("eksplorator: rok z adresu (albo najnowszy) i trendy tylko dla widoku „W czasie”", async () => {
    expect(prefetchForHref("/analizy?y=2024")).toBe("analizy");
    await vi.waitFor(() => expect(loadStaticDataset).toHaveBeenCalledWith("2024"));
    expect(loadTrends).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    prefetchForHref("/analizy?t=k&y=1999");
    await vi.waitFor(() => expect(loadStaticDataset).toHaveBeenCalledWith("2025"));
    expect(loadTrends).not.toHaveBeenCalled();
  });

  it("szpitale: najnowszy rok oraz finanse i profile RPWDL z pamięci przeglądarki", () => {
    expect(prefetchForHref("/szpitale?hospital=07%7C111")).toBe("szpitale");
    expect(loadStaticDataset).toHaveBeenCalledWith(undefined);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/data/financial_results.json.gz", "/data/rpwdl_summary_profiles.json.gz"]);
  });

  it("inne strony i inne domeny: nic nie pobiera", () => {
    expect(prefetchForHref("/jgp/E53G")).toBeNull();
    expect(prefetchForHref("https://example.com/analizy")).toBeNull();
    expect(loadStaticDataset).not.toHaveBeenCalled();
  });
});
