import { describe, expect, it, vi } from "vitest";
import { cachedResource } from "@/lib/hospitalData";

describe("cachedResource — plik pobierany raz na wizytę", () => {
  it("jedno pobranie dla wielu wywołań; `peek` zwraca plik dopiero po pobraniu", async () => {
    const fetchValue = vi.fn(async () => ({ rows: [1] }));
    const resource = cachedResource(fetchValue);
    expect(resource.peek()).toBeNull();
    const [a, b] = await Promise.all([resource.load(), resource.load()]);
    expect(a).toBe(b);
    expect(fetchValue).toHaveBeenCalledTimes(1);
    expect(resource.peek()).toEqual({ rows: [1] });
    resource.reset();
    expect(resource.peek()).toBeNull();
  });

  it("po błędzie kolejne wywołanie pobiera ponownie", async () => {
    const fetchValue = vi.fn().mockRejectedValueOnce(new Error("404")).mockResolvedValueOnce("ok");
    const resource = cachedResource(fetchValue);
    await expect(resource.load()).rejects.toThrow("404");
    expect(resource.peek()).toBeNull();
    await expect(resource.load()).resolves.toBe("ok");
  });
});
