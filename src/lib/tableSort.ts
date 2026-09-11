export type SortDirection = "asc" | "desc";

export type SortState<Key extends string> = {
  key: Key;
  direction: SortDirection;
} | null;

export function nextSortState<Key extends string>(
  current: SortState<Key>,
  key: Key,
): SortState<Key> {
  if (!current || current.key !== key) {
    return { key, direction: "asc" };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

export function compareTableValues(
  left: string | number,
  right: string | number,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "pl-PL", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortTableRows<Row>(
  rows: Row[],
  direction: SortDirection,
  getValue: (row: Row) => string | number,
): Row[] {
  const factor = direction === "asc" ? 1 : -1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareTableValues(getValue(left.row), getValue(right.row));
      return result === 0 ? left.index - right.index : result * factor;
    })
    .map(({ row }) => row);
}
