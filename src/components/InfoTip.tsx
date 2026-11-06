import { ActionIcon, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

/** Ikona „?” z podpowiedzią: objaśnienie pola lub liczby bez zajmowania miejsca pod nim. */
export function InfoTip({ label, ariaLabel = "Informacja" }: { label: ReactNode; ariaLabel?: string }) {
  return <Tooltip label={label} multiline w={300} withArrow position="top" openDelay={150} events={{ hover: true, focus: true, touch: true }}>
    <ActionIcon variant="subtle" color="gray" size={20} radius="xl" aria-label={ariaLabel}><span className="info-icon">?</span></ActionIcon>
  </Tooltip>;
}
