import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOSPITAL_CATALOG_STATE, hasActiveHospitalFilters, hospitalCatalogUrlSearch, legacyHospitalExplorerRedirect, readHospitalCatalogUrlState,
} from "@/lib/hospitalCatalogUrlState";

describe("stan katalogu szpitali w adresie", () => {
  it("bez parametrów: bez progu i sortowanie po hospitalizacjach", () => {
    expect(readHospitalCatalogUrlState("")).toEqual(DEFAULT_HOSPITAL_CATALOG_STATE);
    expect(hospitalCatalogUrlSearch(DEFAULT_HOSPITAL_CATALOG_STATE)).toBe("");
    expect(hasActiveHospitalFilters(DEFAULT_HOSPITAL_CATALOG_STATE)).toBe(false);
  });

  it("zapisuje i odczytuje filtry oraz sortowanie", () => {
    const state = { view: null, query: "koszalin", region: "16", city: "", psz: 2, minLatest: 1000, sort: { key: "mortality" as const, desc: false } };
    const search = hospitalCatalogUrlSearch(state);
    expect(search).toBe("?q=koszalin&woj=16&siec=2&min=1000&sort=smiertelnosc&kier=rosnaco");
    expect(readHospitalCatalogUrlState(search)).toEqual(state);
    expect(readHospitalCatalogUrlState("?siec=tak").psz).toBe("in");
    expect(readHospitalCatalogUrlState("?siec=nie").psz).toBe("out");
    // Nieznane wartości wracają do domyślnych.
    expect(readHospitalCatalogUrlState("?woj=abc&min=7&siec=x")).toEqual(DEFAULT_HOSPITAL_CATALOG_STATE);
  });

  it("widok mapy i miasto (wybór kropki): miasto filtruje listę, więc to filtr", () => {
    const state = { ...DEFAULT_HOSPITAL_CATALOG_STATE, view: "map" as const, city: "BIAŁYSTOK" };
    const search = hospitalCatalogUrlSearch(state);
    expect(search).toBe("?widok=mapa&miasto=BIA%C5%81YSTOK");
    expect(readHospitalCatalogUrlState(search)).toEqual(state);
    expect(readHospitalCatalogUrlState("?miasto=Koszalin").city).toBe("KOSZALIN");
    expect(hasActiveHospitalFilters(state)).toBe(true);
    expect(hasActiveHospitalFilters({ ...DEFAULT_HOSPITAL_CATALOG_STATE, view: "map" })).toBe(false);
    // Wybrana lista zostaje w adresie (domyślny widok zależy od ekranu).
    expect(hospitalCatalogUrlSearch({ ...DEFAULT_HOSPITAL_CATALOG_STATE, view: "list" })).toBe("?widok=lista");
    expect(readHospitalCatalogUrlState("?widok=lista").view).toBe("list");
  });

  it("dawne adresy profilu przekierowuje do eksploratora szpitali, katalogu nie", () => {
    expect(legacyHospitalExplorerRedirect("?hospital=16%7C6691044410&hv=c", "/szpitale/eksplorator")).toBe("/szpitale/eksplorator?hospital=16%7C6691044410&hv=c");
    expect(legacyHospitalExplorerRedirect("?pd=12", "/szpitale/eksplorator")).toBe("/szpitale/eksplorator?pd=12");
    expect(legacyHospitalExplorerRedirect("?q=koszalin", "/szpitale/eksplorator")).toBeNull();
  });
});
