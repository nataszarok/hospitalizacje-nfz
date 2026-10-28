import type { ReactNode } from "react";

type IconName = "heart" | "bed" | "hospital" | "compare" | "arrow" | "book" | "database" | "calendar" | "shield" | "menu" | "close" | "external" | "chart" | "chevron";

const paths: Record<IconName, ReactNode> = {
  heart: <><path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/><path d="M3 12h5l2-3 3.2 6 1.8-3H21"/></>,
  bed: <><path d="M3 4v16M3 16h18v4M3 9h5a3 3 0 0 1 3 3v4M11 10h7a3 3 0 0 1 3 3v3M3 20h18"/></>,
  hospital: <><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M10 21v-5h4v5M9 8h6M12 5v6M8 13h.01M16 13h.01"/></>,
  compare: <><path d="M4 20V11h4v9M10 20V5h4v15M16 20v-8h4v8M2 20h20"/></>,
  arrow: <><path d="M4 12h16M13 5l7 7-7 7"/></>,
  book: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1ZM12 6v14"/></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="M5 5l14 14M19 5 5 19"/></>,
  external: <><path d="M14 4h6v6M20 4 10 14M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/></>,
  chart: <><path d="M3 3v18h18M6 16l5-6 4 3 5-7"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
};

export function PortalIcon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}
