import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_STATE, hasActiveFilters, jgpCatalogUrlSearch, readJgpCatalogUrlState } from "@/lib/jgpCatalogUrlState";

describe("stan katalogu JGP w adresie", () => {
  it("domyślny stan to pusty adres", () => {
    expect(readJgpCatalogUrlState("")).toEqual(DEFAULT_CATALOG_STATE);
    expect(jgpCatalogUrlSearch(DEFAULT_CATALOG_STATE)).toBe("");
  });

  it("zapisuje i odczytuje wszystkie pola", () => {
    const state = { query: "zaćma", kind: "procedural" as const, minLatest: 1000, showDiscontinued: true, sort: { key: "change" as const, desc: false } };
    const search = jgpCatalogUrlSearch(state);
    expect(search).toBe("?q=za%C4%87ma&rodzaj=zabiegowe&min=1000&wycofane=1&sort=zmiana&kier=rosnaco");
    expect(readJgpCatalogUrlState(search)).toEqual(state);
  });

  it("kierunek tylko, gdy inny niż domyślny dla kolumny", () => {
    expect(jgpCatalogUrlSearch({ ...DEFAULT_CATALOG_STATE, sort: { key: "code", desc: false } })).toBe("?sort=kod");
    expect(readJgpCatalogUrlState("?sort=kod").sort).toEqual({ key: "code", desc: false });
    expect(readJgpCatalogUrlState("?sort=smiertelnosc").sort).toEqual({ key: "mortality", desc: true });
  });

  it("odrzuca nieznane wartości", () => {
    expect(readJgpCatalogUrlState("?rodzaj=xyz&min=7&sort=abc&kier=xyz")).toEqual(DEFAULT_CATALOG_STATE);
  });

  it("sortowanie nie jest filtrem", () => {
    expect(hasActiveFilters({ ...DEFAULT_CATALOG_STATE, sort: { key: "code", desc: false } })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_CATALOG_STATE, query: " e10 " })).toBe(true);
  });
});
