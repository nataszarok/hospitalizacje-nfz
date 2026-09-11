"use client";

import { formatCityName } from "@/lib/formatters";
import type { MortalityDisplayMode } from "@/lib/mortality";
import { ratioPct } from "@/lib/metrics";
import type {
  AdmissionRow,
  AreaStatGroup,
  GeographyMode,
  ProductOption,
} from "@/lib/types";

function number(value: number, digits = 0) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

type CommonProps = {
  geographyMode: GeographyMode;
  selectedKeys: string[];
  displayMode: MortalityDisplayMode;
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
  rows: AdmissionRow[];
  products: ProductOption[];
};

export type AreaStatsPanelProps = MortalityProps | AdmissionProps;

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
      const rows = group.rows.filter((row) =>
        props.displayMode === "combined" ? row.productCode === null : row.productCode !== null,
      );

      return <section className="area-stat-card mortality-area-stat-card" key={key}>
        <div className="area-stat-title">{props.geographyMode === "cities" ? formatCityName(group.name) : group.name}</div>
        {rows.map((row, index) => {
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

function admissionAreaKey(row: AdmissionRow, geographyMode: GeographyMode) {
  return geographyMode === "regions" ? row.owNfz : row.city.trim();
}

function summarizeAdmissionRows(rows: AdmissionRow[]) {
  const plannedAdmissions = rows.reduce((sum, row) => sum + row.plannedAdmissions, 0);
  const urgentAdmissions = rows.reduce((sum, row) => sum + row.urgentAdmissions, 0);
  const totalAdmissions = rows.reduce((sum, row) => sum + row.totalAdmissions, 0);
  const facilities = new Set(rows.map((row) => `${row.owNfz}|${row.nip}`)).size;

  return {
    plannedAdmissions,
    urgentAdmissions,
    totalAdmissions,
    facilities,
    plannedToUrgentRatioPct: ratioPct(plannedAdmissions, urgentAdmissions),
  };
}

function AdmissionAreaStats(props: AdmissionProps) {
  const productMap = new Map(props.products.map((product) => [product.code, product.label]));

  return <div className="area-stat-cards">
    {props.selectedKeys.map((key) => {
      const areaRows = props.rows.filter((row) => admissionAreaKey(row, props.geographyMode) === key);
      if (areaRows.length === 0) return null;

      const name = props.geographyMode === "cities"
        ? formatCityName(key)
        : (areaRows[0]?.voivodeship ?? key);

      const statRows = props.displayMode === "combined"
        ? [{ productCode: null as string | null, ...summarizeAdmissionRows(areaRows) }]
        : [...new Set(areaRows.map((row) => row.productCode))].map((productCode) => ({
            productCode,
            ...summarizeAdmissionRows(areaRows.filter((row) => row.productCode === productCode)),
          }));

      return <section className="area-stat-card admission-area-stat-card" key={key}>
        <div className="area-stat-title">{name}</div>
        {statRows.map((row, index) => (
          <div className={index === 0 ? "area-stat-row primary" : "area-stat-row"} key={row.productCode ?? "total"}>
            <div className="area-stat-label" title={row.productCode ? productMap.get(row.productCode) : undefined}>
              {row.productCode ? (productMap.get(row.productCode) ?? row.productCode) : "Łącznie"}
            </div>
            <div>Planowane <b>{number(row.plannedAdmissions)}</b> · Nagłe <b>{number(row.urgentAdmissions)}</b></div>
            <div>Łącznie <b>{number(row.totalAdmissions)}</b> · L. świadczeniodawców <b>{row.facilities}</b></div>
            <div>Planowane / nagłe <b>{row.plannedToUrgentRatioPct === null ? "—" : `${number(row.plannedToUrgentRatioPct, 1)}%`}</b></div>
          </div>
        ))}
      </section>;
    })}
  </div>;
}

export function AreaStatsPanel(props: AreaStatsPanelProps) {
  return <AreaStatsFrame
    geographyMode={props.geographyMode}
    selectedKeys={props.selectedKeys}
    displayMode={props.displayMode}
  >
    {props.kind === "mortality" ? <MortalityAreaStats {...props} /> : <AdmissionAreaStats {...props} />}
  </AreaStatsFrame>;
}
