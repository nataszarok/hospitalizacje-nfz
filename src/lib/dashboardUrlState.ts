import type { AxisMode, EstimationMethod, GeographyMode, ReferencePayload } from "@/lib/types";

export type DashboardActiveTab = "mortality" | "admissions" | "methodology";

export type DashboardUrlState = {
  selectedProducts: string[];
  durations: string[];
  method: EstimationMethod;
  minHosp: number;
  axisMode: AxisMode;
  admissionAxisMode: AxisMode;
  geoMode: GeographyMode;
  highlightedRegions: string[];
  highlightedCities: string[];
  activeTab: DashboardActiveTab;
};

function defaultProductSelection(reference: ReferencePayload) {
  const code = reference.defaultProductCode || reference.products[0]?.code;
  return code ? [code] : [];
}

function validValues(values: string[], allowed: Set<string>, limit?: number) {
  const unique = Array.from(new Set(values.filter((value) => allowed.has(value))));
  return typeof limit === "number" ? unique.slice(0, limit) : unique;
}

function nonNegativeInteger(value: string | null) {
  if (value === null || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function readDashboardUrlState(reference: ReferencePayload, search: string): DashboardUrlState {
  const params = new URLSearchParams(search);
  const productCodes = new Set(reference.products.map((product) => product.code));
  const durationValues = new Set(reference.durations);
  const regionCodes = new Set(reference.regions.map((region) => region.owNfz));
  const cityValues = new Set(reference.cities);

  const productByJgp = new Map(
    reference.products
      .filter((product) => product.jgpCode)
      .map((product) => [product.jgpCode as string, product.code]),
  );

  const jgpParams = params.getAll("jgp");
  const legacyProductParams = params.getAll("p");
  const hasEmptySelection = jgpParams.includes("-") || legacyProductParams.includes("-");
  const selectedFromJgp = jgpParams
    .filter((value) => value !== "-")
    .map((value) => productByJgp.get(value))
    .filter((value): value is string => Boolean(value));
  const selectedFromLegacyCodes = validValues(
    legacyProductParams.filter((value) => value !== "-"),
    productCodes,
  );
  const selectedProducts = hasEmptySelection
    ? []
    : jgpParams.length > 0 || legacyProductParams.length > 0
      ? Array.from(new Set([...selectedFromJgp, ...selectedFromLegacyCodes])).slice(0, 10)
      : defaultProductSelection(reference);

  const tabParam = params.get("t");
  const activeTab: DashboardActiveTab = tabParam === "a"
    ? "admissions"
    : tabParam === "m"
      ? "methodology"
      : "mortality";

  return {
    selectedProducts,
    durations: validValues(params.getAll("d"), durationValues),
    method: params.get("m") === "sim" ? "sim" : "min",
    minHosp: nonNegativeInteger(params.get("n")),
    axisMode: params.get("x") === "100k" ? "per_100k" : "total",
    admissionAxisMode: params.get("ax") === "100k" ? "per_100k" : "total",
    geoMode: params.get("g") === "c" ? "cities" : "regions",
    highlightedRegions: validValues(params.getAll("r"), regionCodes, 5),
    highlightedCities: validValues(params.getAll("c"), cityValues, 5),
    activeTab,
  };
}

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function dashboardUrlSearch(reference: ReferencePayload, state: DashboardUrlState) {
  const params = new URLSearchParams();
  const defaultProducts = defaultProductSelection(reference);

  if (state.selectedProducts.length === 0) {
    params.append("jgp", "-");
  } else if (!sameArray(state.selectedProducts, defaultProducts)) {
    const productByCode = new Map(reference.products.map((product) => [product.code, product]));
    state.selectedProducts.forEach((value) => {
      const product = productByCode.get(value);
      if (product?.jgpCode) params.append("jgp", product.jgpCode);
      else params.append("p", value);
    });
  }

  state.durations.forEach((value) => params.append("d", value));
  if (state.method !== "min") params.set("m", state.method);
  if (state.minHosp > 0) params.set("n", String(Math.floor(state.minHosp)));
  if (state.geoMode === "cities") params.set("g", "c");
  state.highlightedRegions.forEach((value) => params.append("r", value));
  state.highlightedCities.forEach((value) => params.append("c", value));
  if (state.axisMode === "per_100k") params.set("x", "100k");
  if (state.admissionAxisMode === "per_100k") params.set("ax", "100k");
  if (state.activeTab === "admissions") params.set("t", "a");
  if (state.activeTab === "methodology") params.set("t", "m");

  const search = params.toString();
  return search ? `?${search}` : "";
}
