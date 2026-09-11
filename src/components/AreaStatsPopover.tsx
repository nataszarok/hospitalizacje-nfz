"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AreaStatsPanel, type AreaStatsPanelProps } from "@/components/AreaStatsPanel";

function StatsIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="area-stats-trigger-icon">
    <path d="M3.5 4.5h13v11h-13z" />
    <path d="M7.5 4.5v11" />
    <path d="M10.5 8h3" />
    <path d="M10.5 11h3" />
  </svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="area-stats-close-icon">
    <path d="m6 6 8 8M14 6l-8 8" />
  </svg>;
}

export function AreaStatsPopover(props: AreaStatsPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return <div className="area-stats-popover-root" ref={rootRef}>
    <button
      ref={triggerRef}
      type="button"
      className={open ? "area-stats-trigger is-open" : "area-stats-trigger"}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen((value) => !value)}
      aria-label="Statystyki obszarów"
      data-tooltip="Statystyki obszarów"
    >
      <StatsIcon />
    </button>

    {open ? <>
      <button
        type="button"
        className="area-stats-backdrop"
        aria-label="Zamknij statystyki obszarów"
        onClick={() => setOpen(false)}
      />
      <div id={panelId} className="area-stats-popover" role="dialog" aria-label="Statystyki obszarów">
        <div className="area-stats-popover-mobile-header">
          <div>
            <div className="area-stats-popover-mobile-kicker">Analiza</div>
            <div className="area-stats-popover-mobile-title">Statystyki obszarów</div>
          </div>
          <button type="button" className="area-stats-popover-close" onClick={() => setOpen(false)} aria-label="Zamknij">
            <CloseIcon />
          </button>
        </div>
        <div className="area-stats-popover-scroll">
          <AreaStatsPanel {...props} />
        </div>
      </div>
    </> : null}
  </div>;
}
