import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRegionalTrends, resetStaticDataCache } from "@/lib/staticData";
import { regionalTrendsFixtures } from "@/lib/__tests__/fixtures/trendsFixture";

function gzipResponse(payload: unknown) {
  return new Response(gzipSync(Buffer.from(JSON.stringify(payload))));
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetStaticDataCache();
});

describe("loadRegionalTrends", () => {
  it("pobiera plik jednego OW NFZ i trzyma go w pamięci", async () => {
    const fetchMock = vi.fn(async (url: string) => gzipResponse(regionalTrendsFixtures[url.match(/(\d{2})\.json\.gz$/)![1]]));
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadRegionalTrends("12");
    expect(first.owNfz).toBe("12");
    expect(fetchMock).toHaveBeenCalledWith("/data/hospitalizations/trends-regions/12.json.gz");

    await loadRegionalTrends("12");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect((await loadRegionalTrends("07")).owNfz).toBe("07");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("po błędzie pobiera plik ponownie", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(gzipResponse(regionalTrendsFixtures["07"]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadRegionalTrends("07")).rejects.toThrow();
    expect((await loadRegionalTrends("07")).rows).toHaveLength(4);
  });
});
