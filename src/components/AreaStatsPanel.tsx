"use client";

import type { AdmissionAreaStatGroup, AreaStatGroup, GeographyMode, ProductOption } from "@/lib/types";

function number(value: number, digits = 0) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

type CommonProps = {
  geographyMode: GeographyMode;
  selectedKeys: string[];
};

type MortalityProps = CommonProps & {
  kind: "mortality";
  groups: AreaStatGroup[];
  baselineGroups: AreaStatGroup[];
  products: ProductOption[];
  hasComparison: boolean;
};

type AdmissionProps = CommonProps & {
  kind: "admissions";
  groups: AdmissionAreaStatGroup[];
};

type AreaStatsPanelProps = MortalityProps | AdmissionProps;

function AreaStatsFrame({ geographyMode, selectedKeys, children }: CommonProps & { children: React.ReactNode }) {
  return <aside className="area-stats-panel">
    <div className="area-stats-heading">
      <div>
        <div className="area-stats-kicker">Statystyki obszarów</div>
        <h3>{geographyMode === "regions" ? "Województwa" : "Miasta"}</h3>
      </div>
      {selectedKeys.length > 0 ? <span className="count-badge">{selectedKeys.length}</span> : null}
    </div>

    {selectedKeys.length === 0 ? <div className="area-stats-empty">Wybierz obszar w panelu po lewej, aby zobaczyć jego statystyki.</div> : children}
  </aside>;
}

function MortalityAreaStats(props: MortalityProps) {
  const groupMap = new Map(props.groups.map((group) => [group.key, group]));
  const baselineMap = new Map(props.baselineGroups.map((group) => [group.key, group]));
  const productMap = new Map(props.products.map((product) => [product.code, product.label]));

  return <div className="area-stat-cards">
    {props.selectedKeys.map((key) => {
      const group = groupMap.get(key);
      if (!group) return null;
      const baseline = baselineMap.get(key);
      return <section className="area-stat-card mortality-area-stat-card" key={key}>
        <div className="area-stat-title">{group.name}</div>
        {group.rows.map((row, index) => {
          const baselineRow = baseline?.rows.find((candidate) => candidate.productCode === row.productCode);
          return <div className={index === 0 ? "area-stat-row primary" : "area-stat-row"} key={row.productCode ?? "total"}>
            <div className="area-stat-label" title={row.productCode ? productMap.get(row.productCode) : undefined}>
              {row.productCode ? (productMap.get(row.productCode) ?? row.productCode) : "Łącznie"}
            </div>
            <div>Hospitalizacje <b>{number(row.hospitalizations)}</b> · Śmiertelność <b>{number(row.mortalityPct, 2)}%</b></div>
            <div>L. świadczeniodawców <b>{row.facilities}</b> · Śr hospitalizacja / świadczeniodawca <b>{number(row.hospitalizationsPerFacility, 1)}</b></div>
            {props.geographyMode === "regions" && row.hospitalizationsPer100k !== null ? <div>Hospitalizacje / 100 tys. mieszk. <b>{number(row.hospitalizationsPer100k, 2)}</b></div> : null}
            {props.hasComparison && baselineRow ? <div className="area-stat-baseline">
              Bez progu hospitalizacji: Hospitalizacje {number(baselineRow.hospitalizations)} · Śmiertelność {number(baselineRow.mortalityPct, 2)}% · L. świadczeniodawców {baselineRow.facilities}
              {props.geographyMode === "regions" && baselineRow.hospitalizationsPer100k !== null ? ` · Hospitalizacje / 100 tys. mieszk. ${number(baselineRow.hospitalizationsPer100k, 2)}` : ""}
            </div> : null}
          </div>;
        })}
      </section>;
    })}
  </div>;
}

function AdmissionAreaStats(props: AdmissionProps) {
  const groupMap = new Map(props.groups.map((group) => [group.key, group]));

  return <div className="area-stat-cards">
    {props.selectedKeys.map((key) => {
      const group = groupMap.get(key);
      if (!group) return null;

      return <section className="area-stat-card admission-area-stat-card" key={key}>
        <div className="area-stat-title">{group.name}</div>
        <div className="area-stat-row primary">
          <div>Planowane <b>{number(group.plannedAdmissions)}</b> · Nagłe <b>{number(group.urgentAdmissions)}</b></div>
          <div>Łącznie <b>{number(group.totalAdmissions)}</b> · L. świadczeniodawców <b>{group.facilities}</b></div>
          <div>Planowane / nagłe <b>{group.plannedToUrgentRatioPct === null ? "—" : `${number(group.plannedToUrgentRatioPct, 1)}%`}</b></div>
        </div>
      </section>;
    })}
  </div>;
}

export function AreaStatsPanel(props: AreaStatsPanelProps) {
  return <AreaStatsFrame geographyMode={props.geographyMode} selectedKeys={props.selectedKeys}>
    {props.kind === "mortality" ? <MortalityAreaStats {...props} /> : <AdmissionAreaStats {...props} />}
  </AreaStatsFrame>;
}
