import { describe, expect, it } from "vitest";
import { DASHBOARD_HREFS, navigationFromDashboardHref, tabFromDashboardHref } from "../dashboardNavigation";

describe("tabFromDashboardHref", () => {
  it("rozpoznaje wszystkie działające sekcje dashboardu", () => {
    expect(tabFromDashboardHref("/analizy")).toBe("mortality");
    expect(tabFromDashboardHref("/analizy?t=a")).toBe("admissions");
    expect(tabFromDashboardHref("/analizy?t=h")).toBe("hospital");
    expect(tabFromDashboardHref("/analizy?t=m")).toBe("methodology");
  });

  it("nie przechwytuje linków do innych stron", () => {
    expect(tabFromDashboardHref("/")).toBeNull();
    expect(tabFromDashboardHref("/#odkrywaj")).toBeNull();
    expect(tabFromDashboardHref("/szpitale")).toBeNull();
  });
});

describe("navigationFromDashboardHref", () => {
  it("rozróżnia profil szpitala i porównanie", () => {
    expect(navigationFromDashboardHref("/analizy?t=h")).toEqual({ tab: "hospital", hospitalSubtab: "summary" });
    expect(navigationFromDashboardHref("/analizy?t=h&hv=c")).toEqual({ tab: "hospital", hospitalSubtab: "comparison" });
    expect(navigationFromDashboardHref("/analizy?t=a&hv=c")).toEqual({ tab: "admissions" });
  });

  it("każdy adres z DASHBOARD_HREFS wskazuje zakładkę dashboardu", () => {
    expect(Object.values(DASHBOARD_HREFS).map((href) => navigationFromDashboardHref(href)?.tab))
      .toEqual(["mortality", "admissions", "hospital", "hospital", "methodology"]);
  });
});
