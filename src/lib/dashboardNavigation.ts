import type { DashboardActiveTab } from "@/lib/dashboardUrlState";
import type { HospitalView } from "@/lib/hospitalUrlState";

// Zdarzenia synchronizują nagłówek portalu z widokiem strony bez przeładowania (filtry zostają w stanie).
export const DASHBOARD_TAB_NAVIGATE_EVENT = "atlas:dashboard-navigate";
export const HOSPITAL_VIEW_NAVIGATE_EVENT = "atlas:hospital-view-navigate";
export const HOSPITAL_VIEW_CHANGED_EVENT = "atlas:hospital-view-changed";

export type DashboardNavigation = { tab: DashboardActiveTab };
export type HospitalNavigation = { view: HospitalView };

/** Eksplorator szpitali (dawne `/szpitale`): profil i porównanie z panelem wyboru szpitala. `/szpitale` to katalog szpitali. */
export const HOSPITAL_EXPLORER_PATH = "/szpitale/eksplorator";

// Adresy modułów portalu używane przez stronę główną i nagłówek.
export const DASHBOARD_HREFS = {
  summary: "/hospitalizacje",
  trend: "/analizy",
  mortality: "/analizy?t=k",
  admissions: "/analizy?t=a",
  regions: "/analizy?t=g",
  hospitals: "/szpitale",
  hospital: HOSPITAL_EXPLORER_PATH,
  comparison: `${HOSPITAL_EXPLORER_PATH}?hv=c`,
  methodology: "/o-danych",
} as const;

export function tabFromDashboardHref(href: string): DashboardActiveTab | null {
  return navigationFromDashboardHref(href)?.tab ?? null;
}

/** Widok eksploratora dla adresu /analizy; `null` dla innych stron. */
export function navigationFromDashboardHref(href: string): DashboardNavigation | null {
  const url = new URL(href, "https://atlas.invalid");
  if (url.pathname !== "/analizy") return null;
  const tab = url.searchParams.get("t");
  if (tab === "k") return { tab: "mortality" };
  if (tab === "a") return { tab: "admissions" };
  if (tab === "g") return { tab: "regions" };
  return { tab: "trend" };
}

/** Widok eksploratora szpitali dla jego adresu; `null` dla innych stron (także katalogu `/szpitale`). */
export function hospitalNavigationFromHref(href: string): HospitalNavigation | null {
  const url = new URL(href, "https://atlas.invalid");
  if (url.pathname !== HOSPITAL_EXPLORER_PATH) return null;
  return { view: url.searchParams.get("hv") === "c" ? "comparison" : "summary" };
}
