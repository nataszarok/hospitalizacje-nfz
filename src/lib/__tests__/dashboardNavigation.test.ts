import { describe, expect, it } from "vitest";
import { DASHBOARD_HREFS, hospitalNavigationFromHref, navigationFromDashboardHref, tabFromDashboardHref } from "../dashboardNavigation";

describe("tabFromDashboardHref", () => {
  it("rozpoznaje widoki eksploratora", () => {
    expect(tabFromDashboardHref("/analizy")).toBe("trend");
    expect(tabFromDashboardHref("/analizy?t=w")).toBe("trend");
    expect(tabFromDashboardHref("/analizy?t=k")).toBe("mortality");
    expect(tabFromDashboardHref("/analizy?t=a")).toBe("admissions");
    expect(tabFromDashboardHref("/analizy?t=g")).toBe("regions");
  });

  it("nie przechwytuje linków do innych stron", () => {
    expect(tabFromDashboardHref("/")).toBeNull();
    expect(tabFromDashboardHref("/szpitale")).toBeNull();
    expect(tabFromDashboardHref("/o-danych")).toBeNull();
  });
});

describe("hospitalNavigationFromHref", () => {
  it("rozróżnia profil szpitala i porównanie", () => {
    expect(hospitalNavigationFromHref("/szpitale")).toEqual({ view: "summary" });
    expect(hospitalNavigationFromHref("/szpitale?hv=c")).toEqual({ view: "comparison" });
    expect(hospitalNavigationFromHref("/analizy?hv=c")).toBeNull();
  });
});

describe("DASHBOARD_HREFS", () => {
  it("analizy prowadzą do widoków eksploratora, a szpitale i dane do osobnych stron", () => {
    expect([DASHBOARD_HREFS.trend, DASHBOARD_HREFS.mortality, DASHBOARD_HREFS.admissions, DASHBOARD_HREFS.regions].map((href) => navigationFromDashboardHref(href)?.tab))
      .toEqual(["trend", "mortality", "admissions", "regions"]);
    expect(hospitalNavigationFromHref(DASHBOARD_HREFS.comparison)).toEqual({ view: "comparison" });
    expect(DASHBOARD_HREFS.methodology).toBe("/o-danych");
  });
});
