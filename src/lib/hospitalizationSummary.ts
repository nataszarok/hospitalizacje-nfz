import { buildHomeStats, type HomeStats } from "@/lib/homeStats";
import type { RegionsMap } from "@/lib/jgpCard";
import type { StaticDataset, TrendsDataset } from "@/lib/staticData";

/**
 * Karta „Hospitalizacje w Polsce” (/hospitalizacje): podsumowanie wszystkich grup JGP.
 * Projekt i analiza: docs/karta-hospitalizacje-podsumowanie.html. Metoda konserwatywna (wartości „<5” = 1).
 */

/** Opisowe nazwy sekcji katalogu JGP (pierwsza litera kodu), ułożone z nazw grup w sekcji. */
export const JGP_SECTION_LABELS: Record<string, string> = {
  A: "Układ nerwowy",
  B: "Oko",
  C: "Jama ustna, gardło, krtań, nos i ucho",
  D: "Układ oddechowy",
  E: "Układ krążenia",
  F: "Układ pokarmowy",
  G: "Wątroba, drogi żółciowe i trzustka",
  H: "Układ mięśniowo-szkieletowy",
  J: "Skóra, tkanka podskórna i pierś",
  K: "Układ hormonalny i metabolizm",
  L: "Nerki i drogi moczowe",
  M: "Narząd rodny kobiety",
  N: "Ciąża, poród i noworodki",
  P: "Pediatria",
  Q: "Naczynia",
  S: "Krew i układ krwiotwórczy",
  T: "Urazy wielonarządowe",
};

/**
 * Rodziny grup: kody, między którymi przesuwa się kodowanie tego samego problemu (np. B19 → B19G).
 * Porównanie wielu lat ma sens dla rodziny, a nie dla jednej grupy. Lista ręczna, do rozbudowy.
 */
export interface SummaryFamily { id: string; name: string; codes: string[]; note: string }

export const SUMMARY_FAMILIES: SummaryFamily[] = [
  { id: "zacma", name: "Usunięcie zaćmy", codes: ["B18", "B18G", "B19", "B19G"], note: "Od 2019 r. operacje zaćmy rozlicza głównie grupa B19G." },
  { id: "witreoretinalne", name: "Zabiegi witreoretinalne", codes: ["B82", "B83", "B84"], note: "Zabiegi na ciele szklistym i siatkówce." },
  { id: "kregoslup", name: "Zabiegi na kręgosłupie", codes: ["H51", "H52", "H53", "H55"], note: "Od korekcji złożonych (H51) po zabiegi przezskórne (H55)." },
  { id: "ozw", name: "Ostry zespół wieńcowy (OZW)", codes: ["E10", "E11", "E12G", "E15", "E16", "E17G"], note: "Leczenie zachowawcze, diagnostyka i leczenie inwazyjne." },
  { id: "porod", name: "Poród", codes: ["N01", "N02"], note: "Poród pojedynczy, mnogi lub przedwczesny." },
  { id: "noworodki", name: "Noworodki", codes: ["N20", "N21", "N21A", "N22", "N22A", "N23", "N24", "N25", "N26"], note: "Opieka nad noworodkiem, od normalnej po intensywną." },
];

export interface SummaryYear {
  year: string;
  hospitalizations: number;
  deaths: number;
  mortalityPct: number;
  /** Świadczeniodawcy z co najmniej jedną hospitalizacją w roku. */
  providers: number;
  /** Udział 10% największych świadczeniodawców w hospitalizacjach roku (%). */
  top10Pct: number;
}

export interface SummarySection { letter: string; label: string; series: number[]; changePct: number | null; sharePct: number }

export interface SummaryFamilyRow extends SummaryFamily {
  series: number[];
  changePct: number | null;
  /** Kod z największą liczbą hospitalizacji w ostatnim roku: link do karty grupy. */
  mainCode: string;
}

export interface HospitalizationSummary extends HomeStats {
  firstYear: string;
  summaryYears: SummaryYear[];
  /** Miesiące ostatniego i poprzedniego roku (12 wartości; brak danych = `null`). */
  months: { year: string; values: (number | null)[] }[];
  sections: SummarySection[];
  families: SummaryFamilyRow[];
}

const change = (first: number, last: number) => (first ? ((last - first) / first) * 100 : null);

function yearMetrics(dataset: StaticDataset, deaths: number): Pick<SummaryYear, "deaths" | "providers" | "top10Pct"> {
  const byProvider = new Map<string, number>();
  for (const [ow, nip, , , , , hMin] of dataset.facts) {
    if (hMin > 0) byProvider.set(`${ow}|${nip}`, (byProvider.get(`${ow}|${nip}`) ?? 0) + hMin);
  }
  const totals = [...byProvider.values()].sort((a, b) => b - a);
  const total = totals.reduce((sum, value) => sum + value, 0);
  const top = totals.slice(0, Math.max(1, Math.ceil(totals.length * 0.1))).reduce((sum, value) => sum + value, 0);
  return { deaths, providers: totals.length, top10Pct: total ? (top / total) * 100 : 0 };
}

/** Podsumowanie hospitalizacji: lata, miesiące, sekcje, rodziny, zgony i świadczeniodawcy. `datasets`: pliki roku, od najstarszego. */
export function buildHospitalizationSummary(trends: TrendsDataset, datasets: StaticDataset[], map: RegionsMap | null): HospitalizationSummary {
  const home = buildHomeStats(trends, datasets.at(-1)!, map, 10);
  const years = trends.years;
  const yearIndex = new Map(years.map((year, i) => [year, i]));
  const deaths = years.map(() => 0);
  const monthly = years.map(() => Array<number>(12).fill(0));
  const sections = new Map<string, number[]>();
  const groups = new Map<string, number[]>();
  for (const [year, month, product, , , hMin, , dMin] of trends.monthly) {
    const i = yearIndex.get(year);
    if (i === undefined) continue;
    deaths[i] += dMin;
    monthly[i][month - 1] += hMin;
    const code = trends.products[product]?.[1];
    if (!code) continue;
    const letter = code[0];
    if (JGP_SECTION_LABELS[letter]) {
      const series = sections.get(letter) ?? years.map(() => 0);
      series[i] += hMin;
      sections.set(letter, series);
    }
    const series = groups.get(code) ?? years.map(() => 0);
    series[i] += hMin;
    groups.set(code, series);
  }

  const datasetByYear = new Map(datasets.map((dataset) => [dataset.analysisYear, dataset]));
  const summaryYears = home.years.map((y, i): SummaryYear => {
    const dataset = datasetByYear.get(y.year);
    const metrics = dataset ? yearMetrics(dataset, deaths[i]) : { deaths: deaths[i], providers: 0, top10Pct: 0 };
    return { year: y.year, hospitalizations: y.hospitalizations, mortalityPct: y.hospitalizations ? (deaths[i] / y.hospitalizations) * 100 : 0, ...metrics };
  });

  const last = years.length - 1;
  const latestTotal = home.years.at(-1)?.hospitalizations ?? 0;
  const sectionRows = [...sections.entries()]
    .map(([letter, series]): SummarySection => ({
      letter,
      label: JGP_SECTION_LABELS[letter],
      series,
      changePct: change(series[0], series[last]),
      sharePct: latestTotal ? (series[last] / latestTotal) * 100 : 0,
    }))
    .sort((a, b) => b.series[last] - a.series[last]);

  const families = SUMMARY_FAMILIES.map((family): SummaryFamilyRow => {
    const present = family.codes.filter((code) => groups.has(code));
    const series = years.map((_, i) => present.reduce((sum, code) => sum + groups.get(code)![i], 0));
    const mainCode = [...present].sort((a, b) => groups.get(b)![last] - groups.get(a)![last])[0] ?? family.codes[0];
    return { ...family, codes: present, series, changePct: change(series[0], series[last]), mainCode };
  }).sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));

  const months = [years[last - 1], years[last]].filter(Boolean).map((year) => {
    const values = monthly[yearIndex.get(year)!];
    return { year, values: values.map((value) => (value > 0 ? value : null)) };
  });

  return { ...home, firstYear: years[0] ?? "", summaryYears, months, sections: sectionRows, families };
}
