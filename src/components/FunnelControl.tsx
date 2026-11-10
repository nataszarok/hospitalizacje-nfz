"use client";

import { Switch, Tooltip } from "@mantine/core";
import { FUNNEL_UNAVAILABLE_REASON } from "@/lib/mortalityFunnel";
import styles from "./FunnelControl.module.css";

/**
 * Przełącznik lejka śmiertelności (granice 95% i 99,8%, punkty w kolorach statusu): decyzja tak/nie, więc Switch.
 * `disabled`: oś lub układ wykresu nie pozwala na lejek — przełącznik jest wyszarzony, a powód jest w dymku.
 */
export function FunnelControl({ value, onChange, disabled = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const control = <span className={styles.control}>
    <Switch
      checked={value && !disabled}
      onChange={(event) => onChange(event.currentTarget.checked)}
      disabled={disabled}
      label="Lejek"
      size="sm"
      color="atlas"
      classNames={{ label: styles.label }}
      aria-label="Lejek śmiertelności"
    />
  </span>;

  return disabled
    ? <Tooltip label={FUNNEL_UNAVAILABLE_REASON} multiline w={240} withArrow position="top" events={{ hover: true, focus: true, touch: true }}>{control}</Tooltip>
    : control;
}
