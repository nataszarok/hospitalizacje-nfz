"use client";

import { Switch, Tooltip } from "@mantine/core";
import { FUNNEL_HELP, FUNNEL_NAME, FUNNEL_UNAVAILABLE_REASON } from "@/lib/mortalityFunnel";
import styles from "./FunnelControl.module.css";

/**
 * Przełącznik granic odchyleń (lejek: granice 95% i 99,8%, punkty w kolorach statusu): decyzja tak/nie, więc Switch.
 * Dymek mówi, co oznaczają granice. `disabled`: oś lub układ wykresu nie pozwala na granice — przełącznik
 * jest wyszarzony, a dymek podaje powód.
 */
export function FunnelControl({ value, onChange, disabled = false, disabledReason = FUNNEL_UNAVAILABLE_REASON }: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Dymek wyszarzonego przełącznika (`funnelUnavailableReason`). */
  disabledReason?: string;
}) {
  // Wyszarzony przełącznik dostaje fokus z klawiatury przez obudowę (`tabIndex`), bo wyłączony input go nie przyjmuje.
  return <Tooltip label={disabled ? disabledReason : FUNNEL_HELP} multiline w={disabled ? 260 : 300} withArrow position="top" events={{ hover: true, focus: true, touch: true }}>
    <span className={disabled ? `${styles.control} ${styles.disabled}` : styles.control} tabIndex={disabled ? 0 : undefined}>
      <Switch
        checked={value && !disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        disabled={disabled}
        label={FUNNEL_NAME}
        size="sm"
        color="atlas"
        classNames={{ label: styles.label }}
        aria-label={`${FUNNEL_NAME} od średniej`}
      />
    </span>
  </Tooltip>;
}
