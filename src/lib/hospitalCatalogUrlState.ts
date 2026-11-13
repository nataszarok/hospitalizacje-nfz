export type HospitalSortKey = "latest" | "change" | "mortality" | "beds" | "net" | "name";
/** Filtr sieci szpitali: wszystkie, w sieci (dowolny poziom), poza siecią albo poziom (indeks w `pszLevels`). */
export type PszFilter = "all" | "in" | "out" | number;

/** Widok katalogu: lista albo mapa miast siedzib; `null` = domyślny dla ekranu (mapa na komputerze, lista na telefonie). */
export type HospitalCatalogView = "list" | "map" | null;
/** Szerokość okna, od której domyślnym widokiem katalogu jest lista (telefon). */
export const CATALOG_PHONE_QUERY = "(max-width: 700px)";

/**
 * Stan katalogu `/szpitale` w adresie: `widok=mapa|lista` (wybrany widok; bez parametru — domyślny dla ekranu), `q` (szukaj), `woj` (kod OW NFZ), `miasto` (miasto siedziby wielkimi literami,
 * jak w danych NFZ; wybór kropki na mapie), `siec=tak|nie|<poziom 0–5>`, `min` (próg hospitalizacji),
 * `sort=zmiana|smiertelnosc|lozka|wynik|nazwa` i `kier=rosnaco|malejaco` (tylko gdy inny niż domyślny dla kolumny).
 */
export interface HospitalCatalogUrlState {
  view: HospitalCatalogView;
  query: string;
  region: string;
  city: string;
  psz: PszFilter;
  minLatest: number;
  sort: { key: HospitalSortKey; desc: boolean };
}

export const HOSPITAL_MIN_OPTIONS = [0, 1000, 5000, 20000];
/**
 * Domyślnie bez progu: lista i mapa pokazują wszystkich świadczeniodawców z hospitalizacjami w którymkolwiek roku
 * (bez hospitalizacji w najnowszym roku — na końcu listy, bez kropki). Próg zawęża do większych.
 */
export const DEFAULT_HOSPITAL_MIN = 0;

/** Domyślny kierunek: liczby malejąco, nazwa alfabetycznie. */
export const defaultHospitalSortDesc = (key: HospitalSortKey) => key !== "name";

export const DEFAULT_HOSPITAL_CATALOG_STATE: HospitalCatalogUrlState = {
  view: null,
  query: "",
  region: "",
  city: "",
  psz: "all",
  minLatest: DEFAULT_HOSPITAL_MIN,
  sort: { key: "latest", desc: true },
};

const SORT_PARAM: Record<Exclude<HospitalSortKey, "latest">, string> = { change: "zmiana", mortality: "smiertelnosc", beds: "lozka", net: "wynik", name: "nazwa" };

function readPsz(value: string | null): PszFilter {
  if (value === "tak") return "in";
  if (value === "nie") return "out";
  return value !== null && /^[0-9]$/.test(value) ? Number(value) : "all";
}

export function readHospitalCatalogUrlState(search: string): HospitalCatalogUrlState {
  const params = new URLSearchParams(search);
  const min = params.has("min") ? Number(params.get("min")) : DEFAULT_HOSPITAL_MIN;
  const key = (Object.entries(SORT_PARAM) as [HospitalSortKey, string][]).find(([, param]) => param === params.get("sort"))?.[0] ?? "latest";
  const direction = params.get("kier");
  return {
    view: params.get("widok") === "mapa" ? "map" : params.get("widok") === "lista" ? "list" : null,
    query: params.get("q")?.trim() ?? "",
    region: /^\d{2}$/.test(params.get("woj") ?? "") ? params.get("woj")! : "",
    city: params.get("miasto")?.trim().toLocaleUpperCase("pl-PL") ?? "",
    psz: readPsz(params.get("siec")),
    minLatest: HOSPITAL_MIN_OPTIONS.includes(min) ? min : DEFAULT_HOSPITAL_MIN,
    sort: { key, desc: direction === "rosnaco" ? false : direction === "malejaco" ? true : defaultHospitalSortDesc(key) },
  };
}

export function hospitalCatalogUrlSearch(state: HospitalCatalogUrlState) {
  const params = new URLSearchParams();
  if (state.view) params.set("widok", state.view === "map" ? "mapa" : "lista");
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.region) params.set("woj", state.region);
  if (state.city) params.set("miasto", state.city);
  if (state.psz !== "all") params.set("siec", state.psz === "in" ? "tak" : state.psz === "out" ? "nie" : String(state.psz));
  if (state.minLatest !== DEFAULT_HOSPITAL_MIN) params.set("min", String(state.minLatest));
  if (state.sort.key !== "latest") params.set("sort", SORT_PARAM[state.sort.key]);
  if (state.sort.desc !== defaultHospitalSortDesc(state.sort.key)) params.set("kier", state.sort.desc ? "malejaco" : "rosnaco");
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Czy filtry różnią się od domyślnych (sortowanie nie jest filtrem). */
export const hasActiveHospitalFilters = (state: HospitalCatalogUrlState) =>
  Boolean(state.query.trim()) || Boolean(state.region) || Boolean(state.city) || state.psz !== "all" || state.minLatest !== DEFAULT_HOSPITAL_MIN;

/** Parametry dawnej strony `/szpitale` (profil i porównanie), które teraz obsługuje porównanie szpitali. */
const LEGACY_EXPLORER_PARAMS = ["hospital", "hv", "m", "pd"];

/** Dawny adres profilu (`/szpitale?hospital=…&hv=c`) → ten sam adres na stronie porównania szpitali; `null` dla katalogu. */
export function legacyHospitalExplorerRedirect(search: string, explorerPath: string): string | null {
  const params = new URLSearchParams(search);
  return LEGACY_EXPLORER_PARAMS.some((key) => params.has(key)) ? `${explorerPath}?${params.toString()}` : null;
}
