"use client";

import { SegmentedControl } from "@mantine/core";
import type { AxisMode } from "@/lib/types";
import styles from "./ChartScaleControl.module.css";

type ChartScaleControlProps = {
  value: AxisMode;
  onChange: (value: AxisMode) => void;
  /** Krótka wersja do paska nad wykresem: „Oś X: Hosp. / Na 100 tys.”. */
  compact?: boolean;
};

export function ChartScaleControl({ value, onChange, compact = false }: ChartScaleControlProps) {
  const label = compact ? "Oś X" : "Liczba hospitalizacji";
  return (
    <div className={styles.control} aria-label={label}>
      <span className={styles.label}>{label}</span>
      <SegmentedControl
        value={value}
        onChange={(nextValue) => onChange(nextValue as AxisMode)}
        data={[
          { value: "total", label: compact ? "Hosp." : "Ogółem" },
          { value: "per_100k", label: "Na 100 tys." },
        ]}
        className={compact ? `${styles.segmented} ${styles.compact}` : styles.segmented}
        aria-label={compact ? "Oś X: liczba hospitalizacji" : label}
      />
    </div>
  );
}
