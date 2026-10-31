"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import {
  DASHBOARD_HREFS, DASHBOARD_TAB_CHANGED_EVENT, DASHBOARD_TAB_NAVIGATE_EVENT, HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT,
  hospitalNavigationFromHref, navigationFromDashboardHref, type DashboardNavigation, type HospitalNavigation,
} from "@/lib/dashboardNavigation";
import type { DashboardActiveTab } from "@/lib/dashboardUrlState";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { SearchBox } from "@/components/search/SearchBox";
import { SITE_NAME } from "@/lib/site";
import styles from "./SiteHeader.module.css";

const links = [
  { label: "Start", href: "/", active: "start" },
  { label: "Grupy JGP", href: "/jgp", active: "groups" },
  { label: "Analizy", href: DASHBOARD_HREFS.trend, active: "analyses" },
  { label: "Szpitale", href: DASHBOARD_HREFS.hospital, active: "hospitals" },
  { label: "Porównania", href: DASHBOARD_HREFS.comparison, active: "compare" },
  { label: "O danych", href: DASHBOARD_HREFS.methodology, active: "about" },
] as const;

const analysisOptions = [
  { label: "W czasie", href: DASHBOARD_HREFS.trend, tab: "trend", icon: "chart" },
  { label: "Kto leczy", href: DASHBOARD_HREFS.mortality, tab: "mortality", icon: "heart" },
  { label: "Tryb przyjęcia", href: DASHBOARD_HREFS.admissions, tab: "admissions", icon: "bed" },
  { label: "Gdzie", href: DASHBOARD_HREFS.regions, tab: "regions", icon: "database" },
] as const;

function sectionForPath(pathname: string, search: string) {
  if (pathname === "/") return "start";
  if (pathname.startsWith("/jgp")) return "groups";
  if (pathname.startsWith("/analizy")) return "analyses";
  if (pathname.startsWith("/szpitale")) return hospitalNavigationFromHref(`/szpitale${search}`)?.view === "comparison" ? "compare" : "hospitals";
  if (pathname.startsWith("/o-danych")) return "about";
  return "";
}

// Na tej samej stronie (/analizy, /szpitale) zmiana widoku idzie zdarzeniem, bez przeładowania — filtry zostają.
function navigateInsidePage(event: React.MouseEvent<HTMLAnchorElement>, pathname: string, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const analysis = pathname === "/analizy" ? navigationFromDashboardHref(href) : null;
  const hospital = pathname === "/szpitale" ? hospitalNavigationFromHref(href) : null;
  if (analysis) {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent<DashboardNavigation>(DASHBOARD_TAB_NAVIGATE_EVENT, { detail: analysis }));
  } else if (hospital) {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent<HospitalNavigation>(HOSPITAL_VIEW_NAVIGATE_EVENT, { detail: hospital }));
  }
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [currentAnalysisTab, setCurrentAnalysisTab] = useState<DashboardActiveTab | null>(null);
  const analysisMenuRef = useRef<HTMLDivElement>(null);
  const analysisTriggerRef = useRef<HTMLButtonElement>(null);

  // Strony są właścicielami swojego stanu; nagłówek tylko odzwierciedla aktywną sekcję i widok.
  useEffect(() => {
    const syncNavigation = () => {
      setAnalysisOpen(false);
      setIsOpen(false);
      setSearchOpen(false);
      setCurrentSection(sectionForPath(pathname, window.location.search));
      setCurrentAnalysisTab(pathname === "/analizy" ? navigationFromDashboardHref(`/analizy${window.location.search}`)?.tab ?? null : null);
    };
    syncNavigation();
    const onAnalysisChange = (event: Event) => {
      setCurrentAnalysisTab((event as CustomEvent<DashboardNavigation>).detail.tab);
      setCurrentSection("analyses");
    };
    const onHospitalChange = (event: Event) => {
      setCurrentSection((event as CustomEvent<HospitalNavigation>).detail.view === "comparison" ? "compare" : "hospitals");
    };
    window.addEventListener("popstate", syncNavigation);
    window.addEventListener("hashchange", syncNavigation);
    window.addEventListener(DASHBOARD_TAB_CHANGED_EVENT, onAnalysisChange);
    window.addEventListener(HOSPITAL_VIEW_CHANGED_EVENT, onHospitalChange);
    return () => {
      window.removeEventListener("popstate", syncNavigation);
      window.removeEventListener("hashchange", syncNavigation);
      window.removeEventListener(DASHBOARD_TAB_CHANGED_EVENT, onAnalysisChange);
      window.removeEventListener(HOSPITAL_VIEW_CHANGED_EVENT, onHospitalChange);
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

  const current = currentSection || sectionForPath(pathname, "");
  // Strona główna ma duże pole wyszukiwania w hero, więc nagłówek go nie powtarza.
  const showSearch = pathname !== "/";

  return <header className={styles.header}>
    <div className={styles.inner}>
      <Link className={styles.brand} href="/" onClick={() => { setIsOpen(false); setAnalysisOpen(false); setCurrentSection("start"); }} aria-label={`${SITE_NAME} — strona główna`}>
        <span className={styles.brandSymbol}><BrandMark /></span>
        <span className={styles.brandText}><strong>{SITE_NAME}</strong><span>Hospitalizacje · Szpitale · JGP</span></span>
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
                  navigateInsidePage(event, pathname, option.href);
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
            navigateInsidePage(event, pathname, href);
            setCurrentSection(active);
          }}
        >{label}</Link>)}
      </nav>
      <div className={styles.end}>
        {showSearch ? <div className={styles.searchInline}><SearchBox variant="header" /></div> : null}
        {showSearch ? <button
          type="button"
          className={styles.searchButton}
          aria-label={searchOpen ? "Zamknij wyszukiwarkę" : "Szukaj"}
          aria-expanded={searchOpen}
          aria-controls="header-search"
          onClick={() => { setSearchOpen((open) => !open); setIsOpen(false); }}
        ><PortalIcon name={searchOpen ? "close" : "search"} size={20} /></button> : null}
        <button type="button" className={styles.menuButton} aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"} aria-expanded={isOpen} aria-controls="portal-navigation" onClick={() => { setIsOpen((open) => !open); setAnalysisOpen(false); }}><PortalIcon name={isOpen ? "close" : "menu"} size={22} /></button>
      </div>
    </div>
    {showSearch && searchOpen ? <div id="header-search" className={styles.searchPanel}><SearchBox variant="header" autoFocus onNavigate={() => setSearchOpen(false)} /></div> : null}
  </header>;
}
