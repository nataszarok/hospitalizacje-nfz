"use client";

import { SegmentedControl } from "@mantine/core";
import type { AxisMode } from "@/lib/types";
import styles from "./ChartScaleControl.module.css";

type ChartScaleControlProps = {
  value: AxisMode;
  onChange: (value: AxisMode) => void;
};

export function ChartScaleControl({ value, onChange }: ChartScaleControlProps) {
  return (
    <div className={styles.control} aria-label="Liczba hospitalizacji">
      <span className={styles.label}>Liczba hospitalizacji</span>
      <SegmentedControl
        value={value}
        onChange={(nextValue) => onChange(nextValue as AxisMode)}
        data={[
          { value: "total", label: "Ogółem" },
          { value: "per_100k", label: "Na 100 tys." },
        ]}
        className={styles.segmented}
        aria-label="Liczba hospitalizacji"
      />
    </div>
  );
}
