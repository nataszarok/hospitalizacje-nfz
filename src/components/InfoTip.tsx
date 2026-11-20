"use client";

import { ActionIcon, Popover } from "@mantine/core";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PHONE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { BottomSheet } from "./BottomSheet";
import styles from "./InfoTip.module.css";

/** Telefon: objaśnienie jako arkusz od dołu (DESIGN.md 6.3, „Dymek objaśnienia”). */
export const INFO_TIP_PHONE_QUERY = PHONE_QUERY;
/** Opóźnienie otwarcia po najechaniu i zamknięcia po zjechaniu (ms): przejście kursora z ikony do dymka nie zamyka dymka. */
const OPEN_DELAY = 150;
const CLOSE_DELAY = 120;

/**
 * Ikona „?” z objaśnieniem pola, liczby, wykresu albo tabeli — bez zajmowania miejsca pod nimi.
 *
 * Dwa tryby (DESIGN.md 6.3, „Dymek objaśnienia”):
 * - szeroki ekran: jasny dymek pod ikoną, od jej lewej krawędzi, do 460 px; bez miejsca pod ikoną — nad nią; zawsze w oknie.
 *   Najechanie i fokus otwierają, kliknięcie przypina, Esc i kliknięcie obok zamykają;
 * - telefon: arkusz od dołu (tytuł = `ariaLabel`, przycisk „Zamknij”), niezależny od miejsca ikony.
 *   Dotknięcie „?” otwiera, dotknięcie tła, „Zamknij” i Esc zamykają.
 */
export function InfoTip({ label, ariaLabel = "Informacja" }: { label: ReactNode; ariaLabel?: string }) {
  const phone = useMediaQuery(INFO_TIP_PHONE_QUERY) === true;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Fokus oddany ikonie po zamknięciu (Esc, „Zamknij”) nie otwiera dymka ponownie.
  const refocusing = useRef(false);
  const refocus = () => { refocusing.current = true; triggerRef.current?.focus(); refocusing.current = false; };
  const id = useId();

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const close = useCallback(() => { clear(); setOpen(false); setPinned(false); }, []);
  const later = (next: boolean, delay: number) => { clear(); timer.current = setTimeout(() => setOpen(next), delay); };
  useEffect(() => clear, []);

  // Esc zamyka i oddaje fokus ikonie (w obu trybach).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      refocus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const trigger = <ActionIcon
    ref={triggerRef}
    variant="subtle"
    color="gray"
    size={20}
    radius="xl"
    aria-label={ariaLabel}
    className={styles.trigger}
    aria-expanded={open}
    aria-controls={open && phone ? id : undefined}
    onClick={() => {
      clear();
      if (phone) { setOpen((value) => !value); return; }
      // Pierwsze kliknięcie przypina otwarty dymek; drugie zamyka.
      if (open && pinned) close(); else { setOpen(true); setPinned(true); }
    }}
    onMouseEnter={phone ? undefined : () => { if (!open) later(true, OPEN_DELAY); else clear(); }}
    onMouseLeave={phone || pinned ? undefined : () => later(false, CLOSE_DELAY)}
    onFocus={phone ? undefined : () => { if (!refocusing.current) setOpen(true); }}
    onBlur={phone || pinned ? undefined : () => later(false, CLOSE_DELAY)}
  ><span className="info-icon">?</span></ActionIcon>;

  if (phone) return <>
    {trigger}
    {open ? <BottomSheet id={id} title={ariaLabel} onClose={() => { close(); refocus(); }}>{label}</BottomSheet> : null}
  </>;

  return <Popover
    opened={open}
    // Bez `onChange`: Popover.Target przełącza dymek przy kliknięciu, a kliknięcie obsługuje ikona (przypięcie).
    // `onDismiss` = kliknięcie obok.
    onDismiss={close}
    position="bottom-start"
    offset={8}
    withArrow
    // „center” = strzałka liczona przez floating-ui względem ikony, więc wskazuje ją także po przesunięciu dymka (shift).
    arrowPosition="center"
    arrowSize={9}
    middlewares={{ flip: true, shift: { padding: 8 } }}
    closeOnClickOutside
    closeOnEscape={false}
    trapFocus={false}
    returnFocus={false}
    withinPortal
    classNames={{ dropdown: styles.dropdown, arrow: styles.arrow }}
  >
    <Popover.Target>{trigger}</Popover.Target>
    <Popover.Dropdown
      role="tooltip"
      onMouseEnter={() => clear()}
      onMouseLeave={pinned ? undefined : () => later(false, CLOSE_DELAY)}
    >{label}</Popover.Dropdown>
  </Popover>;
}

/**
 * Treść podpowiedzi w akapitach (np. `mortalityChartHelp`): jeden akapit = jedna myśl. Akapit może zaczynać się od
 * pogrubionego hasła (`[hasło, tekst]`): tego, co czytelnik widzi na ekranie.
 */
export function HelpLines({ lines }: { lines: (string | [term: string, text: string])[] }) {
  return <>{lines.map((line, i) => <p key={i} style={{ margin: i ? "8px 0 0" : 0 }}>{typeof line === "string" ? line : <><b>{line[0]}</b> {line[1]}</>}</p>)}</>;
}
