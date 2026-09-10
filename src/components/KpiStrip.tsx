import { ActionIcon, Grid, Paper, Tooltip } from "@mantine/core";
import type { KpiSummary } from "@/lib/types";

function integer(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value);
}

function pct(value: number) {
  return `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function KpiInfo({ label }: { label: string }) {
  return <Tooltip label={label} multiline w={300} withArrow position="top" openDelay={150}>
    <ActionIcon variant="subtle" color="gray" size={20} radius="xl" aria-label="Informacja"><span className="info-icon">?</span></ActionIcon>
  </Tooltip>;
}

export function KpiStrip({ current, baseline, compare }: { current: KpiSummary; baseline: KpiSummary; compare: boolean }) {
  const comparisonHelp = " Pierwsza wartość dotyczy aktualnie wyfiltrowanej grupy świadczeniodawców, druga wszystkich świadczeniodawców.";
  const cards = [
    { label: "Świadczeniodawcy", help: `Liczba unikalnych świadczeniodawców spełniających aktualne filtry.${compare ? comparisonHelp : ""}`, value: integer(current.facilities), base: integer(baseline.facilities), raw: current.facilities, rawBase: baseline.facilities, share: true },
    { label: "Hospitalizacje", help: `Łączna liczba hospitalizacji spełniających aktualne filtry.${compare ? comparisonHelp : ""}`, value: integer(current.hospitalizations), base: integer(baseline.hospitalizations), raw: current.hospitalizations, rawBase: baseline.hospitalizations, share: true },
    { label: "Zgony", help: `Łączna liczba zgonów wśród hospitalizacji spełniających aktualne filtry.${compare ? comparisonHelp : ""}`, value: integer(current.deaths), base: integer(baseline.deaths), raw: current.deaths, rawBase: baseline.deaths, share: true },
    { label: "Śmiertelność ogółem", help: `Odsetek zgonów wśród hospitalizacji (zgony / hospitalizacje × 100%).${compare ? comparisonHelp : ""}`, value: pct(current.mortalityPct), base: pct(baseline.mortalityPct), raw: current.mortalityPct, rawBase: baseline.mortalityPct, share: false },
  ];

  return <Grid className="kpi-grid">{cards.map((card) => {
    const retained = card.rawBase > 0 ? (card.raw / card.rawBase) * 100 : 0;
    return <Grid.Col span={3} key={card.label}>
      <Paper component="section" className="kpi-card" withBorder radius="md" p="md" shadow="xs">
        <div className="kpi-label">{card.label}<KpiInfo label={card.help} /></div>
        <div className="kpi-value">{card.value}{compare ? <><span className="kpi-separator"> / </span><span className="kpi-baseline">{card.base}</span></> : null}</div>
        <div className="kpi-secondary">{compare && card.share ? `${pct(retained)} wartości bazowej` : <>&nbsp;</>}</div>
      </Paper>
    </Grid.Col>;
  })}</Grid>;
}
