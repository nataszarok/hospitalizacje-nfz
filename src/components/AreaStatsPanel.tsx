"use client";

import type { AreaStatGroup, GeographyMode, ProductOption } from "@/lib/types";

function number(value: number, digits = 0) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function AreaStatsPanel({
  geographyMode,
  selectedKeys,
  groups,
  baselineGroups,
  products,
  hasComparison,
}: {
  geographyMode: GeographyMode;
  selectedKeys: string[];
  groups: AreaStatGroup[];
  baselineGroups: AreaStatGroup[];
  products: ProductOption[];
  hasComparison: boolean;
}) {
  const groupMap = new Map(groups.map((group) => [group.key, group]));
  const baselineMap = new Map(baselineGroups.map((group) => [group.key, group]));
  const productMap = new Map(products.map((product) => [product.code, product.label]));

  return <aside className="area-stats-panel">
    <div className="area-stats-heading">
      <div>
        <div className="area-stats-kicker">Statystyki obszarów</div>
        <h3>{geographyMode === "regions" ? "Województwa" : "Miasta"}</h3>
      </div>
      {selectedKeys.length > 0 ? <span className="count-badge">{selectedKeys.length}</span> : null}
    </div>

    {selectedKeys.length === 0 ? <div className="area-stats-empty">Wybierz obszar w panelu po lewej, aby zobaczyć jego statystyki.</div> : null}

    <div className="area-stat-cards">
      {selectedKeys.map((key) => {
        const group = groupMap.get(key);
        if (!group) return null;
        const baseline = baselineMap.get(key);
        return <section className="area-stat-card" key={key}>
          <div className="area-stat-title">{group.name}</div>
          {group.rows.map((row, index) => {
            const baselineRow = baseline?.rows.find((candidate) => candidate.productCode === row.productCode);
            return <div className={index === 0 ? "area-stat-row primary" : "area-stat-row"} key={row.productCode ?? "total"}>
              <div className="area-stat-label" title={row.productCode ? productMap.get(row.productCode) : undefined}>
                {row.productCode ? (productMap.get(row.productCode) ?? row.productCode) : "Łącznie"}
              </div>
              <div>Hosp. <b>{number(row.hospitalizations)}</b> · Śmiert. <b>{number(row.mortalityPct, 2)}%</b></div>
              <div>Hosp./świadczeniodawcę <b>{number(row.hospitalizationsPerFacility, 1)}</b> · Świadczeniodawcy <b>{row.facilities}</b></div>
              {geographyMode === "regions" && row.hospitalizationsPer100k !== null ? <div>Hosp./100 tys. <b>{number(row.hospitalizationsPer100k, 2)}</b></div> : null}
              {hasComparison && baselineRow ? <div className="area-stat-baseline">
                Bez progu: Hosp. {number(baselineRow.hospitalizations)} · Śmiert. {number(baselineRow.mortalityPct, 2)}% · Świadczeniodawcy {baselineRow.facilities}
                {geographyMode === "regions" && baselineRow.hospitalizationsPer100k !== null ? ` · Hosp./100 tys. ${number(baselineRow.hospitalizationsPer100k, 2)}` : ""}
              </div> : null}
            </div>;
          })}
        </section>;
      })}
    </div>
  </aside>;
}
