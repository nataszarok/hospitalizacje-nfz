import { ActionIcon, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

/** Ikona „?” z podpowiedzią: objaśnienie pola lub liczby bez zajmowania miejsca pod nim. */
export function InfoTip({ label, ariaLabel = "Informacja" }: { label: ReactNode; ariaLabel?: string }) {
  return <Tooltip label={label} multiline w={300} withArrow position="top" openDelay={150} events={{ hover: true, focus: true, touch: true }}>
    <ActionIcon variant="subtle" color="gray" size={20} radius="xl" aria-label={ariaLabel}><span className="info-icon">?</span></ActionIcon>
  </Tooltip>;
}

/** Treść podpowiedzi w akapitach (np. `mortalityChartHelp`): jeden akapit = jedna myśl. */
export function HelpLines({ lines }: { lines: string[] }) {
  return <>{lines.map((line, i) => <p key={i} style={{ margin: i ? "6px 0 0" : 0 }}>{line}</p>)}</>;
}
