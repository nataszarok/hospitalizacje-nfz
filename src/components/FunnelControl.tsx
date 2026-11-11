"use client";

import { Switch, Tooltip } from "@mantine/core";
import { FUNNEL_HELP, FUNNEL_NAME, FUNNEL_UNAVAILABLE_REASON } from "@/lib/mortalityFunnel";
import styles from "./FunnelControl.module.css";

/**
 * Przełącznik granic odchyleń (lejek: granice 95% i 99,8%, punkty w kolorach statusu): decyzja tak/nie, więc Switch.
 * Dymek mówi, co oznaczają granice. `disabled`: oś lub układ wykresu nie pozwala na granice — przełącznik
 * jest wyszarzony, a dymek podaje powód.
 */
export function FunnelControl({ value, onChange, disabled = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Tooltip label={disabled ? FUNNEL_UNAVAILABLE_REASON : FUNNEL_HELP} multiline w={disabled ? 240 : 300} withArrow position="top" events={{ hover: true, focus: true, touch: true }}>
    <span className={styles.control}>
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
