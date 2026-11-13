"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import {
  DASHBOARD_HREFS, DASHBOARD_TAB_NAVIGATE_EVENT, HOSPITAL_EXPLORER_PATH, HOSPITAL_VIEW_CHANGED_EVENT, HOSPITAL_VIEW_NAVIGATE_EVENT,
  hospitalNavigationFromHref, navigationFromDashboardHref, type DashboardNavigation, type HospitalNavigation,
} from "@/lib/dashboardNavigation";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { SearchBox } from "@/components/search/SearchBox";
import { SITE_NAME } from "@/lib/site";
import styles from "./SiteHeader.module.css";

const links = [
  { label: "Start", href: "/", active: "start" },
  { label: "Przegląd", href: DASHBOARD_HREFS.summary, active: "summary" },
  { label: "Grupy JGP", href: "/jgp", active: "groups" },
  { label: "Eksplorator JGP", href: DASHBOARD_HREFS.trend, active: "analyses" },
  { label: "Szpitale", href: DASHBOARD_HREFS.hospitals, active: "hospitals" },
  { label: "Porównania", href: DASHBOARD_HREFS.comparison, active: "compare" },
  { label: "O danych", href: DASHBOARD_HREFS.methodology, active: "about" },
] as const;

function sectionForPath(pathname: string) {
  if (pathname === "/") return "start";
  if (pathname.startsWith("/hospitalizacje")) return "summary";
  if (pathname.startsWith("/jgp")) return "groups";
  if (pathname.startsWith("/analizy")) return "analyses";
  // Strona porównania szpitali (dawny eksplorator szpitali: został sam widok Porównanie).
  if (pathname.startsWith(HOSPITAL_EXPLORER_PATH)) return "compare";
  if (pathname.startsWith("/szpitale")) return "hospitals";
  if (pathname.startsWith("/o-danych")) return "about";
  return "";
}

// Na tej samej stronie (/analizy, porównanie szpitali) zmiana widoku idzie zdarzeniem, bez przeładowania — filtry zostają.
// Eksplorator ma jedną pozycję w menu; widoki wybiera się w nim samym.
function navigateInsidePage(event: React.MouseEvent<HTMLAnchorElement>, pathname: string, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const analysis = pathname === "/analizy" ? navigationFromDashboardHref(href) : null;
  const hospital = pathname === HOSPITAL_EXPLORER_PATH ? hospitalNavigationFromHref(href) : null;
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
  const [currentSection, setCurrentSection] = useState<string>("");
  const headerRef = useRef<HTMLElement>(null);

  // Wysokość nagłówka w `--atlas-header-height`: przypięte elementy stron (np. nagłówek tabeli) stają pod nim.
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;
    const sync = () => document.documentElement.style.setProperty("--atlas-header-height", `${Math.floor(header.getBoundingClientRect().height)}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Strony są właścicielami swojego stanu; nagłówek tylko odzwierciedla aktywną sekcję i widok.
  useEffect(() => {
    const syncNavigation = () => {
      setIsOpen(false);
      setSearchOpen(false);
      setCurrentSection(sectionForPath(pathname));
    };
    syncNavigation();
    const onHospitalChange = (event: Event) => {
      if ((event as CustomEvent<HospitalNavigation>).detail.view === "comparison") setCurrentSection("compare");
    };
    window.addEventListener("popstate", syncNavigation);
    window.addEventListener("hashchange", syncNavigation);
    window.addEventListener(HOSPITAL_VIEW_CHANGED_EVENT, onHospitalChange);
    return () => {
      window.removeEventListener("popstate", syncNavigation);
      window.removeEventListener("hashchange", syncNavigation);
      window.removeEventListener(HOSPITAL_VIEW_CHANGED_EVENT, onHospitalChange);
    };
  }, [pathname]);

  const current = currentSection || sectionForPath(pathname);
  // Strona główna ma duże pole wyszukiwania w hero, więc nagłówek go nie powtarza.
  const showSearch = pathname !== "/";

  return <header ref={headerRef} className={styles.header}>
    <div className={styles.inner}>
      <Link className={styles.brand} href="/" onClick={() => { setIsOpen(false); setCurrentSection("start"); }} aria-label={`${SITE_NAME} — strona główna`}>
        <span className={styles.brandSymbol}><BrandMark /></span>
        <span className={styles.brandText}>{SITE_NAME}</span>
      </Link>
      <nav id="portal-navigation" className={`${styles.nav} ${isOpen ? styles.navOpen : ""}`} aria-label="Nawigacja portalu">
        {links.map(({ href, label, active }) => <Link
          key={active}
          href={href}
          className={`${styles.link} ${current === active ? styles.linkActive : ""}`}
          aria-current={current === active ? "page" : undefined}
          onClick={(event) => {
            setIsOpen(false);
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
        <button type="button" className={styles.menuButton} aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"} aria-expanded={isOpen} aria-controls="portal-navigation" onClick={() => setIsOpen((open) => !open)}><PortalIcon name={isOpen ? "close" : "menu"} size={22} /></button>
      </div>
    </div>
    {showSearch && searchOpen ? <div id="header-search" className={styles.searchPanel}><SearchBox variant="header" autoFocus onNavigate={() => setSearchOpen(false)} /></div> : null}
  </header>;
}
