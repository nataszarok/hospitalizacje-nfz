import type { DashboardActiveTab, DashboardUrlState } from "@/lib/dashboardUrlState";

// Events keep the global navigation in sync with the existing dashboard state.
// The dashboard remains the owner of URL filter parameters in this migration stage.
export const DASHBOARD_TAB_NAVIGATE_EVENT = "atlas:dashboard-navigate";
export const DASHBOARD_TAB_CHANGED_EVENT = "atlas:dashboard-tab-changed";

export type DashboardHospitalSubtab = NonNullable<DashboardUrlState["hospitalSubtab"]>;
export type DashboardNavigation = { tab: DashboardActiveTab; hospitalSubtab?: DashboardHospitalSubtab };

// Adresy podstron dashboardu używane przez stronę główną i nagłówek portalu.
export const DASHBOARD_HREFS = {
  mortality: "/analizy",
  admissions: "/analizy?t=a",
  hospital: "/analizy?t=h",
  comparison: "/analizy?t=h&hv=c",
  methodology: "/analizy?t=m",
} as const;

export function tabFromDashboardHref(href: string): DashboardActiveTab | null {
  return navigationFromDashboardHref(href)?.tab ?? null;
}

export function navigationFromDashboardHref(href: string): DashboardNavigation | null {
  const url = new URL(href, "https://atlas.invalid");
  if (url.pathname !== "/analizy") return null;
  const tab = url.searchParams.get("t");
  if (tab === "h") return { tab: "hospital", hospitalSubtab: url.searchParams.get("hv") === "c" ? "comparison" : "summary" };
  if (tab === "m") return { tab: "methodology" };
  if (tab === "a") return { tab: "admissions" };
  return { tab: "mortality" };
}
