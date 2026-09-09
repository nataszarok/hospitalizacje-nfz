import { ActionIcon, Tooltip } from "@mantine/core";
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
  const cards = [
    { label: "Placówki", help: "", value: integer(current.facilities), base: integer(baseline.facilities), raw: current.facilities, rawBase: baseline.facilities, share: true },
    { label: "Hospitalizacje", help: "", value: integer(current.hospitalizations), base: integer(baseline.hospitalizations), raw: current.hospitalizations, rawBase: baseline.hospitalizations, share: true },
    { label: "Zgony", help: "", value: integer(current.deaths), base: integer(baseline.deaths), raw: current.deaths, rawBase: baseline.deaths, share: true },
    { label: "Śmiertelność ogółem", help: "", value: pct(current.mortalityPct), base: pct(baseline.mortalityPct), raw: current.mortalityPct, rawBase: baseline.mortalityPct, share: false },
  ];

  return <div className="kpi-grid">{cards.map((card) => {
    const retained = card.rawBase > 0 ? (card.raw / card.rawBase) * 100 : 0;
    return <section className="kpi-card" key={card.label}>
      <div className="kpi-label">{card.label}<KpiInfo label={card.help} /></div>
      <div className="kpi-value">{card.value}{compare ? <><span className="kpi-separator"> / </span><span className="kpi-baseline">{card.base}</span></> : null}</div>
      {compare && card.share ? <div className="kpi-secondary">{pct(retained)} wartości bazowej</div> : <div className="kpi-secondary">&nbsp;</div>}
    </section>;
  })}</div>;
}
