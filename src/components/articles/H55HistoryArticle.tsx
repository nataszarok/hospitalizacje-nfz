import Link from "next/link";
import type { ReactNode } from "react";
import { EstimateBadge } from "@/components/portal/EstimateBadge";
import { PageHeader } from "@/components/portal/PageHeader";
import type { ChartBand, ChartMarker } from "@/components/jgp/GroupLineChart";
import { ARTICLES_PATH } from "@/lib/articles";
import { formatPln, plnScale, type PlnScale } from "@/lib/formatters";
import { FINDING_TEXT, H55_CONTROLS, findControl, type Finding, type H55Control } from "@/lib/h55Controls";
import { aftermath, CLINIC_THERMOLYSIS, facilityByLabel, facilityChart, HOSPITAL_THERMOLYSIS, SUDDEN_BASE_YEARS, SUDDEN_DROP, SUDDEN_GROWTH, SUDDEN_MIN_YEAR, thermolysisOf, type Aftermath, monthValue, rangeValue, SHORT_SERIES_MAX_SPAN, SHORT_SERIES_MIN_TOTAL, type ControlCoverage, type H55ArticleData, type H55Facility, type ValuationPoints } from "@/lib/h55Article";
import { hospitalHref, jgpHref } from "@/lib/portalLinks";
import { REGION_PICK_COLORS } from "@/lib/chartPalette";
import { GroupLineChart } from "@/components/jgp/GroupLineChart";
import { ArticleFigure, ArticleLineChart } from "./ArticleLineChart";
import { ArticleToc } from "./ArticleToc";
import { ExpandableTable } from "./ExpandableTable";
import { H55FacilityPicker, type PickerFacility } from "./H55FacilityPicker";
import { ArticleTimelineMap } from "./ArticleTimelineMap";
import { ControlCoverageGrid, type CoverageRow } from "./ControlCoverageGrid";
import { H55_SOURCES, h55SourceNumber, type H55SourceId } from "./h55Sources";
import styles from "./Article.module.css";
import h55 from "./H55HistoryArticle.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const percent = (part: number, whole: number, digits = 0) =>
  `${(whole ? (part / whole) * 100 : 0).toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const decimal = (value: number, digits = 1) => value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const MONTHS_GENITIVE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const MONTHS_SHORT = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const MONTHS_LOCATIVE = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];
/** Odmiana rzeczownika po liczbie: 1 placówka, 2 placówki, 5 placówek. */
const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
const facilitiesWord = (n: number) => plural(n, "placówka", "placówki", "placówek");
/** „2024-02-06” → „w lutym 2024 r.” (tekst bez dokładnych dni). */
const inMonth = (iso: string) => `w ${MONTHS_LOCATIVE[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)} r.`;
/** Okres pracy kontrolerów: „od lutego do kwietnia 2024 r.”, „od sierpnia 2025 do marca 2026 r.” */
function spanText(start: string, end: string) {
  const [sy, sm, ey, em] = [start.slice(0, 4), MONTHS_GENITIVE[Number(start.slice(5, 7)) - 1], end.slice(0, 4), MONTHS_GENITIVE[Number(end.slice(5, 7)) - 1]];
  return sy === ey ? `od ${sm} do ${em} ${ey} r.` : `od ${sm} ${sy} do ${em} ${ey} r.`;
}
/** „2023-01”–„2023-08” → „I–VIII 2023”; różne lata → „VIII 2023 – V 2024”. */
function periodText(from: string, to: string) {
  const [fy, fm] = [from.slice(0, 4), MONTHS_SHORT[Number(from.slice(5)) - 1]];
  const [ty, tm] = [to.slice(0, 4), MONTHS_SHORT[Number(to.slice(5)) - 1]];
  if (fy === ty) return fm === "I" && tm === "XII" ? fy : `${fm}–${tm} ${fy}`;
  return fm === "I" && tm === "XII" ? `${fy}–${ty}` : `${fm} ${fy} – ${tm} ${ty}`;
}
const isExternal = (href: string) => href.startsWith("http");
/** Miesiące „RRRR-MM” lat od–do (oś wykresu lat). */
const apiMonths = (from: number, to: number) => Array.from({ length: (to - from + 1) * 12 }, (_, i) => `${from + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`);
/** Sumy lat jako szereg miesięczny (suma roku w styczniu): `GroupLineChart` w widoku lat sumuje miesiące roku. */
const apiMonthValues = (totals: number[]) => totals.flatMap((total) => [total, ...new Array<number>(11).fill(0)]);

const SECTIONS = [
  { id: "kod", label: "Co kryje się pod H55" },
  { id: "koszt", label: "Ile kosztowało H55" },
  { id: "mapa", label: "Gdzie rozliczano H55" },
  { id: "sygnaly", label: "Pierwsze sygnały" },
  { id: "seria", label: "Kontrole 2023–2026" },
  { id: "fale", label: "Wągrowiec, Mogilno, Miastko" },
  { id: "pisz", label: "Pisz" },
  { id: "gryfice", label: "Gryfice" },
  { id: "koszalin", label: "Koszalin" },
  { id: "po-kontroli", label: "Co działo się po kontroli" },
  { id: "z-lotu-ptaka", label: "Ile kontrolerzy zobaczyli" },
  { id: "bez-kontroli", label: "Gwałtowne wzrosty bez kontroli" },
  { id: "wykres-placowki", label: "Wykres dowolnej placówki" },
  { id: "2026", label: "Co się zmieniło w 2026 r." },
  { id: "pytania", label: "Pytania do NFZ" },
  { id: "metoda", label: "Metoda" },
  { id: "przypisy", label: "Przypisy i źródła" },
] as const;

/** Podpis wyniku klasyfikacji szpitala po kontroli (tabela „Co działo się po kontroli”). */
const AFTERMATH_TEXT: Record<Aftermath, string> = {
  before: "H55 skończyło się przed kontrolą",
  stopped: "przestał w czasie kontroli lub zaraz po niej",
  continued: "rozliczał dalej",
  returned: "przerwa, potem powrót",
  unknown: "za wcześnie, by ocenić",
};

/** Miasto wydziału kontroli w miejscowniku („w Białymstoku”). */
const DEPARTMENT_LOCATIVE: Record<string, string> = {
  Białystok: "Białymstoku", Bydgoszcz: "Bydgoszczy", Gdańsk: "Gdańsku", Katowice: "Katowicach", Lublin: "Lublinie", Poznań: "Poznaniu", Warszawa: "Warszawie",
};
const inDepartment = (city: string) => DEPARTMENT_LOCATIVE[city] ?? city;
/** Miejscowość w wyliczeniu; gdy na liście jest kilka placówek z tej samej miejscowości, z początkiem nazwy („Konin – Med-Alko”). */
function distinctName(facility: H55Facility, list: H55Facility[]): string {
  const label = listName(facility.label);
  if (list.filter((other) => other.label === facility.label).length < 2 || !facility.detail) return label;
  const short = facility.detail.split(/\s+/).slice(0, 3).map((word) => word.charAt(0) + word.slice(1).toLocaleLowerCase("pl-PL")).join(" ");
  return `${label} – ${short}`;
}

/** Nazwa szpitala w wyliczeniu w nawiasie: „Katowice – kolejowy” zamiast zagnieżdżonego nawiasu. */
const listName = (label: string) => label.replace(/ \((.+)\)$/, " – $1");

/** Linie startu kontroli na wykresie: „start kontroli” dla jednego szpitala, nazwa szpitala dla kilku. */
const startMarkers = (controls: H55Control[], named: boolean): ChartMarker[] =>
  controls.map((control) => ({ date: control.start, label: named ? `kontrola: ${control.label}` : "start kontroli" }));

/** Odsyłacz do przypisu: numer w indeksie górnym. */
function Ref({ ids }: { ids: H55SourceId[] }) {
  return <sup className={styles.ref}>
    {ids.map((id, i) => {
      const n = h55SourceNumber(id);
      return <span key={id}>{i > 0 ? "," : null}<a href={`#przypis-${n}`} aria-label={`Przypis ${n}`}>{n}</a></span>;
    })}
  </sup>;
}

/**
 * Wykres miesięcy placówek (format kart JGP): kropka = miesiąc, linia = średnia z 3 miesięcy, przełącznik „Miesiące / Lata”.
 * Okres dłuższy niż 4 lata zaczyna się od lat.
 */
function FacilityChart({ data, title, caption, labels, from, to, bands, markers, ariaLabel, period, monthsOnly }: {
  data: H55ArticleData; title: string; caption: ReactNode; labels: string[]; from: string; to: string; bands?: ChartBand[]; markers?: ChartMarker[]; ariaLabel: string;
  /** Widok na start; domyślnie lata dla okresu dłuższego niż 4 lata. */
  period?: "month" | "year";
  /** Tylko miesiące, bez przełącznika „Miesiące / Lata” (krótki okres, w którym sumy lat nic nie mówią). */
  monthsOnly?: boolean;
}) {
  const { months, lines } = facilityChart(data, labels, from, to);
  return <ArticleLineChart title={title} caption={caption} months={months} lines={lines} valueLabel="hosp." ariaLabel={ariaLabel} bands={bands} markers={markers} initialPeriod={monthsOnly ? "month" : period ?? (months.length > 48 ? "year" : "month")} periodToggle={!monthsOnly} />;
}

const CHART_SOURCE = "Miesiące: hospitalizacje H55 w miesiącu (kropki) i średnia z 3 miesięcy (linia); lata: suma roku. Najedź na punkt, żeby zobaczyć liczbę. Źródło: dane NFZ, obliczenia funduszdanych.pl.";

/** Nazwa placówki z linkiem do karty szpitala, gdy karta istnieje. */
function FacilityName({ facility }: { facility: H55Facility }) {
  const [ow, nip] = facility.key.split("|");
  const href = hospitalHref(ow, nip);
  const name = facility.control?.name ?? facility.detail ?? facility.label;
  return href ? <Link href={href}>{name}</Link> : <>{name}</>;
}

/** „12 z 108” — miesiące z H55 w okresie objętym kontrolą z wszystkich miesięcy z H55. */
const coverageText = (coverage: ControlCoverage) => `${coverage.studied} z ${coverage.months}`;

/** Wiersze siatki: placówka (z kontrolami — suma okresów wszystkich kontroli) albo placówka bez kontroli. */
function coverageRows(items: H55Facility[]): CoverageRow[] {
  return items.map((item) => {
    const controls = item.controls ?? (item.control ? [item.control] : []);
    return {
      key: item.key,
      label: item.label,
      detail: controls.length ? `${controls.length > 1 ? "kontrole" : "kontrola"}: ${controls.map((control) => `${control.department} ${control.start.slice(0, 4)}`).join(", ")}` : item.detail,
      values: item.values,
      periods: controls.map((control) => ({ from: control.studyFrom, to: control.studyTo })),
      summary: coverageText(item.coverage!),
    };
  });
}

const SETTLED_ESTIMATE = "Rozliczenia NFZ są roczne. Kwota roku objętego kontrolą tylko w części jest liczona według udziału hospitalizacji z miesięcy okresu.";

/** Kwota rozliczona za okres objęty kontrolą: „—” bez danych o kwotach, plakietka „szacunek” dla części roku. */
function SettledCell({ item, scale }: { item: H55Facility; scale: PlnScale }) {
  const settled = item.settled;
  if (!settled || settled.pln <= 0) return <>—</>;
  return <>{scale.format(settled.pln)}{settled.estimated ? <> <EstimateBadge title={SETTLED_ESTIMATE} /></> : null}
    {settled.missingYears.length ? <span className={h55.cellNote}>bez lat {settled.missingYears.join(", ")}</span> : null}</>;
}

/**
 * Skutki finansowe jako procent kwoty rozliczonej za okres objęty kontrolą — tylko gdy kwota obejmuje cały okres
 * i skutki dotyczą samego H55 (bez kontroli wielotematycznych).
 */
function effectShare(item: H55Facility): number | null {
  const settled = item.settled;
  if (!settled || settled.pln <= 0 || settled.missingYears.length || item.control?.mixed) return null;
  return item.control!.effectPln / settled.pln * 100;
}

/**
 * Tabela kontroli (DESIGN.md 7.1, 5 kolumn): placówka z wydziałem, datami i okresem pod nazwą; kwota rozliczona za okres
 * objęty kontrolą; skutki finansowe; ich udział w tej kwocie; miesiące z H55 objęte kontrolą.
 */
function ControlsTable({ items, caption, initial = 2 }: { items: H55Facility[]; caption: string; initial?: number }) {
  // Wspólna jednostka kwot w tabeli (DESIGN.md 3.1): w nagłówku, w komórkach same liczby.
  const scale = plnScale(items.flatMap((item) => [item.control!.effectPln, item.settled?.pln ?? 0]));
  // Na starcie `initial` wierszy (domyślnie dwa), reszta pod przyciskiem „Pokaż wszystkie” (`ExpandableTable`).
  return <ExpandableTable
    initial={initial}
    className={`priority-table ${h55.tableBox}`}
    tableClassName={styles.table}
    caption={caption}
    head={<tr>
      <th scope="col">Placówka, okres objęty kontrolą</th>
      <th scope="col" className={`${styles.num} col-p2`}>Rozliczono ({scale.unit})</th>
      <th scope="col" className={styles.num}>Skutki ({scale.unit})</th>
      <th scope="col" className={styles.num}>Udział</th>
      <th scope="col" className={`${styles.num} col-p2`}>Miesiące</th>
    </tr>}
    rows={items.map((item) => {
      const control = item.control!;
      const share = effectShare(item);
      return <tr key={control.id}>
        <th scope="row">
          <FacilityName facility={item} />
          <span className={h55.cellNote}>okres: {periodText(control.studyFrom, control.studyTo)} · {control.department}, kontrola {periodText(control.start.slice(0, 7), control.end.slice(0, 7))} · {control.outcome}{control.note ? ` · ${control.note}` : control.mixed ? " · kontrola wielotematyczna" : ""}</span>
          <span className={h55.cellNote}>ustalenia: {control.findings.filter((finding) => finding !== "inne").map((finding) => FINDING_TEXT[finding]).join("; ")}</span>
        </th>
        <td className={`${styles.num} col-p2`}><SettledCell item={item} scale={scale} /></td>
        <td className={styles.num}>{scale.format(control.effectPln)}</td>
        <td className={styles.num}>{share === null ? "—" : `${Math.round(share)}%`}</td>
        <td className={`${styles.num} col-p2`}>{coverageText(item.coverage!)}</td>
      </tr>;
    })}
  />;
}

/** Termolezja w AOS: produkt Z13 „Świadczenia zabiegowe – grupa 13” (zarządzenie 132/2024/DSOZ, załącznik 5a; raport AOTMiT WS.4212.1.2025). */
const AOS_Z13 = { points: 1039, pln: 1787.08 };


/** Województwa (OW NFZ) w opisie mapy: zachodniopomorskie w pierwszych latach; cztery województwa północno-zachodnie od 2021 r. */
const WEST_POMERANIA = ["16"] as const;
const NORTH_WEST = ["16", "11", "15", "02"] as const;
const REGION_EARLY = ["2017", "2018", "2019"];
const REGION_LATE = ["2021"];

/** Wiersze porównania wycen: rodzaj pobytu, punkty H55 i HK14, zmiana. */
const VALUATION_ROWS: { key: keyof ValuationPoints; label: string }[] = [
  { key: "hospitalizacja", label: "Hospitalizacja" },
  { key: "planowa", label: "Hospitalizacja planowa" },
  { key: "zero_dni", label: "Leczenie jednego dnia (wypis w dniu przyjęcia)" },
  { key: "jeden_dzien_pobytu", label: "Pobyt 1-dniowy" },
  { key: "dwa_dni_pobytu", label: "Pobyt 2-dniowy" },
  { key: "jeden_dzien", label: "Zakres „zespół chirurgii jednego dnia”" },
];

/**
 * Artykuł „H55. Historia jednego kodu”: dziewięć lat rozliczeń grupy H55 na tle kontroli NFZ.
 * Układ: czym jest H55 → ile kosztowało → pierwsze sygnały (kontrole 2019–2022 i ich ustalenia) → seria kontroli 2023–2026 →
 * przypadki opisane przez media (Wągrowiec–Mogilno–Miastko, Pisz) i Koszalin → co działo się po kontroli → obraz całości → 2026 → pytania.
 * Liczby krajowe z API statystyk JGP (2025 — szacunek z punktów); szpitale i miesiące z otwartych danych; kontrole z `H55_CONTROLS`.
 * Każdy wykres szpitala ma pasmo okresu objętego kontrolą i linię startu kontroli.
 */
export function H55HistoryArticle({ data }: { data: H55ArticleData }) {
  const F = (label: string) => facilityByLabel(data, label);
  // Liczby krajowe z API statystyk JGP NFZ (pełne liczby, bez szacowania „<5”); placówki i miesiące — z otwartych danych.
  const apiYears = data.procedure.years;
  const api = (y: number) => apiYears.find((row) => row.year === y)!.hospitalizations;
  const apiFirst = apiYears[0].year;
  const apiLast = apiYears.at(-1)!.year;
  const openYear = (y: string) => data.nationalByYear[data.years.indexOf(y)];
  const estimate = data.estimate;
  const cost = data.cost;
  // Długość pobytów i zakresy „jednego dnia” z API (sumy lat z danymi).
  const stays = data.stays;
  const staySum = (key: "hospitalizations" | "oneDayScope" | "day0" | "day1") => stays.reduce((total, row) => total + row[key], 0);
  const stayFirst = stays[0];
  const stayLast = stays.at(-1);
  const yearOf = (label: string, y: string) => rangeValue(data, F(label), `${y}-01`, `${y}-12`);
  const range = (label: string, from: string, to: string) => rangeValue(data, F(label), from, to);
  const month = (label: string, m: string) => monthValue(data, F(label), m);
  // Kontrole (wiersze tabel) i placówki (siatka, sumy; Koszalin = jedna placówka, dwie kontrole).
  const series = data.controls.filter((item) => item.control!.wave === "series");
  const early = data.controls.filter((item) => item.control!.wave === "early");
  const seriesFacilities = data.facilities.series;
  const { totals } = data;
  const allStudied = totals.series.studied + totals.early.studied;
  // Suma skutków serii bez kontroli, której skutki obejmują też inne zagadnienia (druga kontrola Koszalina).
  const seriesH55 = series.filter((item) => !item.control!.mixed);
  const seriesEffect = seriesH55.reduce((total, item) => total + item.control!.effectPln, 0);
  const proc = data.procedure.years;
  const procMin = Math.min(...proc.map((row) => row.percent));
  const procMax = Math.max(...proc.map((row) => row.percent));
  const procLast = proc.at(-1)!;
  const firstYear = data.years[0];
  const lastYear = data.years.at(-1)!;
  const c = (label: string): H55Control => findControl(label);
  const bialystok = series.filter((item) => item.control!.department === "Białystok");
  const sumSeries = totals.series;
  const sumAll = { months: totals.series.months + totals.early.months, studied: allStudied, h: totals.series.hospitalizations + totals.early.hospitalizations, hStudied: totals.series.hospitalizationsStudied + totals.early.hospitalizationsStudied };
  const remedium = c("Poznań (Remedium)");
  const rawicz = c("Rawicz");
  const wagrowiec = c("Wągrowiec");
  const mogilno = c("Mogilno");
  const miastko = c("Miastko");
  const pisz = c("Pisz");
  const gryfice = c("Gryfice");
  // Gryfice: przeciętnie miesięcznie przed startem kontroli (rok kontroli do miesiąca startu) i w roku po jej starcie.
  const gryficeStartYear = gryfice.start.slice(0, 4);
  const gryficeBefore = range("Gryfice", `${gryficeStartYear}-01`, gryfice.start.slice(0, 7)) / Number(gryfice.start.slice(5, 7));
  // W trakcie kontroli: od miesiąca startu do miesiąca zakończenia (włącznie).
  const gryficeStartIndex = Number(gryfice.start.slice(0, 4)) * 12 + Number(gryfice.start.slice(5, 7)) - 1;
  const gryficeDuringMonths = Number(gryfice.end.slice(0, 4)) * 12 + Number(gryfice.end.slice(5, 7)) - gryficeStartIndex;
  const gryficeDuring = range("Gryfice", gryfice.start.slice(0, 7), gryfice.end.slice(0, 7)) / gryficeDuringMonths;
  // Po kontroli: od miesiąca po jej zakończeniu do końca danych.
  const gryficeEndIndex = Number(gryfice.end.slice(0, 4)) * 12 + Number(gryfice.end.slice(5, 7));
  const gryficeAfterFrom = `${Math.floor(gryficeEndIndex / 12)}-${String(gryficeEndIndex % 12 + 1).padStart(2, "0")}`;
  const gryficeAfterMonths = (Number(lastYear) * 12 + 12) - gryficeEndIndex;
  const gryficeAfterTotal = gryficeAfterMonths > 0 ? range("Gryfice", gryficeAfterFrom, `${lastYear}-12`) : 0;
  const hospitalizationsWord = (n: number) => n === 1 ? "hospitalizacja" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "hospitalizacje" : "hospitalizacji";
  // Ustalenia kontroli: osobno do końca 2022 r. (pierwsze sygnały) i w serii 2023–2026 (narracja w kolejności czasu).
  const earlyCount = (finding: Finding) => early.filter((item) => item.control!.findings.includes(finding)).length;
  const seriesCount = (finding: Finding) => series.filter((item) => item.control!.findings.includes(finding)).length;
  const seriesQualificationOnly = series.filter((item) => item.control!.findings.includes("kwalifikacja") && !item.control!.findings.includes("ambulatoryjnie"));
  const qualificationDepartments = [...new Set(seriesQualificationOnly.map((item) => item.control!.department))];
  // Kwoty: rozliczone za okresy objęte kontrolą i udział skutków finansowych w tych kwotach.
  // Opóźnienie kontroli: miesiące od końca sprawdzanego okresu do startu kontroli (kontrole 2023–2026, mediana).
  const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const lags = series.map((item) => monthIndex(item.control!.start.slice(0, 7)) - monthIndex(item.control!.studyTo)).sort((a, b) => a - b);
  const lagMedian = lags.length ? lags[Math.floor(lags.length / 2)] : 0;
  // Placówki bez kontroli, które zaczęły rozliczać H55 w dwóch ostatnich latach danych.
  const recentFrom = `${Number(lastYear) - 1}-01`;
  const recentShort = data.shortSeries.filter((item) => (data.months[item.values.findIndex((value) => value > 0)] ?? "") >= recentFrom);
  // Wartość świadczeń H55 wykazanych przez szpitale skontrolowane w latach 2023–2026 we wszystkich latach z kwotami.
  const seriesTotalPln = seriesFacilities.reduce((total, item) => total + Object.values(data.providerPln[item.key] ?? {}).reduce((sum, pln) => sum + pln, 0), 0);
  const settledSeries = seriesH55.reduce((total, item) => total + (item.settled?.pln ?? 0), 0);
  const shares = series.flatMap((item) => { const share = effectShare(item); return share === null ? [] : [{ item, share }]; }).sort((a, b) => a.share - b.share);
  const plnYears = Object.keys(data.nationalPln).sort();
  const firstPlnYear = plnYears[0];
  const lastPlnYear = plnYears.at(-1);
  const shareOf = (label: string) => Math.round(effectShare(F(label)) ?? 0);
  const settledOf = (label: string) => F(label).settled?.pln ?? 0;
  const h55v = data.valuation.h55;
  const hk14 = data.valuation.hk14;
  const pointValue = (group: string, y: number) => data.valuation.pointValue.find((row) => row.group === group && row.year === y);
  const h55Point = h55v ? pointValue("H55", Number(h55v.year)) : undefined;
  const hk14Point = pointValue(hk14.group, hk14.year);
  const change = (from: number, to: number) => `−${decimal((1 - to / from) * 100)}%`;
  const zl = (value: number) => `${integer(Math.round(value / 10) * 10)} zł`;
  const hundreds = (value: number) => integer(Math.round(value / 100) * 100);
  // Koszalin: dwie kontrole tego samego szpitala.
  const k1 = c("Koszalin");
  const k2 = c("Koszalin (2. kontrola)");
  const koszalinPln = F("Koszalin").plnByYear ?? {};
  const koszalinFacility = data.facilities.series.find((item) => item.key === k1.provider)!;
  const afterK1 = range("Koszalin", "2024-05", "2024-12");
  const duringK2 = range("Koszalin", k2.start.slice(0, 7), "2025-12");
  // Co działo się po kontroli (pierwsza kontrola serii w każdym szpitalu).
  const aftermathRows = seriesFacilities.map((facility) => aftermath(facility, data.months));
  const aftermathOf = (outcome: Aftermath) => aftermathRows.filter((row) => row.outcome === outcome);
  const names = (rows: { facility: H55Facility }[]) => rows.map((row) => listName(row.facility.label)).join(", ");
  // Wykres krajowy: lata z API i (osobna linia) szacunek roku bez API.
  const chartLastYear = estimate?.year ?? apiLast;
  // Termolezja w szpitalu (03.96) i w poradni (04.25): pacjenci z zestawienia NFZ wg ICD-10 i ICD-9.
  const thermo = data.thermolysis;
  const tYears = thermo?.years ?? [];
  const tLast = tYears.at(-1)!;
  const clinic = (key: string) => data.clinics[key];
  const hasNeuro = (key: string, year: number) => Boolean(clinic(key)?.neurosurgery[year]);
  const hasNone = (key: string, year: number) => Boolean(clinic(key)) && !clinic(key).neurosurgery[year] && !clinic(key).painClinic[year] && !clinic(key).neurosurgeryWard[year];
  const hospitalPrice = h55v?.points.zero_dni && h55Point ? h55v.points.zero_dni * h55Point.perPoint : null;
  // Placówki bez kontroli z gwałtowną zmianą H55 i przeniesienie termolezji do poradni.
  const lastClinicYear = data.clinicYears.at(-1) ?? Number(lastYear);
  const growth = data.sudden.filter((item) => item.kind === "growth");
  const drops = data.sudden.filter((item) => item.kind === "drop");
  const noNeuro = growth.filter((item) => !hasNeuro(item.facility.key, lastClinicYear));
  const noNeuroAtAll = noNeuro.filter((item) => hasNone(item.facility.key, lastClinicYear));
  const day0Of = (keys: string[], year: number) => {
    const rows = keys.flatMap((key) => (data.oneDay[key] ?? []).filter((row) => row.year === year));
    return { total: rows.reduce((t, row) => t + row.total, 0), day0: rows.reduce((t, row) => t + row.day0, 0), scope: rows.reduce((t, row) => t + row.oneDayScope, 0) };
  };
  // Placówki z gwałtowną zmianą, które miały poradnię neurochirurgiczną lub leczenia bólu, a termolezji w poradni (04.25) prawie nie robiły.
  const FEW_CLINIC = 10;
  const clinicButFew = data.sudden.filter((item) => {
    const info = clinic(item.facility.key);
    return info && (info.neurosurgery[lastClinicYear] || info.painClinic[lastClinicYear]) && thermolysisOf(data, item.facility.key, tLast, CLINIC_THERMOLYSIS) < FEW_CLINIC;
  });
  const growthDay0 = day0Of(growth.map((item) => item.facility.key), Number(lastYear));
  // Wspólny start wzrostu: pierwszy miesiąc z co najmniej 10 H55 w połowie 2022 r. (placówki, które wcześniej prawie nie miały H55).
  const firstBusy = (item: { facility: H55Facility }) => data.months[item.facility.values.findIndex((value) => value >= 10)] ?? "";
  const mid2022 = growth.filter((item) => item.base < 60 && firstBusy(item) >= "2022-05" && firstBusy(item) <= "2022-08");
  const newSince2023 = growth.filter((item) => SUDDEN_BASE_YEARS.every((year) => (item.byYear[year] ?? 0) === 0) && (item.byYear["2022"] ?? 0) === 0);
  // Wybór na wykresie: placówki omawiane w tekście (kontrole, krótkie okresy H55, gwałtowne zmiany, przejście do poradni, Dietl).
  const discussed = new Set([
    ...data.controls.map((item) => item.key), ...data.shortSeries.map((item) => item.key), ...data.sudden.map((item) => item.facility.key),
  ]);
  const pickerFacilities: PickerFacility[] = data.allFacilities.filter((item) => discussed.has(item.key)).map((item) => {
    const info = clinic(item.key);
    const day0 = day0Of([item.key], Number(lastYear));
    const controls = item.controls ?? [];
    return {
      key: item.key,
      label: item.label,
      name: item.control?.name ?? item.detail ?? item.label,
      values: item.values,
      bands: controls.map((control) => ({ from: control.studyFrom, to: control.studyTo })),
      markers: controls.map((control, i) => ({ date: control.start, label: controls.length > 1 ? `start ${i + 1}. kontroli` : "start kontroli" })),
      facts: [
        { label: "Kontrole H55", value: controls.length ? `${controls.length}` : "brak" },
        ...(info ? [
          { label: `Poradnia neurochirurgiczna (${lastClinicYear})`, value: info.neurosurgery[lastClinicYear] ? `tak${info.since ? `, od ${info.since.slice(0, 4)} r.` : ""}` : "nie" },
          { label: `Poradnia leczenia bólu (${lastClinicYear})`, value: info.painClinic[lastClinicYear] ? "tak" : "nie" },
        ] : []),
        ...(thermo ? [
          { label: `Pacjenci ${HOSPITAL_THERMOLYSIS}, szpital (${tYears.join(" / ")})`, value: tYears.map((year) => integer(thermolysisOf(data, item.key, year, HOSPITAL_THERMOLYSIS))).join(" / ") },
          { label: `Pacjenci ${CLINIC_THERMOLYSIS}, poradnia (${tYears.join(" / ")})`, value: tYears.map((year) => integer(thermolysisOf(data, item.key, year, CLINIC_THERMOLYSIS))).join(" / ") },
        ] : []),
        ...(day0.total ? [{ label: `Leczenie jednego dnia (${lastYear})`, value: percent(day0.day0, day0.total) }] : []),
      ],
    };
  });
  // Udział placówek z wybranych województw (OW NFZ świadczeniodawcy) w hospitalizacjach H55 w roku (%).
  const regionShare = (ows: readonly string[], year: string) => {
    const i = data.years.indexOf(year);
    const yearSum = (item: H55Facility) => item.values.slice(i * 12, i * 12 + 12).reduce((total, value) => total + value, 0);
    const all = data.allFacilities.reduce((total, item) => total + yearSum(item), 0);
    const part = data.allFacilities.filter((item) => ows.includes(item.key.split("|")[0])).reduce((total, item) => total + yearSum(item), 0);
    return all ? (part / all) * 100 : 0;
  };
  const regionLate = data.years.filter((year) => year >= REGION_LATE[0]);
  const pickerInitial = growth[0]?.facility.key ?? pickerFacilities[0].key;

  return <main>
    <PageHeader
      eyebrow={<><Link href={ARTICLES_PATH}>Artykuły</Link> · Analiza</>}
      title="H55. Historia jednego kodu"
      lead={<>
          <p>
            W {apiFirst} r. szpitale wykazały NFZ {integer(api(apiFirst))} hospitalizacji w grupie H55. W {apiLast} r. — już {integer(api(apiLast))}.<Ref ids={["api"]} />{" "}
            Za niemal każdą stoi ten sam zabieg: termolezja. Pacjent zwykle wraca do domu tego samego dnia.
            {" "}W poradni NFZ zapłaciłby za taki zabieg kilka razy mniej niż w szpitalu.
          </p>
          <p>
            Fundusz od 2021 r. miał na piśmie, że szpitale kładą na oddział pacjentów, których mogły leczyć w poradni. Kontrole przyszły późno i były wąskie.
            {" "}W {seriesFacilities.length} szpitalach skontrolowanych w latach 2023–2026 kontrolerzy obejrzeli <strong>{sumSeries.studied} z {sumSeries.months} miesięcy</strong>, w których te szpitale rozliczały H55.
            {seriesTotalPln ? <>{" "}Od {firstPlnYear} r. wykazały one świadczenia H55 o wartości <strong>{formatPln(seriesTotalPln)}</strong>. Kontrole objęły okresy warte {formatPln(settledSeries)},
              {" "}a skutki finansowe, w tym kary, wyniosły <strong>{formatPln(seriesEffect)}</strong> — {percent(seriesEffect, seriesTotalPln)} tej kwoty.<Ref ids={["rozliczenia"]} /></> : null}
            {" "}Kolejne {data.shortSeries.length} {facilitiesWord(data.shortSeries.length)}, które przez kilka miesięcy wykazywały setki takich zabiegów, nie miało żadnej kontroli.<Ref ids={["kontrole"]} />
          </p>
          <p>
            Tekst opiera się na dziewięciu latach rozliczeń NFZ i na wszystkich {H55_CONTROLS.length} kontrolach funduszu, w których pojawia się kod H55.
          </p>
      </>}
    />

    <div className={styles.layout}>
      <ArticleToc items={SECTIONS} />

      <article className={styles.article}>
        {/* Początek bez nagłówka: tekst zaczyna się od faktów, nagłówki mają dopiero kolejne części. */}
        <details id="w-skrocie" className={h55.details}>
          <summary>W skrócie: najważniejsze liczby</summary>
          <ul className={h55.summary}>
            <li><strong>{percent(sumSeries.studied, sumSeries.months)}</strong> — tyle miesięcy rozliczeń H55 sprawdzili kontrolerzy w {seriesFacilities.length} skontrolowanych szpitalach.</li>
            {seriesTotalPln ? <li><strong>{percent(seriesEffect, seriesTotalPln)}</strong> — tyle wyniosły skutki finansowe kontroli wobec wartości wszystkich świadczeń H55 tych szpitali od {firstPlnYear} r.</li> : null}
            <li><strong>{formatPln(miastko.effectPln)}</strong> — skutki kontroli w Miastku, najwyższe ze wszystkich. Kontrolerzy przyszli, gdy szpital nie rozliczał już H55.</li>
            {hospitalPrice ? <li><strong>{decimal(hospitalPrice / AOS_Z13.pln)}x</strong> — tyle niżej NFZ wycenia ten sam zabieg w poradni niż w szpitalu.</li> : null}
            <li><strong>{integer(yearOf("Koszalin", lastYear))}</strong> — tyle hospitalizacji H55 wykazał Koszalin w {lastYear} r., rok po pierwszej kontroli. Rekord.</li>
            <li><strong>{integer(gryficeBefore)} → {integer(gryficeAfterTotal)}</strong> — H55 w Gryficach: średnio miesięcznie przed wejściem kontrolerów i łącznie przez {gryficeAfterMonths} miesięcy po zakończeniu kontroli. Kontrola sprawdziła tylko {periodText(gryfice.studyFrom, gryfice.studyTo)} r.</li>
            {recentShort.length ? <li><strong>{recentShort.length}</strong> — tyle placówek bez kontroli zaczęło intensywnie rozliczać H55 dopiero w latach {Number(lastYear) - 1}–{lastYear}.</li> : null}
          </ul>
        </details>

        <section id="kod" aria-labelledby="kod-h">
          <h2 id="kod-h">Co kryje się pod H55</h2>
          <p>
            H55 to jedna z <Link href="/artykuly/czym-sa-jgp">Jednorodnych Grup Pacjentów</Link>. W tych grupach szpitale rozliczają pobyty z NFZ.
            Pełna nazwa: <Link href={jgpHref("H55") ?? "/jgp"}>„Zabiegi artroskopowe i przezskórne w zakresie kręgosłupa”</Link>.
            Na papierze to kilka różnych zabiegów. W praktyce jeden: procedura{" "}
            <code className={styles.code}>{data.procedure.code}</code> „Przezskórne odnerwienie powierzchni stawowej wyrostka kręgu”, czyli <strong>termolezja</strong>.
            Lekarz wkłuwa igłę przy kręgosłupie i pod kontrolą obrazu wyłącza prądem drobne nerwy stawów. Ból ma ustąpić na wiele miesięcy.
          </p>
          <p>
            W latach {proc[0].year}–{procLast.year} termolezja stanowiła co roku <strong>{decimal(procMin)}–{decimal(procMax)}% hospitalizacji H55</strong>.<Ref ids={["api"]} />
            {" "}Historia H55 to więc historia jednego zabiegu.
          </p>
          {stayFirst && stayLast ? <p>
            Zabieg trwa krótko. W latach {stayFirst.year}–{stayLast.year} leczenie jednego dnia stanowiło <strong>{percent(staySum("day0"), staySum("hospitalizations"))} hospitalizacji</strong>:
            pacjent wychodzi ze szpitala w dniu przyjęcia. Kolejne {percent(staySum("day1"), staySum("hospitalizations"))} kończyło się następnego dnia. Leczenia jednego dnia przybywało:
            {" "}z {percent(stayFirst.day0, stayFirst.hospitalizations)} w {stayFirst.year} r. do {percent(stayLast.day0, stayLast.hospitalizations)} w {stayLast.year} r.
            {h55v?.points.zero_dni && h55v.points.jeden_dzien ? <>
            </> : null}
          </p> : null}
          <h3 id="poradnia">Ten sam zabieg w poradni</h3>
          <p>
            Termolezję można zrobić bez przyjęcia do szpitala, w poradni specjalistycznej (AOS). Tam NFZ rozlicza ją jako procedurę{" "}
            <code className={styles.code}>{CLINIC_THERMOLYSIS}</code> w produkcie Z13 „Świadczenia zabiegowe”: <strong>{integer(AOS_Z13.points)} pkt, ok. {zl(AOS_Z13.pln)}</strong>.<Ref ids={["aotmit"]} />
            {" "}Od lipca 2021 r. NFZ płaci poradniom za wszystkie wykonane świadczenia, bez limitu.<Ref ids={["aos-limity"]} />
            {hospitalPrice && h55v?.points.zero_dni ? <>
              {" "}Za pacjenta wypisanego ze szpitala w dniu przyjęcia NFZ płaci w H55 {integer(h55v.points.zero_dni)} pkt, czyli ok. {zl(hospitalPrice)} przy przeciętnej wartości punktu w {h55v.year} r.<Ref ids={["wyceny", "rozliczenia"]} />
              {" "}<strong>W poradni zabieg jest wyceniony ok. {decimal(hospitalPrice / AOS_Z13.pln)}x niżej.</strong>
            </> : null}
          </p>
        </section>

        <section id="koszt" aria-labelledby="koszt-h">
          <h2 id="koszt-h">Ile kosztowało H55</h2>
          <p>
            Przez pierwsze lata H55 rosło powoli: {integer(api(2017))} hospitalizacji w {apiFirst} r., {integer(api(2021))} w 2021 r. Potem nastąpił skok:
            {" "}<strong>{integer(api(2022))} w 2022 r., {integer(api(2023))} w 2023 r. i {integer(api(2024))} w 2024 r.</strong><Ref ids={["api"]} />
            {estimate ? <>
              {" "}Choć jest listopad 2026 r., API statystyk JGP NFZ nadal nie udostępnia zbiorczych danych o grupach JGP za {estimate.year} r. Dlatego liczba za ten rok to szacunek: <strong>ok. {hundreds(estimate.hospitalizations)} hospitalizacji
              </strong>, czyli tyle samo co rok wcześniej.
            </> : null}
          </p>
          {cost ? <p>
            W latach {cost.from}–{cost.to} NFZ zapłacił za H55 <strong>ok. {formatPln(cost.total)}</strong>. Kwoty rosły szybciej niż liczba pobytów:
            {" "}{formatPln(data.nationalPln[firstPlnYear])} w {firstPlnYear} r. i <strong>{formatPln(data.nationalPln[lastPlnYear!])}</strong> w {lastPlnYear} r.<Ref ids={["rozliczenia"]} />
          </p> : null}
          <ArticleFigure title="Ile hospitalizacji H55 rozliczono w Polsce?" caption={<>
            Hospitalizacje H55 w roku, Polska. {apiFirst}–{apiLast}: API statystyk JGP NFZ.{estimate ? ` ${estimate.year}: szacunek funduszdanych.pl z punktów rozliczonych przez NFZ (linia kropkowana), nie dane NFZ.` : ""}
          </>}>
            <GroupLineChart
              months={apiMonths(apiFirst, chartLastYear)}
              lines={[
                { key: "PL", name: `API NFZ ${apiFirst}–${apiLast}`, values: apiMonthValues([...apiYears.map((row) => row.hospitalizations), ...(estimate ? [0] : [])]), tone: "primary", activeOnly: true },
                ...(estimate ? [{ key: "PL-szacunek", name: `szacunek ${estimate.year}`, values: apiMonthValues([...apiYears.map((row) => row.year === apiLast ? row.hospitalizations : 0), estimate.hospitalizations]), tone: "reference" as const, activeOnly: true }] : []),
              ]}
              legend={Boolean(estimate)}
              valueLabel="hosp." ariaLabel={`Hospitalizacje H55 w Polsce w latach ${apiFirst}–${apiLast}: od ${integer(api(apiFirst))} do ${integer(api(apiLast))} rocznie${estimate ? `; szacunek na ${estimate.year} r.: ok. ${integer(estimate.hospitalizations)}` : ""}`}
              period="year" height={300} modeBar={false}
            />
          </ArticleFigure>
          {estimate ? <details className={h55.details}>
            <summary>Jak powstał szacunek za {estimate.year} r.</summary>
            <p className={styles.note}>
            Punkty rozliczone przez NFZ w każdym z {estimate.providers} szpitali przeliczono na pobyty. Pobyt w zakresie „zespół chirurgii jednego dnia” to 3362 pkt,
            zwykła hospitalizacja przeciętnie {integer(estimate.pointsPerStay)} pkt (tyle wychodzi z danych NFZ za {estimate.referenceYear} r.). Wynik nie może być mniejszy niż liczba pacjentów szpitala.
            Ta sama metoda dla {estimate.backtest.year} r. daje {integer(estimate.backtest.estimate)} pobytów wobec {integer(estimate.backtest.api)} w statystykach NFZ.<Ref ids={["rozliczenia"]} />
            {" "}Liczby dla pojedynczych szpitali i miesięcy w dalszej części tekstu pochodzą z otwartych danych o hospitalizacjach (dla {lastYear} r. łącznie {integer(openYear(lastYear))}).<Ref ids={["dane"]} />
          </p>
          </details> : null}
        </section>

        <section id="mapa" aria-labelledby="mapa-h">
          <h2 id="mapa-h">Gdzie rozliczano H55</h2>
          <p>
            Kropka to placówka, a jej wielkość — liczba hospitalizacji H55 w roku. Włącz odtwarzanie albo przesuń suwak, żeby zobaczyć, jak od {firstYear} r. przybywało ośrodków.<Ref ids={["dane"]} />
          </p>
          <ArticleTimelineMap
            title="Gdzie i ile hospitalizacji H55 rozliczono w każdym roku?"
            caption="Miasta: kropka = placówka (pole = hospitalizacje H55 w roku), kolor = wobec średniej placówek w danym roku, skala od −2 do +2 odchyleń standardowych. Województwa: hospitalizacje na 100 tys. mieszkańców wobec średniej województw w danym roku, skala od −2 do +2 odchyleń standardowych. Mapa jak w widoku „Gdzie” eksploratora. Dane: otwarte dane NFZ o hospitalizacjach."
            productCodes={[data.product]}
            years={data.years}
            method="min"
          />
          <p>
            Przez pierwsze lata co trzecia hospitalizacja H55 w Polsce pochodziła z jednego województwa. W latach {REGION_EARLY[0]}–{REGION_EARLY.at(-1)} placówki z zachodniopomorskiego rozliczały
            {" "}od {percent(Math.min(...REGION_EARLY.map((y) => regionShare(WEST_POMERANIA, y))), 100)} do {percent(Math.max(...REGION_EARLY.map((y) => regionShare(WEST_POMERANIA, y))), 100)} wszystkich hospitalizacji H55 w Polsce.
            {" "}Później zabiegi rozeszły się po kraju, ale nierówność została: od {REGION_LATE[0]} r. placówki z czterech województw — zachodniopomorskiego, pomorskiego,
            {" "}wielkopolskiego i kujawsko-pomorskiego — to wciąż od {percent(Math.min(...regionLate.map((y) => regionShare(NORTH_WEST, y))), 100)} do {percent(Math.max(...regionLate.map((y) => regionShare(NORTH_WEST, y))), 100)} krajowych H55.<Ref ids={["dane"]} />
          </p>
        </section>

        <section id="sygnaly" aria-labelledby="sygnaly-h">
          <h2 id="sygnaly-h">Pierwsze sygnały: kiedy NFZ mógł wiedzieć</h2>
          <p>
            NFZ zaglądał do rozliczeń H55 na długo przed falą kontroli z lat 2023–2026.<Ref ids={["kontrole"]} /> Po każdej kolejnej kontroli zarzuty były bardziej konkretne:
          </p>
          <ul>
            <li>
              <strong>2019 r., Białystok i Mońki.</strong> Wydział kontroli w Białymstoku bada m.in. hospitalizacje H55 za 2017 r. Kontrole są wielotematyczne i kończą się
              oceną „pozytywna z nieprawidłowościami”. Ustalenia dotyczą błędnego zakwalifikowania świadczeń i personelu — nie samej termolezji.
            </li>
            <li>
              <strong>2020 r., Zamość.</strong> Wydział w Lublinie bada H55 za lata 2018–2019. Ocena negatywna, skutki {formatPln(c("Zamość").effectPln)}, zalecenie: rzetelnie wykazywać świadczenia.
            </li>
            <li>
              <strong>{rawicz.start.slice(0, 4)}–{rawicz.end.slice(0, 4)} r., Rawicz.</strong> Wydział w Poznaniu po raz pierwszy wprost ocenia negatywnie <strong>zasadność hospitalizacji</strong> przy termolezji
              i wykazywanie procedury 03.96 w H55. Skutki: {formatPln(rawicz.effectPln)} (kara umowna i zwrot). Kontrola kończy się {inMonth(rawicz.end)}
            </li>
            <li>
              <strong>{remedium.start.slice(0, 4)} r., Poznań.</strong> Ten sam wydział stwierdza w Wielkopolskich Centrach Medycznych Remedium, że pacjentów można było leczyć ambulatoryjnie.
              Skutki: {formatPln(remedium.effectPln)}.
            </li>
            <li>
              <strong>{c("Otwock (CMKP)").start.slice(0, 4)} r., Otwock.</strong> Wydział w Warszawie stwierdza błędne kwalifikowanie świadczeń H55 do rozliczenia.
            </li>
          </ul>
          <p>
            <strong>Najpóźniej {inMonth(rawicz.end)} NFZ miał na piśmie jasny zarzut: szpital robił termolezję na oddziale, choć mógł w poradni.</strong>
            {" "}Rok później ten sam wydział napisał to samo o drugiej placówce. W tym czasie liczba hospitalizacji H55 w Polsce prawie się podwoiła: z {integer(api(2021))} w 2021 r. do {integer(api(2022))} w 2022 r.<Ref ids={["api"]} />
            {" "}Po kontroli w Otwocku, zakończonej pod koniec 2022 r., na kolejną kontrolę H55 trzeba było czekać do jesieni 2023 r.
          </p>
          <p>
            Do końca 2022 r. NFZ przeprowadził {early.length} kontroli obejmujących H55. W {earlyCount("ambulatoryjnie")} z nich (Rawicz, Poznań) pisze wprost: pobyt w szpitalu był zbędny,
            bo pacjenta można było leczyć w poradni.
          </p>
          <details className={h55.details}>
            <summary>Kontrole z lat 2019–2022 w tabeli</summary>
            <ControlsTable items={early} initial={early.length} caption={`${early.length} kontroli z H55 z lat 2019–2022`} />
          </details>
        </section>

        <section id="seria" aria-labelledby="seria-h">
          <h2 id="seria-h">Kontrole z lat 2023–2026</h2>
          <p>
            Jesienią 2023 r. w ciągu kilku tygodni trzy wydziały NFZ — w Warszawie, Katowicach i Białymstoku — wchodzą z kontrolą H55 do Przasnysza, Mikołowa, Siemianowic i Gryfina.
            Z dokumentów nie wynika, czy wymieniały się ustaleniami. Do połowy 2026 r. NFZ przeprowadza {series.length} kontroli H55 w {seriesFacilities.length} szpitalach (w Koszalinie dwie).
            Każda kończy się oceną negatywną. Wydział w Białymstoku prowadzi {bialystok.length} z nich.
          </p>
          <h3>Co kwestionował NFZ</h3>
          <p>
            Kontrolerzy NFZ raz po raz dochodzili do tego samego wniosku: pacjent nie musiał leżeć w szpitalu. Tak było w {seriesCount("ambulatoryjnie")} z {series.length} kontroli z lat 2023–2026.
            {" "}W {seriesCount("skierowanie")} szpitalach część chorych przyjęto nawet bez skierowania. W {seriesQualificationOnly.length} kolejnych NFZ zarzucił szpitalom,
            {" "}że <strong>wpisywały do rozliczeń procedury i rozpoznania, których nie potwierdza dokumentacja</strong>. Tak ujmowały to wydziały w {qualificationDepartments.map(inDepartment).join(" i ")}; wydział w Białymstoku za każdym razem stawiał pierwszy zarzut.
            W szpitalu MSWiA w Szczecinie kontrolerzy znaleźli też świadczenia bez potwierdzenia w dokumentacji, a w Koszalinie — niewykonane zalecenia z poprzedniej kontroli.
          </p>
          <p>
            Skutki finansowe {seriesH55.length} kontroli dotyczących tylko H55 to <strong>{formatPln(seriesEffect)}</strong>. Drugiej kontroli w Koszalinie ({formatPln(k2.effectPln)})
            nie da się tu doliczyć, bo objęła też inną grupę. Za okresy objęte tymi kontrolami szpitale wykazały świadczenia H55 o wartości {formatPln(settledSeries)}. Skutki to {percent(seriesEffect, settledSeries)} tej kwoty.<Ref ids={["rozliczenia"]} />
            {shares.length ? <> W poszczególnych szpitalach udział wynosi od {Math.round(shares[0].share)}% do {Math.round(shares.at(-1)!.share)}%.</> : null}
          </p>
          <p>
            Skąd ta różnica? W odpowiedzi na pytania przesłane mailem Departament Kontroli NFZ wyjaśnia, że <strong>kontrolerzy sprawdzają tylko wytypowaną próbę hospitalizacji</strong>,
            a <strong>skutki kontroli dotyczą wyłącznie tej próby</strong>. Jak wybierają próbę? Tego fundusz nie ujawnia — według NFZ to nie jest informacja publiczna.<Ref ids={["pismo"]} />
            {" "}W praktyce za zabiegi rozliczone tak samo, ale niewybrane do próby, szpital nie oddaje ani złotówki.
          </p>
          <ControlsTable items={series} caption={`${series.length} kontroli H55 z lat 2023–2026`} />
          <p className={styles.tableNote}>
            Rozliczono: kwota H55 rozliczona przez NFZ za okres objęty kontrolą (dane o kwotach od {firstPlnYear} r.). Plakietka „szacunek” — rok objęty kontrolą tylko w części, a szpital miał H55 także poza okresem;
            kwota jest liczona według liczby hospitalizacji z miesięcy okresu. Skutki: skutki finansowe wykazane w wyniku kontroli. Udział: skutki jako procent kwoty rozliczonej; „—”, gdy skutki obejmują też inne zagadnienia.
            Miesiące: miesiące z H55 w okresie objętym kontrolą, z wszystkich takich miesięcy {firstYear}–{lastYear}.
          </p>
        <p>
            Jak to wyglądało w konkretnych szpitalach? Kolejne części pokazują kilka przykładów: szpitale w Wągrowcu, Mogilnie i Miastku oraz w Piszu, które opisały media, Gryfice, gdzie zabiegi skończyły się z wejściem kontrolerów, i Koszalin, do którego NFZ wszedł dwa razy.
          </p>
        </section>

        <section id="fale" aria-labelledby="fale-h">
          <h2 id="fale-h">Wągrowiec, Mogilno, Miastko: fala przechodzi dalej</h2>
          <p>
            Powiązania szpitali w Wągrowcu, Mogilnie i Miastku z działalnością spółki Spine opisali Michał Janczura i Szymon Jadczak w Wirtualnej Polsce.<Ref ids={["wp-spine"]} />
            {" "}ZOZ w Wągrowcu potwierdził współpracę ze Spine od stycznia 2023 do kwietnia 2024 r.<Ref ids={["wagrowiec"]} /> Dane NFZ pokazują, jak okresy rozliczeń w trzech szpitalach zachodziły na siebie i jak spóźnione były kontrole.
          </p>
          <p>
            Wągrowiec rozliczył <strong>{integer(range("Wągrowiec", "2023-01", "2023-08"))} hospitalizacji H55 od stycznia do sierpnia 2023 r.</strong>{" "}
            Po kilku miesiącach przerwy wrócił do nich w lutym–kwietniu 2024 r. ({integer(range("Wągrowiec", "2024-02", "2024-04"))} hospitalizacji). Od sierpnia 2023 r. takie same rozliczenia pojawiają się w Mogilnie,
            a wiosną 2024 r. — w Miastku. W kwietniu 2024 r. H55 rozliczają wszystkie trzy szpitale naraz.
          </p>
          <FacilityChart
            data={data} title="Jak nakładały się fale H55 w Wągrowcu, Mogilnie i Miastku?" caption={<>{CHART_SOURCE} Pasma w kolorach szpitali: okresy objęte kontrolami; linie: start kontroli.</>} labels={["Wągrowiec", "Mogilno", "Miastko"]} from="2022-10" to="2026-03"
            period="month" monthsOnly
            bands={[wagrowiec, mogilno, miastko].map((control, i) => ({ from: control.studyFrom, to: control.studyTo, color: REGION_PICK_COLORS[i] }))}
            markers={startMarkers([wagrowiec, mogilno, miastko], true)}
            ariaLabel="Hospitalizacje H55 w miesiącach w Wągrowcu, Mogilnie i Miastku 2022–2025 i starty kontroli: Wągrowiec latem 2024 r., Mogilno pod koniec 2025 r., Miastko na początku 2026 r."
          />
          <p>
            Kontrolerzy wchodzą do Wągrowca {inMonth(wagrowiec.start)}, gdy szpital od trzech miesięcy nie rozlicza już H55. Sprawdzają <strong>tylko {periodText(wagrowiec.studyFrom, wagrowiec.studyTo)}</strong>.
            Rozliczenia z 2024 r. zostają poza kontrolą. Skutki: {formatPln(wagrowiec.effectPln)}{settledOf("Wągrowiec") ? `, czyli ${shareOf("Wągrowiec")}% kwoty rozliczonej za zbadane miesiące` : ""}.
          </p>
          <p>
            W tym samym czasie Miastko przyspiesza: z ok. 100 H55 miesięcznie wiosną 2024 r. do {integer(month("Miastko", "2025-03"))} w marcu 2025 r. Potem zabiegi urywają się z dnia na dzień.
            <strong> Kontrolerzy byli w jednym szpitalu, a w drugim zabiegów przybywało.</strong> Do Mogilna i Miastka NFZ wchodzi dopiero {inMonth(mogilno.start).replace(/^w /, "w ")} i {inMonth(miastko.start).replace(/^w /, "")}
            {" "}— gdy żaden z tych szpitali od dawna nie rozlicza H55. Obie kontrole obejmują cały okres rozliczeń H55 i kończą się wysokimi skutkami: {formatPln(mogilno.effectPln)} w Mogilnie
            i {formatPln(miastko.effectPln)} w Miastku{settledOf("Miastko") ? ` (${shareOf("Miastko")}% kwoty rozliczonej za zbadany okres)` : ""}.
          </p>
        </section>

        <section id="pisz" aria-labelledby="pisz-h">
          <h2 id="pisz-h">Pisz: zbadany jeden rok z dwóch</h2>
          <p>
            Szpitalem w Piszu zajęli się również Janczura i Jadczak — w związku z zabiegami jednego neurochirurga, który kwestionował zarzuty.<Ref ids={["wp-pisz"]} />
            {" "}Szpital, który wcześniej w ogóle nie rozliczał H55, wykazał {integer(yearOf("Pisz", "2023"))} takich hospitalizacji w 2023 r. i {integer(yearOf("Pisz", "2024"))} w 2024 r.
            {" "}Kontrolerzy przychodzą {inMonth(pisz.start)} i sprawdzają <strong>tylko 2023 r.</strong> Niemal równie intensywny 2024 r. zostaje poza kontrolą.
          </p>
          <p>
            Zarzuty są dwa: <strong>niezasadna hospitalizacja</strong> — cel leczenia można było osiągnąć w poradni — i <strong>przyjęcia bez skierowania</strong>.
            {" "}Skutki: {formatPln(pisz.effectPln)}{shareOf("Pisz") ? `, czyli ${shareOf("Pisz")}% wartości świadczeń wykazanych za zbadany rok` : ""}.<Ref ids={["kontrole"]} />
            {clinic(pisz.provider) && !clinic(pisz.provider).neurosurgery[2023] && !clinic(pisz.provider).neurosurgery[2024] && !clinic(pisz.provider).painClinic[2023] && !clinic(pisz.provider).painClinic[2024] ? <> W latach 2023–2024 szpital w Piszu nie miał poradni neurochirurgicznej ani poradni leczenia bólu. </> : null}
          </p>
          <FacilityChart
            data={data} title="Który rok w Piszu zbadała kontrola?" caption={<>{CHART_SOURCE} Pasmo: okres objęty kontrolą; linia: start kontroli.</>} labels={["Pisz"]} from="2022-07" to="2025-12"
            period="month"
            bands={[{ from: pisz.studyFrom, to: pisz.studyTo }]}
            markers={startMarkers([pisz], false)}
            ariaLabel={`Hospitalizacje H55 w miesiącach w Piszu: ${integer(yearOf("Pisz", "2023"))} w 2023 r. i ${integer(yearOf("Pisz", "2024"))} w 2024 r.; kontrola objęła 2023 r.`}
          />
        </section>

        <section id="gryfice" aria-labelledby="gryfice-h">
          <h2 id="gryfice-h">Gryfice: kontrola zatrzymała zabiegi, ale nie sprawdziła rekordowych lat</h2>
          <p>
            Szpital w Gryficach rozliczał H55 od lat, ale prawdziwy rozpęd przyszedł później: {integer(yearOf("Gryfice", "2022"))} hospitalizacji w 2022 r.,
            {" "}{integer(yearOf("Gryfice", "2023"))} w 2023 r. i <strong>{integer(yearOf("Gryfice", "2024"))} w 2024 r.</strong><Ref ids={["dane"]} />
          </p>
          <p>
            Kontrolerzy wchodzą {inMonth(gryfice.start)} i sprawdzają <strong>tylko {periodText(gryfice.studyFrom, gryfice.studyTo)} r.</strong> Ocena negatywna: hospitalizacje niezasadne,
            {" "}część pacjentów przyjęta bez skierowania. Skutki: {formatPln(gryfice.effectPln)}.<Ref ids={["kontrole"]} />
            {" "}Dwa najbardziej intensywne lata, 2023 i 2024, zostają poza kontrolą.
          </p>
          <p>
            Kontrola zadziałała szybciej niż jej wynik. W {gryficeStartYear} r., do wejścia kontrolerów, szpital wykazywał średnio {integer(gryficeBefore)} H55 miesięcznie.
            {" "}W trakcie kontroli ({periodText(gryfice.start.slice(0, 7), gryfice.end.slice(0, 7))}) — jeszcze {integer(gryficeDuring)}.
            {" "}Po jej zakończeniu, od {MONTHS_GENITIVE[Number(gryficeAfterFrom.slice(5)) - 1]} do końca {lastYear} r., łącznie <strong>{integer(gryficeAfterTotal)} {hospitalizationsWord(gryficeAfterTotal)}</strong>. Tak jak w Piszu: po kontroli zabiegów na oddziale prawie nie ma, ale kontrola nie objęła lat, w których było ich najwięcej.
            {thermo && thermolysisOf(data, gryfice.provider, tLast, CLINIC_THERMOLYSIS) > 0 ? <>{" "}W {tLast} r. termolezję w poradni tego szpitala miało {integer(thermolysisOf(data, gryfice.provider, tLast, CLINIC_THERMOLYSIS))} pacjentów, rok wcześniej — {thermolysisOf(data, gryfice.provider, Number(tLast) - 1, CLINIC_THERMOLYSIS) ? integer(thermolysisOf(data, gryfice.provider, Number(tLast) - 1, CLINIC_THERMOLYSIS)) : "żaden"}.<Ref ids={["icd"]} /></> : null}
          </p>
          <FacilityChart
            data={data} title="Co stało się z H55 w Gryficach po wejściu kontrolerów?" caption={<>{CHART_SOURCE} Pasmo: okres objęty kontrolą; linia: start kontroli.</>} labels={["Gryfice"]} from="2021-01" to="2025-12"
            period="month"
            bands={[{ from: gryfice.studyFrom, to: gryfice.studyTo }]}
            markers={startMarkers([gryfice], false)}
            ariaLabel={`Hospitalizacje H55 w Gryficach w miesiącach 2021–2025: ${integer(yearOf("Gryfice", "2024"))} w 2024 r.; kontrola objęła 2022 r.`}
          />
        </section>

        <section id="koszalin" aria-labelledby="koszalin-h">
          <h2 id="koszalin-h">Koszalin: dwie kontrole i rekordowy rok</h2>
          <p>
            Szpital Wojewódzki w Koszalinie rozlicza H55 co najmniej od 2017 r. Do końca {lastYear} r. wykazał {integer(koszalinFacility.coverage!.hospitalizations)} hospitalizacji — najwięcej spośród skontrolowanych szpitali.
          </p>
          <p>
            <strong>Pierwsza kontrola</strong> trwała {spanText(k1.start, k1.end)} i sprawdzała tylko {periodText(k1.studyFrom, k1.studyTo)} r. Ocena negatywna, skutki {formatPln(k1.effectPln)}.
            NFZ każe przyjmować na oddział tylko pacjentów, których nie da się leczyć w poradni.<Ref ids={["kontrole"]} />
          </p>
          <p>
            Po kontroli hospitalizacji nie ubywa, tylko przybywa. Do końca 2024 r. szpital rozlicza jeszcze {integer(afterK1)} H55, a {lastYear} r. jest rekordowy:
            {" "}<strong>{integer(yearOf("Koszalin", lastYear))} hospitalizacji</strong>{koszalinPln[lastYear] ? <> o wartości {formatPln(koszalinPln[lastYear])}{koszalinPln["2024"] ? <> (rok wcześniej {formatPln(koszalinPln["2024"])})</> : null}</> : null}.<Ref ids={["rozliczenia"]} />
          </p>
          <p>
            <strong>Druga kontrola</strong> trwa {spanText(k2.start, k2.end)} Sprawdza H55 z końca 2024 r. oraz inną grupę zabiegów na kręgosłupie (kod H52) i to, czy szpital wykonał zalecenia. Stwierdza
            {" "}<strong>niewykonanie zaleceń pokontrolnych</strong>, niezasadne hospitalizacje i przyjęcia bez skierowania. Skutki: <strong>{formatPln(k2.effectPln)}</strong>, w tym za drugą grupę.<Ref ids={["kontrole"]} />
            {" "}Kontrolerzy są w szpitalu, a ten dalej rozlicza H55 — do końca {lastYear} r. jeszcze {integer(duringK2)}.
          </p>
          <FacilityChart
            data={data} title="Co działo się z H55 w Koszalinie między kontrolami?" caption={<>{CHART_SOURCE} Pasma: okresy objęte kontrolami; linie: start kontroli.</>} labels={["Koszalin"]} from="2022-01" to="2025-12" period="month"
            bands={[{ from: k1.studyFrom, to: k1.studyTo }, { from: k2.studyFrom, to: k2.studyTo }]}
            markers={[{ date: k1.start, label: "start 1. kontroli" }, { date: k2.start, label: "start 2. kontroli" }]}
            ariaLabel={`Hospitalizacje H55 w Koszalinie w miesiącach 2022–2025: po pierwszej kontroli liczba rośnie do ${integer(yearOf("Koszalin", lastYear))} w ${lastYear} r.`}
          />
        </section>

        <section id="po-kontroli" aria-labelledby="po-kontroli-h">
          <h2 id="po-kontroli-h">Co działo się po kontroli</h2>
          <p>
            Koszalin nie jest jedynym szpitalem, który po kontroli dalej rozliczał H55. Tak wyglądało to we wszystkich {seriesFacilities.length} szpitalach skontrolowanych w latach 2023–2026:
          </p>
          <ul>
            <li><strong>W {aftermathOf("before").length} szpitalach rozliczanie H55 skończyło się, zanim przyszli kontrolerzy</strong> ({names(aftermathOf("before"))}). NFZ sprawdzał po fakcie.</li>
            <li><strong>{aftermathOf("stopped").length} przestały w czasie kontroli lub zaraz po niej</strong> ({names(aftermathOf("stopped"))}).</li>
            <li><strong>{aftermathOf("continued").length + aftermathOf("returned").length} rozliczały dalej</strong> ({names([...aftermathOf("continued"), ...aftermathOf("returned")])}); Przasnysz po półrocznej przerwie wrócił do H55.</li>
            {aftermathOf("unknown").length ? <li>W {aftermathOf("unknown").length} na ocenę jest za wcześnie: kontrole skończyły się w 2026 r., a dane sięgają końca {lastYear} r. ({names(aftermathOf("unknown"))}).</li> : null}
          </ul>
          <details className={h55.details}>
            <summary>Tabela: H55 przed kontrolą, w jej trakcie i po niej</summary>
          <div className={`priority-table ${h55.tableBox}`}>
            <table className={styles.table}>
              <caption>H55 przed kontrolą, w jej trakcie i po niej (pierwsza kontrola w szpitalu)</caption>
              <thead><tr>
                <th scope="col">Szpital, kontrola</th>
                <th scope="col" className={styles.num}>Pół roku przed</th>
                <th scope="col" className={`${styles.num} col-p2`}>W trakcie</th>
                <th scope="col" className={styles.num}>Po kontroli</th>
              </tr></thead>
              <tbody>{aftermathRows.map((row) => <tr key={row.facility.key}>
                <th scope="row">{row.facility.label}<span className={h55.cellNote}>{periodText(row.control.start.slice(0, 7), row.control.end.slice(0, 7))} · {AFTERMATH_TEXT[row.outcome]}</span></th>
                <td className={styles.num}>{integer(row.before)}</td>
                <td className={`${styles.num} col-p2`}>{integer(row.during)}</td>
                <td className={styles.num}>{row.outcome === "unknown" ? "—" : integer(row.afterAll)}</td>
              </tr>)}</tbody>
            </table>
            <p className={styles.tableNote}>Hospitalizacje H55 z otwartych danych. Po kontroli: od miesiąca po jej zakończeniu do końca {lastYear} r.</p>
          </div>
          </details>
        </section>

        <section id="z-lotu-ptaka" aria-labelledby="z-lotu-ptaka-h">
          <h2 id="z-lotu-ptaka-h">Ile kontrolerzy zobaczyli</h2>
          <p>
            {seriesFacilities.length} szpitali, do których NFZ wszedł z kontrolą H55 w latach 2023–2026, wykazywało te zabiegi łącznie przez <strong>{sumSeries.months} miesięcy</strong>.
            {" "}Kontrolerzy sprawdzili <strong>{sumSeries.studied} z nich, czyli {percent(sumSeries.studied, sumSeries.months)}</strong>.
            {" "}Pozostałych {sumSeries.months - sumSeries.studied} miesięcy nikt nie obejrzał: {sumSeries.before} przypada na czas przed sprawdzanym okresem, a {sumSeries.after} — na czas po nim.<Ref ids={["kontrole", "dane"]} />
          </p>
          {seriesTotalPln ? <p>
            Od {firstPlnYear} r. te szpitale wykazały świadczenia H55 o wartości <strong>{formatPln(seriesTotalPln)}</strong>.
            {" "}Kontrolerzy sprawdzili okresy warte {formatPln(settledSeries)}, czyli <strong>{percent(settledSeries, seriesTotalPln)} tej kwoty</strong> (bez drugiej kontroli w Koszalinie, która objęła też inną grupę).
            {" "}Skutki finansowe tych kontroli to {formatPln(seriesEffect)}, czyli <strong>{percent(seriesEffect, seriesTotalPln)} wartości wszystkich świadczeń H55</strong>, które te szpitale wykazały od {firstPlnYear} r.<Ref ids={["rozliczenia", "kontrole"]} />
          </p> : null}
          <ArticleFigure title="Które miesiące sprawdzili kontrolerzy?" caption={<>Wiersz = szpital, kratka = miesiąc z co najmniej jedną hospitalizacją H55. Błękit: miesiąc objęty kontrolą, pomarańcz: miesiąc poza kontrolą. Im ciemniejsza kratka, tym więcej hospitalizacji. Po prawej: miesiące sprawdzone z wszystkich miesięcy z H55. Najedź na kratkę, żeby zobaczyć liczbę. Źródło: dane NFZ, wyniki kontroli NFZ, obliczenia funduszdanych.pl.</>}>
            <ControlCoverageGrid
              months={data.months}
              groups={[
                { title: `${seriesFacilities.length} szpitali skontrolowanych w latach 2023–2026`, rows: coverageRows(seriesFacilities) },
                { title: `${data.facilities.early.length} placówek skontrolowanych w latach 2019–2022`, rows: coverageRows(data.facilities.early) },
              ]}
              ariaLabel={`Miesiące z H55 w ${seriesFacilities.length + data.facilities.early.length} skontrolowanych placówkach: kontrole objęły ${sumAll.studied} z ${sumAll.months}.`}
            />
          </ArticleFigure>
          <h3 id="krotkie-serie">Placówki bez kontroli</h3>
          <p>
            Do części placówek kontrolerzy nie przyszli wcale, choć ich rozliczenia wyglądały tak samo: kilkaset zabiegów w krótkim czasie, a potem cisza.
            {" "}Kryterium: żadnej kontroli H55, wszystkie hospitalizacje H55 w najwyżej {SHORT_SERIES_MAX_SPAN} kolejnych miesiącach i co najmniej {SHORT_SERIES_MIN_TOTAL} takich hospitalizacji.
            {" "}Ten wzór ma <strong>{data.shortSeries.length} {facilitiesWord(data.shortSeries.length)}: razem {integer(totals.short.hospitalizations)} hospitalizacji w {totals.short.months} miesiącach</strong>. Żaden z tych miesięcy nie był objęty kontrolą.<Ref ids={["kontrole", "dane"]} />
          </p>
          <div className={`priority-table ${h55.tableBox}`}>
            <table className={styles.table}>
              <caption>Placówki z krótkim okresem rozliczania H55, bez kontroli H55</caption>
              <thead><tr>
                <th scope="col">Placówka</th>
                <th scope="col">Okres H55</th>
                <th scope="col" className={styles.num}>Hospitalizacje</th>
              </tr></thead>
              <tbody>{data.shortSeries.map((item) => {
                const first = item.values.findIndex((value) => value > 0);
                const last = item.values.length - 1 - [...item.values].reverse().findIndex((value) => value > 0);
                return <tr key={item.key}>
                  <th scope="row"><FacilityName facility={item} /><span className={h55.cellNote}>{item.label}</span></th>
                  <td>{periodText(data.months[first], data.months[last])}</td>
                  <td className={styles.num}>{integer(item.coverage!.hospitalizations)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <ArticleFigure title="Kiedy rozliczały H55 placówki bez kontroli?" caption={<>Wiersz = placówka, kratka = miesiąc z co najmniej jedną hospitalizacją H55. Im ciemniejsza kratka, tym więcej hospitalizacji. Po prawej: miesiące objęte kontrolą z wszystkich miesięcy z H55. Źródło: dane NFZ, obliczenia funduszdanych.pl.</>}>
            <ControlCoverageGrid
              months={data.months}
              controlled={false}
              groups={[{ rows: coverageRows(data.shortSeries) }]}
              ariaLabel={`Miesiące z H55 w ${data.shortSeries.length} placówkach bez kontroli: ${totals.short.months} miesięcy, żaden nie objęty kontrolą.`}
            />
          </ArticleFigure>
          <p>
            Krótki, intensywny okres rozliczeń nie dowodzi niezasadnego leczenia ani błędnych rozliczeń. To jednak ten sam wzór, który w innych szpitalach kończył się oceną negatywną.
            {recentShort.length ? <>{" "}<strong>{recentShort.length} z tych placówek zaczęło rozliczać H55 dopiero w latach {Number(lastYear) - 1}–{lastYear}.</strong> To mogą być kolejni naśladowcy.
              {" "}Kontrolerzy przychodzili zwykle z dużym opóźnieniem: od końca sprawdzanego okresu do startu kontroli mijało przeciętnie {lagMedian} miesięcy (mediana kontroli z lat 2023–2026).
              </> : null}
          </p>
        </section>

        {data.sudden.length ? <section id="bez-kontroli" aria-labelledby="bez-kontroli-h">
          <h2 id="bez-kontroli-h">Gwałtowne wzrosty bez kontroli</h2>
          <p>
            Krótkie okresy rozliczeń to nie jedyny sygnał. W części placówek bez kontroli H55 liczba zabiegów w latach 2023–{lastYear} wystrzeliła:
            {" "}rok z co najmniej {SUDDEN_MIN_YEAR} hospitalizacjami i co najmniej {SUDDEN_GROWTH} razy więcej niż średnio w latach {SUDDEN_BASE_YEARS[0]}–{SUDDEN_BASE_YEARS.at(-1)}.
            {" "}Do listy trafiły też placówki, w których liczba H55 w {lastYear} r. spadła do najwyżej {Math.round(SUDDEN_DROP * 100)}% wcześniejszego rekordu.
            {" "}Reguła wskazuje <strong>{growth.length} {facilitiesWord(growth.length)} ze wzrostem</strong> i {drops.length} z nagłym spadkiem.<Ref ids={["dane"]} />
          </p>
          <ExpandableTable
            initial={5}
            className={`priority-table ${h55.tableBox}`}
            tableClassName={styles.table}
            caption={`Placówki bez kontroli H55 z gwałtowną zmianą liczby H55`}
            head={<tr>
              <th scope="col">Placówka</th>
              <th scope="col" className={`${styles.num} col-p2`}>Średnio {SUDDEN_BASE_YEARS[0]}–{SUDDEN_BASE_YEARS.at(-1)}</th>
              <th scope="col" className={styles.num}>H55, {lastYear}</th>
              <th scope="col" className={`${styles.num} col-p2`}>Leczenie 1 dnia, {lastYear}</th>
              {thermo ? <th scope="col" className={`${styles.num} col-p3`}>{CLINIC_THERMOLYSIS}, {tLast}</th> : null}
            </tr>}
            rows={data.sudden.map((item) => {
              const info = clinic(item.facility.key);
              const day0 = day0Of([item.facility.key], Number(lastYear));
              return <tr key={item.facility.key}>
                <th scope="row">
                  <FacilityName facility={item.facility} />
                  <span className={h55.cellNote}>
                    {item.facility.label} · {item.kind === "growth" ? "wzrost" : "spadek"} · {info?.neurosurgery[lastClinicYear] ? `poradnia neurochirurgiczna${info.since ? ` od ${info.since.slice(0, 4)} r.` : ""}` : "bez poradni neurochirurgicznej"}
                    {info?.neurosurgeryWard[lastClinicYear] ? " · oddział neurochirurgii" : ""}{info && !info.neurosurgery[lastClinicYear] && info.painClinic[lastClinicYear] ? " · poradnia leczenia bólu" : ""}
                  </span>
                </th>
                <td className={`${styles.num} col-p2`}>{integer(item.base)}</td>
                <td className={styles.num}>{integer(item.byYear[lastYear] ?? 0)}</td>
                <td className={`${styles.num} col-p2`}>{day0.total ? percent(day0.day0, day0.total) : "—"}</td>
                {thermo ? <td className={`${styles.num} col-p3`}>{integer(thermolysisOf(data, item.facility.key, tLast, CLINIC_THERMOLYSIS))}</td> : null}
              </tr>;
            })}
          />
          <p className={styles.tableNote}>
            Hospitalizacje H55 z otwartych danych NFZ. Leczenie 1 dnia: wypis w dniu przyjęcia. {CLINIC_THERMOLYSIS}: pacjenci z termolezją rozliczaną w poradni u tego samego świadczeniodawcy.
            {" "}Poradnie i oddziały: RPWDL, stan w {lastClinicYear} r.
          </p>
          <p>
            {newSince2023.length ? <>Przed 2023 r. w ogóle nie rozliczało H55 {newSince2023.length} {facilitiesWord(newSince2023.length)} z tej listy: {newSince2023.map((item) => listName(item.facility.label)).join(", ")}. </> : null}
            {mid2022.length > 1 ? <>W kolejnych {mid2022.length} wzrost zaczął się niemal jednocześnie, w połowie 2022 r.: {mid2022.map((item) => listName(item.facility.label)).join(", ")}. </> : null}
            {noNeuro.length ? <><strong>Spośród {growth.length} placówek ze wzrostem {noNeuro.length} nie miało w {lastClinicYear} r. poradni neurochirurgicznej</strong>
              {noNeuroAtAll.length ? <>, a {noNeuroAtAll.length} z nich nie miało też poradni leczenia bólu ani oddziału neurochirurgii ({noNeuroAtAll.map((item) => listName(item.facility.label)).join(", ")})</> : null}.<Ref ids={["rpwdl"]} /> </> : null}
            {growthDay0.total ? <>W {lastYear} r. {percent(growthDay0.day0, growthDay0.total)} ich hospitalizacji H55 to leczenie jednego dnia.</> : null}
          </p>
          <p>
            {thermo && clinicButFew.length ? <><strong>Aż {clinicButFew.length} {facilitiesWord(clinicButFew.length)} z tej listy miało poradnię neurochirurgiczną lub poradnię leczenia bólu, a mimo to w {tLast} r. wykonało termolezję w poradni u najwyżej {FEW_CLINIC - 1} pacjentów albo wcale</strong>:
              {" "}{clinicButFew.map((item) => `${distinctName(item.facility, clinicButFew.map((other) => other.facility))} (${integer(thermolysisOf(data, item.facility.key, tLast, CLINIC_THERMOLYSIS))})`).join(", ")}.
              {" "}Zabieg, który mogły zrobić w poradni, rozliczały jako hospitalizację.<Ref ids={["rpwdl", "icd"]} />{" "}</> : null}
      
          </p>
        </section> : null}

        <section id="wykres-placowki" aria-labelledby="wykres-placowki-h">
          <h2 id="wykres-placowki-h">Wykres dowolnej placówki</h2>
          <p>
            Wybierz placówkę, żeby zobaczyć jej hospitalizacje H55 miesiąc po miesiącu. Na liście są placówki omawiane w tekście ({pickerFacilities.length}): skontrolowane
            {" "}oraz niekontrolowane z krótkim okresem rozliczeń lub gwałtownym wzrostem.
          </p>
          <H55FacilityPicker
            months={data.months}
            facilities={pickerFacilities}
            initialKey={pickerInitial}
            caption={`Pacjenci z termolezją: liczba pacjentów (nie hospitalizacji) u świadczeniodawcy w roku, zestawienie NFZ wg ICD-10 i ICD-9. Poradnie: RPWDL, wrzesień 2026. Pasmo: okres objęty kontrolą; linia pionowa: start kontroli (tylko placówki z kontrolą H55). ${CHART_SOURCE}`}
          />
        </section>

        <section id="2026" aria-labelledby="2026-h">
          <h2 id="2026-h">Co się zmieniło w 2026 r.</h2>
          <p>
            Od 2026 r. termolezja trafia do nowej grupy HK14 „Ablacyjne zabiegi przeciwbólowe na strukturach nerwów obwodowych”.
            Pozostałe procedury dawnej H55 przeszły do innych grup, m.in. HK08.<Ref ids={["gruper"]} /> NFZ płaci za HK14 o ponad jedną trzecią mniej niż za H55.<Ref ids={["wyceny"]} />
          </p>
          {h55v ? <div className={`priority-table ${h55.tableBox}`}>
            <table className={styles.table}>
              <caption>Wycena termolezji: H55 ({h55v.year} r.) i HK14 ({hk14.year} r.), punkty</caption>
              <thead><tr>
                <th scope="col">Rodzaj pobytu</th>
                <th scope="col" className={styles.num}>H55, {h55v.year}</th>
                <th scope="col" className={styles.num}>HK14, {hk14.year}</th>
                <th scope="col" className={styles.num}>Zmiana</th>
              </tr></thead>
              <tbody>{VALUATION_ROWS.filter((row) => h55v.points[row.key] && hk14.points[row.key]).map((row) => <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td className={styles.num}>{integer(h55v.points[row.key]!)}</td>
                <td className={styles.num}>{integer(hk14.points[row.key]!)}</td>
                <td className={styles.num}>{change(h55v.points[row.key]!, hk14.points[row.key]!)}</td>
              </tr>)}</tbody>
            </table>
            <p className={styles.tableNote}>
              Źródło: katalog grup JGP (załącznik 1a do zarządzeń Prezesa NFZ). Wycena HK14 według zarządzenia nr 46/2026/DSOZ; te same wartości
              zarządzenie nr 32/2026/DSOZ ustaliło dla świadczeń od początku 2026 r.
            </p>
          </div> : null}
          {h55v && h55Point && hk14Point ? <p>
            Punkt ma różną wartość w różnych umowach. Przeciętnie NFZ płacił za punkt w H55 {decimal(h55Point.perPoint, 2)} zł ({h55v.year} r.), a w HK14 {decimal(hk14Point.perPoint, 2)} zł ({hk14.year} r.).<Ref ids={["rozliczenia"]} />
            {" "}Leczenie jednego dnia w szpitalu kosztuje więc ok. {zl((h55v.points.zero_dni ?? h55v.points.hospitalizacja) * h55Point.perPoint)} w H55 i ok. {zl((hk14.points.zero_dni ?? hk14.points.hospitalizacja) * hk14Point.perPoint)} w HK14.
            {" "}Nowe zasady zmieniają cennik. Nie odpowiadają jednak na pytanie, dlaczego nadzór NFZ przez lata nie nadążał za rozliczeniami.
          </p> : null}
        </section>

        <section id="pytania" aria-labelledby="pytania-h">
          <h2 id="pytania-h">Pytania do NFZ</h2>
          <p>
            Najważniejszy w tej historii nie jest sam wzrost liczby zabiegów. NFZ znał problem od 2021 r., a kontrole od 2023 r. objęły
            {" "}{percent(sumSeries.studied, sumSeries.months)} miesięcy, w których skontrolowane szpitale rozliczały H55. Te daty nie dowodzą, że wydziały NFZ nie wymieniały się wiedzą. Rodzą jednak pytania:
          </p>
          <ol className={styles.steps}>
            <li>Co NFZ zrobił z ustaleniami z Rawicza (2021 r.) i Poznania (2022 r.), gdy liczba hospitalizacji H55 w kraju rosła najszybciej?</li>
            <li>Dlaczego kontrole rozpoczęte w latach 2024–2025 badały najczęściej tylko 2022 r., a nie późniejsze lata tych samych szpitali?</li>
            <li>Kto sprawdza wykonanie zaleceń pokontrolnych? W Koszalinie niewykonanie zaleceń ustaliła dopiero druga kontrola, ponad rok po pierwszej.</li>
            <li>Czy ustalenia jednego wydziału trafiały do innych, gdy podobne wzrosty rozliczeń zaczynały się w kolejnych szpitalach?</li>
            <li>Dlaczego {data.shortSeries.length} placówek z krótkimi, intensywnymi okresami rozliczania H55 nie trafiło do kontroli, choć ich rozliczenia wyglądały jak w szpitalach z oceną negatywną?</li>
          </ol>
        </section>

        <section id="metoda" aria-labelledby="metoda-h">
          <h2 id="metoda-h">Metoda</h2>
          <ul>
            <li>Liczby krajowe z API statystyk JGP NFZ ({apiFirst}–{apiLast}).{estimate ? ` ${estimate.year} r.: szacunek funduszdanych.pl z punktów rozliczonych przez NFZ w każdym szpitalu (opis w części „Ile kosztowało H55”).` : ""} Koszt: kwoty z zestawienia świadczeń NFZ od {firstPlnYear} r.{cost?.estimated.length ? `; lata ${cost.estimated.map((row) => row.year).join("–")} — szacunek z liczby pobytów i przeciętnej kwoty za pobyt w ${firstPlnYear} r.` : ""}</li>
            <li>Hospitalizacje H55 według placówki i miesiąca z otwartych danych NFZ, {firstYear}–{lastYear}.</li>
            <li>Kontrole: zestawienie wszystkich kontroli Departamentu Kontroli NFZ opublikowane w BIP; {H55_CONTROLS.length} kontroli z H55 lub procedurą 03.96 w temacie albo zakresie. Rodzaj ustaleń — z pola „Stwierdzone nieprawidłowości”. Placówka = oddział wojewódzki NFZ + NIP.</li>
            <li>Miesiąc z H55 = miesiąc z co najmniej jedną rozliczoną hospitalizacją H55. Okres objęty kontrolą pochodzi z opisu zakresu kontroli; placówka z kilkoma kontrolami ma sumę ich okresów.</li>
            <li>Kwoty to wykazane skutki finansowe, a nie potwierdzone wpłaty; dotyczą tylko próby objętej kontrolą. Skutki kontroli wielotematycznych nie są przypisane H55.</li>
          </ul>
        </section>

        <footer id="przypisy" className={styles.sources} aria-labelledby="przypisy-h">
          <h2 id="przypisy-h">Przypisy i źródła</h2>
          <ol className={styles.footnotes}>
            {H55_SOURCES.map((source, i) => <li key={source.id} id={`przypis-${i + 1}`}>
              {"href" in source && source.href
                ? isExternal(source.href) ? <a href={source.href} target="_blank" rel="noreferrer">{source.title}</a> : <Link href={source.href}>{source.title}</Link>
                : source.title}
              . <span>Potwierdza: {source.note}.</span>
            </li>)}
          </ol>
        </footer>
      </article>
    </div>
  </main>;
}
