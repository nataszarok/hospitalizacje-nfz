"use client";

import { SegmentedControl } from "@mantine/core";
import type { MortalityDisplayMode } from "@/lib/mortality";
import styles from "./MortalityDisplayControl.module.css";

type MortalityDisplayControlProps = {
  value: MortalityDisplayMode;
  onChange: (value: MortalityDisplayMode) => void;
};

export function MortalityDisplayControl({ value, onChange }: MortalityDisplayControlProps) {
  return (
    <div className={styles.control} aria-label="Zestawienie JGP">
      <span className={styles.label}>Zestawienie JGP</span>
      <SegmentedControl
        value={value}
        onChange={(nextValue) => onChange(nextValue as MortalityDisplayMode)}
        data={[
          { value: "combined", label: "Zbiorczo" },
          { value: "per_jgp", label: "Per JGP" },
        ]}
        className={styles.segmented}
        aria-label="Zestawienie JGP"
      />
    </div>
  );
}
