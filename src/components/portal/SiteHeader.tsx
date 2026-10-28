"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { DASHBOARD_HREFS, DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT, navigationFromDashboardHref, type DashboardNavigation } from "@/lib/dashboardNavigation";
import type { DashboardActiveTab } from "@/lib/dashboardUrlState";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { SITE_NAME } from "@/lib/site";
import styles from "./SiteHeader.module.css";

const links = [
  { label: "Start", href: "/", active: "start" },
  { label: "Analizy", href: DASHBOARD_HREFS.mortality, active: "analyses" },
  { label: "Szpitale", href: DASHBOARD_HREFS.hospital, active: "hospitals" },
  { label: "Porównania", href: DASHBOARD_HREFS.comparison, active: "compare" },
  { label: "O danych", href: DASHBOARD_HREFS.methodology, active: "about" },
] as const;

const analysisOptions = [
  { label: "Hospitalizacje a śmiertelność", href: DASHBOARD_HREFS.mortality, tab: "mortality", icon: "heart" },
  { label: "Hospitalizacje – Tryb Przyjęcia", href: DASHBOARD_HREFS.admissions, tab: "admissions", icon: "bed" },
] as const;

function sectionForNavigation({ tab, hospitalSubtab }: DashboardNavigation) {
  if (tab === "methodology") return "about";
  if (tab === "hospital") return hospitalSubtab === "comparison" ? "compare" : "hospitals";
  return "analyses";
}

// Na stronie /analizy zmiana podstrony nie przeładowuje dashboardu, więc filtry zostają.
function navigateInsideDashboard(event: React.MouseEvent<HTMLAnchorElement>, pathname: string, href: string) {
  const navigation = navigationFromDashboardHref(href);
  if (!navigation || pathname !== "/analizy") return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  window.dispatchEvent(new CustomEvent<DashboardNavigation>(DASHBOARD_TAB_NAVIGATE_EVENT, { detail: navigation }));
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [currentAnalysisTab, setCurrentAnalysisTab] = useState<DashboardActiveTab>("mortality");
  const analysisMenuRef = useRef<HTMLDivElement>(null);
  const analysisTriggerRef = useRef<HTMLButtonElement>(null);

  // The dashboard owns filters and the active analysis. The portal header only
  // reflects its navigation state; no chart or sidebar code is changed.
  useEffect(() => {
    const syncNavigation = () => {
      setAnalysisOpen(false);
      setIsOpen(false);
      if (pathname === "/") {
        setCurrentSection("start");
      } else if (pathname.startsWith("/analizy")) {
        const navigation = navigationFromDashboardHref(`/analizy${window.location.search}`) ?? { tab: "mortality" };
        setCurrentAnalysisTab(navigation.tab);
        setCurrentSection(sectionForNavigation(navigation));
      } else {
        setCurrentSection("");
      }
    };
    syncNavigation();
    const onDashboardTabChange = (event: Event) => {
      const navigation = (event as CustomEvent<DashboardNavigation>).detail;
      setCurrentAnalysisTab(navigation.tab);
      setCurrentSection(sectionForNavigation(navigation));
    };
    window.addEventListener("popstate", syncNavigation);
    window.addEventListener("hashchange", syncNavigation);
    window.addEventListener(DASHBOARD_TAB_CHANGED_EVENT, onDashboardTabChange);
    return () => {
      window.removeEventListener("popstate", syncNavigation);
      window.removeEventListener("hashchange", syncNavigation);
      window.removeEventListener(DASHBOARD_TAB_CHANGED_EVENT, onDashboardTabChange);
    };
  }, [pathname]);

  useEffect(() => {
    if (!analysisOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!analysisMenuRef.current?.contains(event.target as Node)) setAnalysisOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAnalysisOpen(false);
        analysisTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [analysisOpen]);

  const current = pathname === "/"
    ? "start"
    : pathname.startsWith("/analizy")
      ? currentSection || "analyses"
      : "";

  return <header className={styles.header}>
    <div className={styles.inner}>
      <Link className={styles.brand} href="/" onClick={() => { setIsOpen(false); setAnalysisOpen(false); setCurrentSection("start"); }} aria-label={`${SITE_NAME} — strona główna`}>
        <span className={styles.brandSymbol}><BrandMark /></span>
        <span className={styles.brandText}><strong>{SITE_NAME}</strong><span>Dane · Analizy · Porównania</span></span>
      </Link>
      <nav id="portal-navigation" className={`${styles.nav} ${isOpen ? styles.navOpen : ""}`} aria-label="Nawigacja portalu">
        {links.map(({ href, label, active }) => active === "analyses" ? (
          <div key={active} className={styles.analysisMenu} ref={analysisMenuRef}>
            <button
              ref={analysisTriggerRef}
              type="button"
              className={`${styles.link} ${styles.analysisTrigger} ${current === "analyses" ? styles.linkActive : ""}`}
              aria-expanded={analysisOpen}
              aria-controls="analysis-navigation-menu"
              aria-haspopup="true"
              onClick={() => setAnalysisOpen((open) => !open)}
            >
              Analizy <span className={`${styles.chevron} ${analysisOpen ? styles.chevronOpen : ""}`} aria-hidden="true" />
            </button>
            {analysisOpen && <div id="analysis-navigation-menu" className={styles.analysisDropdown} aria-label="Wybierz rodzaj analizy">
              {analysisOptions.map((option) => <Link
                key={option.tab}
                href={option.href}
                className={`${styles.analysisOption} ${current === "analyses" && currentAnalysisTab === option.tab ? styles.analysisOptionActive : ""}`}
                aria-current={current === "analyses" && currentAnalysisTab === option.tab ? "page" : undefined}
                onClick={(event) => {
                  setAnalysisOpen(false);
                  setIsOpen(false);
                  setCurrentSection("analyses");
                  // Switching views inside /analizy must preserve all active filters.
                  navigateInsideDashboard(event, pathname, option.href);
                }}
              >
                <PortalIcon name={option.icon} size={19} />
                <span>{option.label}</span>
              </Link>)}
            </div>}
          </div>
        ) : <Link
          key={active}
          href={href}
          className={`${styles.link} ${current === active ? styles.linkActive : ""}`}
          aria-current={current === active ? "page" : undefined}
          onClick={(event) => {
            setIsOpen(false);
            setAnalysisOpen(false);
            navigateInsideDashboard(event, pathname, href);
            setCurrentSection(active);
          }}
        >{label}</Link>)}
      </nav>
      <div className={styles.end}>
        <button type="button" className={styles.menuButton} aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"} aria-expanded={isOpen} aria-controls="portal-navigation" onClick={() => { setIsOpen((open) => !open); setAnalysisOpen(false); }}><PortalIcon name={isOpen ? "close" : "menu"} size={22} /></button>
      </div>
    </div>
  </header>;
}
