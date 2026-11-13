import { HOSPITAL_EXPLORER_PATH } from "@/lib/dashboardNavigation";
import { MAX_AREAS, type AnalysisArea } from "@/lib/area";
import type { AxisMode, EstimationMethod, GeographyMode, ReferencePayload } from "@/lib/types";

/** Widoki-pytania eksploratora: W czasie, Kto leczy, Tryb przyjęcia, Gdzie. */
export type DashboardActiveTab = "trend" | "mortality" | "admissions" | "regions";

export type DashboardUrlState = {
  selectedProducts: string[];
  durations: string[];
  method: EstimationMethod;
  minHosp: number;
  axisMode: AxisMode;
  admissionAxisMode: AxisMode;
  /** Lejek na wykresie „Kto leczy” (`lj=1`). */
  funnel?: boolean;
  /** Tryb analizy: schowany nagłówek strony, wykresy na całą szerokość okna (`pelny=1`). */
  focus?: boolean;
  geoMode: GeographyMode;
  highlightedRegions: string[];
  highlightedCities: string[];
  activeTab: DashboardActiveTab;
  /** Obszary analizy (do 5): `ow` (OW NFZ) i `mc` (miasto) w adresie, powtarzalne; brak = cała Polska. */
  areas: AnalysisArea[];
  /** Rok danych z parametru `y`; poprawność sprawdza Dashboard na liście lat. */
  year?: string;
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

const FOCUS_PARAM = "pelny";

/** Tryb analizy z adresu (`pelny=1`). Bez słownika roku: eksplorator czyta go w pierwszym renderze, bez przeskoku. */
export function readFocusParam(search: string): boolean {
  return new URLSearchParams(search).get(FOCUS_PARAM) === "1";
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
  // Bez `t` (i dawne `t=w`): W czasie. `t=k` — Kto leczy, `t=a` — Tryb przyjęcia, `t=g` — Gdzie.
  const activeTab: DashboardActiveTab = tabParam === "a"
    ? "admissions"
    : tabParam === "k"
      ? "mortality"
    : tabParam === "g"
      ? "regions"
      : "trend";

  const areas: AnalysisArea[] = [
    ...validValues(params.getAll("ow"), regionCodes).map((owNfz): AnalysisArea => ({ kind: "region", owNfz })),
    ...validValues(params.getAll("mc"), cityValues).map((city): AnalysisArea => ({ kind: "city", city })),
  ].slice(0, MAX_AREAS);

  return {
    selectedProducts,
    durations: validValues(params.getAll("d"), durationValues),
    method: params.get("m") === "sim" ? "sim" : "min",
    minHosp: nonNegativeInteger(params.get("n")),
    axisMode: params.get("x") === "100k" ? "per_100k" : "total",
    admissionAxisMode: params.get("ax") === "100k" ? "per_100k" : "total",
    funnel: params.get("lj") === "1",
    focus: readFocusParam(search),
    geoMode: params.get("g") === "c" ? "cities" : "regions",
    highlightedRegions: validValues(params.getAll("r"), regionCodes, 10),
    highlightedCities: validValues(params.getAll("c"), cityValues, 10),
    activeTab,
    areas,
    year: params.get("y")?.trim() || undefined,
  };
}

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Rok z adresu, jeśli jest na liście lat; w przeciwnym razie najnowszy rok. */
export function resolveDashboardYear(requested: string | undefined, years: string[], latestYear: string) {
  return requested && years.includes(requested) ? requested : latestYear;
}

// `latestYear`: najnowszy rok nie trafia do adresu, żeby link bez `y` zawsze pokazywał aktualne dane.
export function dashboardUrlSearch(reference: ReferencePayload, state: DashboardUrlState, latestYear?: string) {
  const params = new URLSearchParams();
  if (state.year && state.year !== latestYear) params.set("y", state.year);
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

  state.areas.forEach((area) => {
    if (area.kind === "region") params.append("ow", area.owNfz);
    if (area.kind === "city") params.append("mc", area.city);
  });
  state.durations.forEach((value) => params.append("d", value));
  if (state.method !== "min") params.set("m", state.method);
  if (state.minHosp > 0) params.set("n", String(Math.floor(state.minHosp)));
  if (state.geoMode === "cities") params.set("g", "c");
  state.highlightedRegions.forEach((value) => params.append("r", value));
  state.highlightedCities.forEach((value) => params.append("c", value));
  if (state.axisMode === "per_100k") params.set("x", "100k");
  if (state.admissionAxisMode === "per_100k") params.set("ax", "100k");
  if (state.funnel) params.set("lj", "1");
  if (state.focus) params.set(FOCUS_PARAM, "1");
  if (state.activeTab === "mortality") params.set("t", "k");
  if (state.activeTab === "admissions") params.set("t", "a");
  if (state.activeTab === "regions") params.set("t", "g");

  const search = params.toString();
  return search ? `?${search}` : "";
}

/**
 * Dawne adresy zakładek, które opuściły /analizy: profil szpitala (`t=h`) prowadzi do porównania szpitali,
 * metodologia (`t=m`) pod /o-danych. Zwraca nowy adres albo `null`.
 */
export function legacyAnalysisRedirect(search: string): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get("t");
  if (tab === "m") return "/o-danych";
  if (tab !== "h") return null;
  const target = new URLSearchParams();
  const hospital = params.get("hospital");
  if (hospital) target.set("hospital", hospital);
  const view = params.get("hv");
  if (view === "c" || view === "s") target.set("hv", "c");
  if (params.get("m") === "sim") target.set("m", "sim");
  const peerDistance = params.get("pd");
  if (peerDistance) target.set("pd", peerDistance);
  const query = target.toString();
  return `${HOSPITAL_EXPLORER_PATH}${query ? `?${query}` : ""}`;
}
