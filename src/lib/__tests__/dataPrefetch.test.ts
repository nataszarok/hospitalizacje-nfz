import { beforeEach, describe, expect, it, vi } from "vitest";

const loadHospitalizationIndex = vi.fn(async () => ({ years: ["2024", "2025"], latestYear: "2025" }));
const loadStaticDataset = vi.fn(async (year?: string) => ({ year }));
const loadTrends = vi.fn(async () => ({}));
vi.mock("@/lib/staticData", () => ({
  loadHospitalizationIndex: () => loadHospitalizationIndex(),
  loadStaticDataset: (year?: string) => loadStaticDataset(year),
  loadTrends: () => loadTrends(),
}));
const loadPlotly = vi.fn(async () => ({}));
vi.mock("@/lib/plotlyLoader", () => ({ loadPlotly: () => loadPlotly() }));
const fetchMock = vi.fn(async (url: string) => new Response(url));
vi.stubGlobal("fetch", fetchMock);
const resource = (name: string) => ({ load: vi.fn(async () => name), peek: () => null, reset: () => {} });
const hospitalData = {
  financialResultsResource: resource("finanse"),
  rpwdlSummaryProfilesResource: resource("rpwdl"),
  peerPairsResource: resource("pary"),
  jgpValuationsResource: resource("wyceny"),
};
vi.mock("@/lib/hospitalData", () => hospitalData);
const loaded = () => Object.entries(hospitalData).filter(([, r]) => r.load.mock.calls.length).map(([name]) => name);

const { prefetchForHref } = await import("@/lib/dataPrefetch");

beforeEach(() => { vi.clearAllMocks(); });

describe("prefetchForHref — dane strony docelowej linku", () => {
  it("eksplorator: rok z adresu (albo najnowszy) i trendy tylko dla widoku „W czasie”", async () => {
    expect(prefetchForHref("/analizy?y=2024")).toBe("analizy");
    await vi.waitFor(() => expect(loadStaticDataset).toHaveBeenCalledWith("2024"));
    expect(loadTrends).toHaveBeenCalledTimes(1);
    expect(loadPlotly).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    prefetchForHref("/analizy?t=k&y=1999");
    await vi.waitFor(() => expect(loadStaticDataset).toHaveBeenCalledWith("2025"));
    expect(loadTrends).not.toHaveBeenCalled();
  });

  it("porównanie szpitali (każdy adres strony): najnowszy rok, finanse, profile RPWDL, pary A/B i wyceny", () => {
    expect(prefetchForHref("/szpitale/eksplorator?hospital=07%7C111")).toBe("porownanie");
    expect(loadStaticDataset).toHaveBeenCalledWith(undefined);
    expect(loadPlotly).toHaveBeenCalledTimes(1);
    expect(loaded()).toEqual(["financialResultsResource", "rpwdlSummaryProfilesResource", "peerPairsResource", "jgpValuationsResource"]);
    vi.clearAllMocks();
    expect(prefetchForHref("/szpitale/eksplorator?hv=c")).toBe("porownanie");
    expect(loaded()).toEqual(["financialResultsResource", "rpwdlSummaryProfilesResource", "peerPairsResource", "jgpValuationsResource"]);
  });

  it("inne strony i inne domeny: nic nie pobiera", () => {
    expect(prefetchForHref("/jgp/E53G")).toBeNull();
    expect(prefetchForHref("https://example.com/analizy")).toBeNull();
    expect(loadStaticDataset).not.toHaveBeenCalled();
    expect(loadPlotly).not.toHaveBeenCalled();
  });
});
