"use client";

import Link from "next/link";
import { InfoTip } from "@/components/InfoTip";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from "react";
import { AdmissionTab } from "@/components/AdmissionTab";
import { ExplorerSidebar } from "@/components/explorer/ExplorerSidebar";
import { RegionView } from "@/components/explorer/RegionView";
import { ExplorerKpis, type ExplorerKpi } from "@/components/explorer/ExplorerKpis";
import { MortalityTab } from "@/components/MortalityTab";
import { PageHeader } from "@/components/portal/PageHeader";
import { PortalIcon, type PortalIconName } from "@/components/portal/PortalIcon";
import { TrendView } from "@/components/trends/TrendView";
import { areaLabel, areasLabel, dominantRegionForCity, type AnalysisArea } from "@/lib/area";
import { DASHBOARD_HREFS, DASHBOARD_TAB_NAVIGATE_EVENT, type DashboardNavigation } from "@/lib/dashboardNavigation";
import { dashboardUrlSearch, legacyAnalysisRedirect, readDashboardUrlState, resolveDashboardYear, type DashboardActiveTab } from "@/lib/dashboardUrlState";
import type { MortalityDisplayMode } from "@/lib/mortality";
import { jgpHref } from "@/lib/portalLinks";
import {
  admissionsFromDataset, loadHospitalizationIndex, loadRegionalTrends, loadStaticDataset, loadTrends, mortalityFromDataset, productTrend,
  referenceFromDataset, trendsForRegions, type StaticDataset,
} from "@/lib/staticData";
import { incompleteCoverage, yearChangePct } from "@/lib/trends";
import type { AdmissionPayload, AxisMode, EstimationMethod, MortalityPayload, ProductOption, ReferencePayload } from "@/lib/types";
import styles from "./Explorer.module.css";
import { EstimateBadge } from "@/components/portal/EstimateBadge";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const percent = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Lista grup z kolejnych lat bez powtórzeń (nowszy opis zastępuje starszy). */
function mergeProducts(current: ProductOption[], next: ProductOption[]): ProductOption[] {
  const byCode = new Map(current.map((product) => [product.code, product]));
  next.forEach((product) => byCode.set(product.code, product));
  return [...byCode.values()];
}

const EMPTY_KPI = { facilities: 0, hospitalizations: 0, deaths: 0, mortalityPct: 0 };
const EMPTY_GEO_STATS = { regions: [], cities: [] };
const EMPTY_DATA: MortalityPayload = { rows: [], current: EMPTY_KPI, baseline: EMPTY_KPI, hasComparison: false, areaStats: EMPTY_GEO_STATS, baselineAreaStats: EMPTY_GEO_STATS };
const EMPTY_ADMISSION_DATA: AdmissionPayload = { rows: [], areaStats: EMPTY_GEO_STATS };

/** Widoki-pytania eksploratora (kolejność zakładek). */
/** Widoki eksploratora; `help` = objaśnienie wykresu pod „?” na końcu pytania (widoki bez własnego tytułu wykresu). */
export const EXPLORER_VIEWS: { tab: DashboardActiveTab; label: string; question: string; icon: PortalIconName; help?: string }[] = [
  { tab: "trend", label: "W czasie", question: "Jak zmieniała się liczba hospitalizacji?", icon: "chart" },
  { tab: "mortality", label: "Kto leczy", question: "Którzy świadczeniodawcy leczą i z jaką śmiertelnością?", icon: "heart",
    help: "Każdy punkt to świadczeniodawca: oś X — liczba hospitalizacji, oś Y — śmiertelność (zgony w szpitalu / hospitalizacje). Przełącznik zmienia jednostkę osi X. Obszar wybrany w panelu jest wyróżniony kolorem." },
  { tab: "admissions", label: "Tryb przyjęcia", question: "Ile przyjęć jest planowych, a ile nagłych?", icon: "bed",
    help: "Każdy punkt to świadczeniodawca. Oś X pokazuje przyjęcia planowane (kod 6), a oś Y sumę przyjęć nagłych (kody 2 i 3). Przełącznik zmienia jednostkę obu osi. Obszar wybrany w panelu jest wyróżniony kolorem." },
  { tab: "regions", label: "Gdzie", question: "Jak hospitalizacje rozkładają się na województwa i miasta?", icon: "pin" },
];

const INTRO_KEY = "funduszdanych:explorer-intro";
const FOCUS_KEY = "funduszdanych:explorer-focus";

// Przełączniki zapamiętane w przeglądarce (wygoda jednego użytkownika, nie stan analizy).
// Bez dostępu do pamięci przeglądarki (tryb prywatny, blokada) działają do przeładowania strony.
const flagListeners = new Set<() => void>();
const memoryFlags = new Map<string, boolean>();

function subscribeFlags(listener: () => void) {
  flagListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    flagListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readFlag(key: string, initial: boolean) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? initial : stored === "1";
  } catch {
    return memoryFlags.get(key) ?? initial;
  }
}

function useStoredFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribeFlags, () => readFlag(key, initial), () => initial);
  const update = useCallback((next: boolean) => {
    memoryFlags.set(key, next);
    try { window.localStorage.setItem(key, next ? "1" : "0"); } catch { /* pamięć niedostępna: zostaje `memoryFlags` */ }
    flagListeners.forEach((listener) => listener());
  }, [key]);
  return [value, update];
}

/**
 * Eksplorator /analizy: krótki nagłówek z rozwijanym wstępem, panel ustawień po lewej (zakres JGP, obszar,
 * okres, filtry) i widoki-pytania. Tryb analizy chowa nagłówek i daje wykresom całą szerokość okna.
 * Stan analizy jest w adresie URL; wstęp i tryb analizy zapamiętuje przeglądarka.
 */
export function AnalysisExplorer() {
  const [reference, setReference] = useState<ReferencePayload | null>(null);
  const [data, setData] = useState<MortalityPayload>(EMPTY_DATA);
  // Liczby dla wybranego obszaru (karty nad wykresem); wykres pokazuje wszystkich i wyróżnia obszar.
  const [areaData, setAreaData] = useState<MortalityPayload | null>(null);
  const [introOpen, setIntroOpen] = useStoredFlag(INTRO_KEY, false);
  const [focus, setFocus] = useStoredFlag(FOCUS_KEY, false);
  const [admissionData, setAdmissionData] = useState<AdmissionPayload>(EMPTY_ADMISSION_DATA);
  // Przyjęcia nagłe w obszarze (pasek liczb) i zmiana hospitalizacji r/r z trendów (klucz = zakres, dla którego ją policzono).
  const [areaUrgent, setAreaUrgent] = useState(0);
  const [trendChange, setTrendChange] = useState<{ key: string; pct: number | null } | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  // Opisy grup ze wszystkich wczytanych lat: nazwa wybranej grupy zostaje, gdy rok nie ma jej w katalogu.
  const [knownProducts, setKnownProducts] = useState<ProductOption[]>([]);
  // Obszary analizy (do 5, suma); pusta lista = cała Polska.
  const [areas, setAreas] = useState<AnalysisArea[]>([]);
  const [dataset, setDataset] = useState<StaticDataset | null>(null);
  // Filtr długości pobytu działa tylko w widoku, w którym go ustawiono (W czasie, Kto leczy, Tryb przyjęcia).
  const [durationsByTab, setDurationsByTab] = useState<Partial<Record<DashboardActiveTab, string[]>>>({});
  const [method, setMethod] = useState<EstimationMethod>("min");
  const [axisMode, setAxisMode] = useState<AxisMode>("total");
  const [admissionAxisMode, setAdmissionAxisMode] = useState<AxisMode>("total");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardActiveTab>("trend");
  const [jgpDisplayMode, setJgpDisplayMode] = useState<MortalityDisplayMode>("combined");
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [years, setYears] = useState<string[]>([]);
  const [latestYear, setLatestYear] = useState("");
  const [year, setYear] = useState("");
  const durations = useMemo(() => activeTab === "regions" ? [] : durationsByTab[activeTab] ?? [], [activeTab, durationsByTab]);
  const setDurations = useCallback((next: SetStateAction<string[]>) => setDurationsByTab((current) => ({
    ...current,
    [activeTab]: typeof next === "function" ? next(current[activeTab] ?? []) : next,
  })), [activeTab]);

  // Most z nagłówkiem portalu: link „Eksplorator danych” na tej stronie wraca do pierwszego widoku bez utraty filtrów.
  useEffect(() => {
    const handleNavigation = (event: Event) => setActiveTab((event as CustomEvent<DashboardNavigation>).detail.tab);
    window.addEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, handleNavigation);
    return () => window.removeEventListener(DASHBOARD_TAB_NAVIGATE_EVENT, handleNavigation);
  }, []);

  useEffect(() => {
    const redirect = legacyAnalysisRedirect(window.location.search);
    if (redirect) {
      window.location.replace(redirect);
      return;
    }
    const load = async () => {
      try {
        const index = await loadHospitalizationIndex();
        const initialYear = resolveDashboardYear(new URLSearchParams(window.location.search).get("y") ?? undefined, index.years, index.latestYear);
        const payload = referenceFromDataset(await loadStaticDataset(initialYear));
        const urlState = readDashboardUrlState(payload, window.location.search);
        setSelectedProducts(urlState.selectedProducts);
        setAreas(urlState.areas);
        setDurationsByTab(urlState.durations.length && urlState.activeTab !== "regions" ? { [urlState.activeTab]: urlState.durations } : {});
        setMethod(urlState.method);
        setAxisMode(urlState.axisMode);
        setAdmissionAxisMode(urlState.admissionAxisMode);
        setActiveTab(urlState.activeTab);
        setYears(index.years);
        setLatestYear(index.latestYear);
        setYear(initialYear);
        setKnownProducts((current) => mergeProducts(current, payload.products));
        setReference(payload);
        setUrlStateReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd inicjalizacji aplikacji.");
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Zmiana roku: nowy słownik (katalog JGP i placówki zależą od roku). Grupy i obszary zostają także wtedy, gdy nie ma ich
  // w katalogu danego roku (dają wtedy zero), bo oś czasu w „Gdzie” przechodzi przez wszystkie lata i wraca.
  useEffect(() => {
    if (!reference || !urlStateReady || !year || reference.analysisYear === year) return;
    let cancelled = false;
    const switchYear = async () => {
      try {
        const payload = referenceFromDataset(await loadStaticDataset(year));
        if (cancelled) return;
        const durationValues = new Set(payload.durations);
        setKnownProducts((current) => mergeProducts(current, payload.products));
        setDurationsByTab((current) => Object.fromEntries(Object.entries(current).map(([tab, values]) => [tab, values.filter((value) => durationValues.has(value))])));
        setReference(payload);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Błąd pobierania danych.");
        setLoading(false);
      }
    };
    void switchYear();
    return () => { cancelled = true; };
  }, [reference, urlStateReady, year]);

  useEffect(() => {
    if (!reference || !urlStateReady) return;
    // Czekamy, aż słownik nowego roku zastąpi poprzedni.
    if (year && reference.analysisYear !== year) return;

    let cancelled = false;
    const refreshData = async () => {
      try {
        const dataset = await loadStaticDataset(reference.analysisYear);
        if (cancelled) return;
        setDataset(dataset);
        if (selectedProducts.length === 0) {
          setData(EMPTY_DATA);
          setAreaData(null);
          setAdmissionData(EMPTY_ADMISSION_DATA);
          setAreaUrgent(0);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        // Wykresy świadczeniodawców pokazują cały kraj; obszar jest wyróżnieniem, a karty liczb liczą tylko obszar.
        const query = { products: selectedProducts, durations, method, minHosp: 0 };
        setData(mortalityFromDataset(dataset, query));
        setAreaData(areas.length ? mortalityFromDataset(dataset, { ...query, areas }) : null);
        const admissions = admissionsFromDataset(dataset, query);
        setAdmissionData(admissions);
        const areaAdmissions = areas.length ? admissionsFromDataset(dataset, { ...query, areas }) : admissions;
        setAreaUrgent(areaAdmissions.rows.reduce((sum, row) => sum + row.urgentAdmissions, 0));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Błąd pobierania danych.");
        setLoading(false);
      }
    };
    void refreshData();
    return () => { cancelled = true; };
  }, [reference, urlStateReady, year, selectedProducts, durations, method, areas]);

  useEffect(() => {
    if (!reference || !urlStateReady) return;
    const search = dashboardUrlSearch(reference, {
      // Próg hospitalizacji i dodatkowe wyróżnienia usunięte z panelu: wykres jest interaktywny, obszar wyróżnia sam.
      selectedProducts, durations, method, minHosp: 0, axisMode, admissionAxisMode, geoMode: "regions",
      highlightedRegions: [], highlightedCities: [], activeTab, areas, year,
    }, latestYear);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [reference, urlStateReady, selectedProducts, durations, method, axisMode, admissionAxisMode, activeTab, areas, year, latestYear]);

  // Trend miesięczny ma podział na województwa, nie na miasta: dla miasta bierzemy jego województwo
  // (to, w którym świadczeniodawcy z miasta mają najwięcej hospitalizacji). Kilka obszarów = suma województw.
  const trendArea = useMemo((): { regions: string[]; label?: string; note: string | null; exact: boolean } => {
    if (!reference || !areas.length) return { regions: [], note: null, exact: true };
    const regions: string[] = [];
    const mapped: string[] = [];
    const empty: string[] = [];
    for (const area of areas) {
      if (area.kind === "region") { if (!regions.includes(area.owNfz)) regions.push(area.owNfz); continue; }
      if (area.kind !== "city") continue;
      const region = dataset ? dominantRegionForCity(dataset, area.city, selectedProducts, method) : null;
      if (!region) { empty.push(areaLabel(area, reference)); continue; }
      if (!regions.includes(region)) regions.push(region);
      mapped.push(`${areaLabel(area, reference)} → ${areaLabel({ kind: "region", owNfz: region }, reference)}`);
    }
    const notes = [
      mapped.length ? `Trend miesięczny nie ma podziału na miasta; dla miast pokazujemy województwo z największą liczbą ich hospitalizacji: ${mapped.join(", ")}.` : "",
      empty.length ? `Bez hospitalizacji w wybranych grupach: ${empty.join(", ")}.` : "",
    ].filter(Boolean);
    return {
      regions,
      label: regions.length ? areasLabel(regions.map((owNfz) => ({ kind: "region", owNfz })), reference) : "cała Polska",
      note: notes.length ? notes.join(" ") + (regions.length ? "" : " Pokazujemy całą Polskę.") : null,
      exact: !mapped.length && !empty.length,
    };
  }, [reference, areas, dataset, selectedProducts, method]);

  // Zmiana r/r w pasku liczb: z trendów kraju albo województw (bez miast i bez filtra długości pobytu — trendy ich nie mają).
  const changeKey = `${selectedProducts.join(",")}|${method}|${trendArea.regions.join(",")}|${reference?.analysisYear ?? ""}`;
  const canChange = trendArea.exact && durations.length === 0;
  useEffect(() => {
    if (!reference || !selectedProducts.length || !canChange) return;
    let cancelled = false;
    Promise.all([loadTrends(), Promise.all(trendArea.regions.map(loadRegionalTrends))])
      .then(([national, regional]) => {
        if (cancelled) return;
        const trends = regional.length ? trendsForRegions(national, regional) : national;
        const pct = yearChangePct(productTrend(trends, selectedProducts, method), trends.years, reference.analysisYear, incompleteCoverage(trends, selectedProducts));
        setTrendChange({ key: changeKey, pct });
      })
      .catch(() => { /* bez zmiany r/r: dopisek pokazuje rok */ });
    return () => { cancelled = true; };
  }, [reference, selectedProducts, method, trendArea, canChange, changeKey]);
  const yearChange = canChange && trendChange?.key === changeKey ? trendChange.pct : null;

  const kpis = useMemo((): ExplorerKpi[] => {
    const { current, baseline, hasComparison } = areaData ?? data;
    const kpiYear = reference?.analysisYear ?? "";
    const share = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;
    const hospitalNote = hasComparison
      ? `${percent(share(current.hospitalizations, baseline.hospitalizations))} wszystkich (filtr długości pobytu)`
      : yearChange === null ? `w ${kpiYear} r.` : `${yearChange > 0 ? "+" : ""}${percent(yearChange)} r/r`;
    return [
      { label: `Hospitalizacje ${kpiYear}`, value: integer(current.hospitalizations), note: hospitalNote, help: "Hospitalizacje wybranych grup JGP w obszarze i roku. Zmiana r/r z danych miesięcznych NFZ: dla kraju i województwa, bez filtra długości pobytu." },
      { label: "Śmiertelność", value: percent(current.mortalityPct), note: `${integer(current.deaths)} zgonów w szpitalu`, help: "Zgony w szpitalu / hospitalizacje." },
      { label: "Przyjęcia nagłe", value: percent(share(areaUrgent, current.hospitalizations)), note: "udział w hospitalizacjach", help: "Przyjęcia w trybie nagłym (kody 2 i 3) / hospitalizacje." },
      { label: "Świadczeniodawcy", value: integer(current.facilities), note: hasComparison ? `z ${integer(baseline.facilities)} bez filtra` : "rozliczający hospitalizacje", help: "Świadczeniodawca = oddział NFZ + NIP, który rozlicza hospitalizacje wybranych grup w obszarze." },
    ];
  }, [areaData, data, reference, yearChange, areaUrgent]);

  // Tryb analizy chowa też nagłówek portalu (pasek u góry okna wysuwa go po najechaniu): znacznik na <html>.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-explorer-focus", focus);
    return () => document.documentElement.removeAttribute("data-explorer-focus");
  }, [focus]);

  const toggleFocus = () => {
    setFocus(!focus);
    window.scrollTo({ top: 0 });
  };

  if (!reference && loading) return <main className="center-state">Ładowanie analiz…</main>;
  if (!reference) return <main className="center-state error">{error ?? "Brak konfiguracji."}</main>;

  const range = years.length > 1 ? `${years[0]}–${years.at(-1)}` : reference.analysisYear;
  const activeView = EXPLORER_VIEWS.find((view) => view.tab === activeTab) ?? EXPLORER_VIEWS[0];
  // Strona grupy JGP, gdy wybrano jedną grupę, która ma już stronę.
  const singleProduct = selectedProducts.length === 1 ? reference.products.find((product) => product.code === selectedProducts[0]) : undefined;
  const groupPage = jgpHref(singleProduct?.jgpCode);
  const scopeLabel = selectedProducts.length === 0 ? "Nie wybrano grup JGP"
    : singleProduct ? singleProduct.label
    : `${selectedProducts.length} grup${selectedProducts.length < 5 ? "y" : ""} JGP łącznie`;

  return <main className={`${styles.page} ${focus ? styles.focus : ""}`}>
    <Collapsible open={!focus}>
      <PageHeader
        compact
        eyebrow={<>Hospitalizacje · grupy JGP · {range}</>}
        title="Eksplorator danych"
        lead={<p>Własne analizy hospitalizacji NFZ: wybierz grupy JGP, obszar i rok, a eksplorator policzy wyniki łącznie dla całego wyboru.</p>}
        actions={<button
          type="button"
          className={styles.headerButton}
          aria-expanded={introOpen}
          aria-controls="explorer-intro"
          onClick={() => setIntroOpen(!introOpen)}
        >Jak korzystać? <span className={`${styles.chevron} ${introOpen ? styles.chevronOpen : ""}`} aria-hidden /></button>}
      >
        {introOpen ? <div id="explorer-intro">
          <div className={styles.introGrid}>
            <div className={styles.introCard}>
              <h2>Kiedy eksplorator?</h2>
              <p>Gdy chcesz złożyć własny zakres: połączyć do 10 grup JGP (np. wszystkie grupy zawałów), zawęzić dane do województwa lub miasta
              i ustawić filtry świadczeniodawców.</p>
            </div>
            <div className={styles.introCard}>
              <h2>Kiedy karta grupy JGP?</h2>
              <p>Gdy interesuje cię jedna grupa. <Link href="/jgp">Karta grupy</Link> to gotowy opis: co obejmuje grupa, ile płaci NFZ,
              jak zmienia się liczba hospitalizacji i kto leczy. Nie wymaga ustawień.</p>
            </div>
            <div className={styles.introCard}>
              <h2>Jak zacząć?</h2>
              <ol>
                <li>Wybierz grupy JGP w panelu „Zakres analizy”.</li>
                <li>Ustaw obszar i okres. Obszar wyróżnia świadczeniodawców na wykresach.</li>
                <li>Wybierz widok: {EXPLORER_VIEWS.map((view) => view.label).join(", ")}.</li>
                <li>Potrzebujesz więcej miejsca? Włącz tryb analizy (ikona po prawej nad wykresem).</li>
              </ol>
            </div>
          </div>
          <p className={styles.method}><EstimateBadge /> Wartości „&lt;5” w danych NFZ liczymy jako 1 (metoda konserwatywna). <Link href={DASHBOARD_HREFS.methodology}>Metodologia</Link></p>
        </div> : null}
      </PageHeader>
    </Collapsible>

    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <ExplorerSidebar
          view={activeTab}
          reference={reference}
          years={years}
          year={year || reference.analysisYear}
          setYear={setYear}
          selectedProducts={selectedProducts}
          setSelectedProducts={setSelectedProducts}
          knownProducts={knownProducts}
          areas={areas}
          setAreas={setAreas}
          durations={durations}
          setDurations={setDurations}
        />
      </aside>

      <section className={styles.content} aria-label="Wyniki analizy">
        <nav className={styles.views} aria-label="Widoki analizy">
          {EXPLORER_VIEWS.map((view) => <button
            key={view.tab}
            type="button"
            className={`${styles.viewButton} ${activeTab === view.tab ? styles.viewButtonActive : ""}`}
            aria-current={activeTab === view.tab ? "page" : undefined}
            onClick={() => setActiveTab(view.tab)}
            title={focus ? view.label : undefined}
          ><PortalIcon name={view.icon} size={18} /><span className={styles.viewLabel}>{view.label}</span></button>)}
          <div className={styles.viewActions}>
            {groupPage ? <Link className={styles.groupLink} href={groupPage} title={focus ? `Wszystko o grupie ${singleProduct?.jgpCode}` : undefined}>
              <PortalIcon name="book" size={17} /><span className={styles.viewLabel}>Wszystko o grupie {singleProduct?.jgpCode} →</span>
            </Link> : null}
            <button
              type="button"
              className={styles.focusButton}
              aria-pressed={focus}
              aria-label={focus ? "Zakończ tryb analizy" : "Tryb analizy"}
              title={focus ? "Zakończ tryb analizy: pokaż nagłówek strony i wstęp" : "Tryb analizy: schowaj nagłówek strony i daj wykresom całą szerokość okna"}
              onClick={toggleFocus}
            ><PortalIcon name={focus ? "collapse" : "expand"} size={18} /></button>
          </div>
        </nav>

        <div className={styles.viewHeader}>
          <div>
            <h2 className={styles.question}>
              {activeView.question}
              {activeView.help ? <InfoTip label={activeView.help} ariaLabel="Jak czytać wykres" /> : null}
            </h2>
            <Collapsible open={!focus}>
              <p className={styles.scope}>{scopeLabel} · {areasLabel(areas, reference)} · {activeTab === "trend" ? range : reference.analysisYear}</p>
            </Collapsible>
          </div>
        </div>

        {selectedProducts.length ? <Collapsible open={!focus}><ExplorerKpis items={kpis} /></Collapsible> : null}

        {activeTab === "trend" ? <TrendView productCodes={selectedProducts} method={method} regions={trendArea.regions} areaLabel={trendArea.label} areaNote={trendArea.note} durations={durations} displayMode={jgpDisplayMode} onDisplayModeChange={setJgpDisplayMode} />
          : activeTab === "regions" ? <RegionView productCodes={selectedProducts} year={reference.analysisYear} method={method} areas={areas} onAreasChange={setAreas} />
          : activeTab === "mortality" ? <MortalityTab
            reference={reference}
            data={data}
            loading={loading}
            error={error}
            selectedProducts={selectedProducts}
            axisMode={axisMode}
            setAxisMode={setAxisMode}
            highlightAreas={areas}
            displayMode={jgpDisplayMode}
            setDisplayMode={setJgpDisplayMode}
          /> : <AdmissionTab
            reference={reference}
            data={admissionData}
            loading={loading}
            error={error}
            selectedProducts={selectedProducts}
            axisMode={admissionAxisMode}
            setAxisMode={setAdmissionAxisMode}
            highlightAreas={areas}
            displayMode={jgpDisplayMode}
            setDisplayMode={setJgpDisplayMode}
          />}
      </section>
    </div>
  </main>;
}

/**
 * Płynne chowanie bloku w trybie analizy (wysokość i przezroczystość). Schowany blok jest poza
 * drzewem dostępności i fokusem (`inert`), ale zostaje w DOM, więc wraca bez ponownego ładowania.
 */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={`${styles.collapsible} ${open ? "" : styles.collapsed}`} aria-hidden={!open} inert={!open}>
    <div className={styles.collapsibleInner}>{children}</div>
  </div>;
}
