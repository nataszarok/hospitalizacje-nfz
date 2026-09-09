"use client";

import { Badge, Card, Group, Stack, Text } from "@mantine/core";
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
    <Group justify="space-between" align="flex-start" className="area-stats-heading">
      <div>
        <Text className="area-stats-kicker">Statystyki obszarów</Text>
        <Text fw={700} size="sm">{geographyMode === "regions" ? "Województwa" : "Miasta"}</Text>
      </div>
      {selectedKeys.length > 0 ? <Badge variant="light" color="blue" radius="xl">{selectedKeys.length}</Badge> : null}
    </Group>

    {selectedKeys.length === 0 ? <Text className="area-stats-empty">Wybierz obszar w panelu po lewej, aby zobaczyć jego statystyki.</Text> : null}

    <Stack gap="sm">
      {selectedKeys.map((key) => {
        const group = groupMap.get(key);
        if (!group) return null;
        const baseline = baselineMap.get(key);
        return <Card withBorder radius="md" padding="sm" key={key} className="area-stat-card">
          <Text fw={700} size="sm" mb={6}>{group.name}</Text>
          <Stack gap={8}>
            {group.rows.map((row) => {
              const baselineRow = baseline?.rows.find((candidate) => candidate.productCode === row.productCode);
              return <div className="area-stat-row" key={row.productCode ?? "total"}>
                <Text size="xs" fw={700} lineClamp={2} title={row.productCode ? productMap.get(row.productCode) : undefined}>
                  {row.productCode ? (productMap.get(row.productCode) ?? row.productCode) : "Łącznie"}
                </Text>
                <div className="area-metrics-flow"><span>Hosp. <b>{number(row.hospitalizations)}</b></span><span>Śmiert. <b>{number(row.mortalityPct, 2)}%</b></span><span>Hosp./plac. <b>{number(row.hospitalizationsPerFacility, 1)}</b></span><span>Placówki <b>{row.facilities}</b></span>{geographyMode === "regions" && row.hospitalizationsPer100k !== null ? <span>Hosp./100 tys. <b>{number(row.hospitalizationsPer100k, 2)}</b></span> : null}</div>
                {hasComparison && baselineRow ? <Text size="xs" c="dimmed" mt={7} className="area-stat-baseline">
                  Bez progu: Hosp. {number(baselineRow.hospitalizations)} · Śmiert. {number(baselineRow.mortalityPct, 2)}% · Placówki {baselineRow.facilities}
                  {geographyMode === "regions" && baselineRow.hospitalizationsPer100k !== null ? ` · Hosp./100 tys. ${number(baselineRow.hospitalizationsPer100k, 2)}` : ""}
                </Text> : null}
              </div>;
            })}
          </Stack>
        </Card>;
      })}
    </Stack>
  </aside>;
}
