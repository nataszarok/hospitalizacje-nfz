export type CatalogSortKey = "latest" | "change" | "mortality" | "value" | "valueChange" | "code";
export type CatalogKind = "all" | "procedural" | "conservative";

/**
 * Stan katalogu `/jgp` w adresie: `q` (szukaj), `rodzaj=zabiegowe|zachowawcze`, `min` (próg hospitalizacji),
 * `wycofane=1`, `sort=zmiana|smiertelnosc|kwota|zmiana-kwoty|kod` i `kier=rosnaco|malejaco` (tylko gdy inny niż domyślny dla kolumny).
 */
export interface JgpCatalogUrlState {
  query: string;
  kind: CatalogKind;
  minLatest: number;
  showDiscontinued: boolean;
  sort: { key: CatalogSortKey; desc: boolean };
}

export const MIN_LATEST_OPTIONS = [0, 100, 1000, 10000];

/** Domyślny kierunek: liczby malejąco, kod alfabetycznie. */
export const defaultSortDesc = (key: CatalogSortKey) => key !== "code";

export const DEFAULT_CATALOG_STATE: JgpCatalogUrlState = {
  query: "",
  kind: "all",
  minLatest: 0,
  showDiscontinued: false,
  sort: { key: "latest", desc: true },
};

const KIND_PARAM: Record<Exclude<CatalogKind, "all">, string> = { procedural: "zabiegowe", conservative: "zachowawcze" };
const SORT_PARAM: Record<Exclude<CatalogSortKey, "latest">, string> = { change: "zmiana", mortality: "smiertelnosc", value: "kwota", valueChange: "zmiana-kwoty", code: "kod" };

const fromParam = <T extends string>(map: Record<T, string>, value: string | null) =>
  (Object.entries(map) as [T, string][]).find(([, param]) => param === value)?.[0];

export function readJgpCatalogUrlState(search: string): JgpCatalogUrlState {
  const params = new URLSearchParams(search);
  const min = Number(params.get("min"));
  const key = fromParam(SORT_PARAM, params.get("sort")) ?? "latest";
  const direction = params.get("kier");
  return {
    query: params.get("q")?.trim() ?? "",
    kind: fromParam(KIND_PARAM, params.get("rodzaj")) ?? "all",
    minLatest: MIN_LATEST_OPTIONS.includes(min) ? min : 0,
    showDiscontinued: params.get("wycofane") === "1",
    sort: { key, desc: direction === "rosnaco" ? false : direction === "malejaco" ? true : defaultSortDesc(key) },
  };
}

export function jgpCatalogUrlSearch(state: JgpCatalogUrlState) {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.kind !== "all") params.set("rodzaj", KIND_PARAM[state.kind]);
  if (state.minLatest) params.set("min", String(state.minLatest));
  if (state.showDiscontinued) params.set("wycofane", "1");
  if (state.sort.key !== "latest") params.set("sort", SORT_PARAM[state.sort.key]);
  if (state.sort.desc !== defaultSortDesc(state.sort.key)) params.set("kier", state.sort.desc ? "malejaco" : "rosnaco");
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Czy filtry różnią się od domyślnych (sortowanie nie jest filtrem). */
export const hasActiveFilters = (state: JgpCatalogUrlState) =>
  Boolean(state.query.trim()) || state.kind !== "all" || state.minLatest !== 0 || state.showDiscontinued;
