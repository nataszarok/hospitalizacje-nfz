import Link from "next/link";
import type { SummaryFamilyRow, SummarySection } from "@/lib/hospitalizationSummary";
import { jgpHref } from "@/lib/portalLinks";
import styles from "./SummaryCharts.module.css";

// Lekkie wykresy SVG karty „Hospitalizacje w Polsce”: rysowane podczas budowania, bez JavaScriptu w przeglądarce.
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const signedPct = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}%`;
const shortYear = (year: string) => `’${year.slice(2)}`;
const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** Słupki wartości w latach z dowolnym formatem (np. odsetek zgonów, liczba świadczeniodawców); ostatni rok wyróżniony. */
export function ValueBars({ years, values, format, label }: { years: string[]; values: number[]; format: (value: number) => string; label: string }) {
  const width = 520;
  const height = 190;
  const top = 26;
  const bottom = 24;
  const max = Math.max(...values, 0) || 1;
  const step = width / Math.max(values.length, 1);
  const barWidth = Math.min(38, step * 0.62);
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${years.map((year, i) => `${year} — ${format(values[i])}`).join(", ")}`}>
    <line x1="0" x2={width} y1={height - bottom} y2={height - bottom} className={styles.axis} />
    {values.map((value, i) => {
      const barHeight = ((height - top - bottom) * value) / max;
      const x = i * step + (step - barWidth) / 2;
      const latest = i === values.length - 1;
      return <g key={years[i]}>
        <rect x={x} y={height - bottom - barHeight} width={barWidth} height={barHeight} rx="3" className={latest ? styles.barLatest : styles.bar} />
        <text x={x + barWidth / 2} y={height - bottom - barHeight - 7} className={`${styles.value} ${latest ? styles.valueStrong : ""}`}>{format(value)}</text>
        <text x={x + barWidth / 2} y={height - 6} className={styles.tick}>{shortYear(years[i])}</text>
      </g>;
    })}
  </svg>;
}

/** Hospitalizacje w miesiącach: ostatni rok na tle poprzedniego. Miesiące bez danych są pomijane. */
export function MonthLines({ months }: { months: { year: string; values: (number | null)[] }[] }) {
  const width = 520;
  const height = 210;
  const left = 34;
  const top = 12;
  const bottom = 26;
  // Oś od zaokrąglonego minimum (linie, nie słupki): różnice między miesiącami są czytelne.
  const values = months.flatMap((m) => m.values.filter((v): v is number => v !== null));
  const unit = 50_000;
  const min = values.length ? Math.floor(Math.min(...values) / unit) * unit : 0;
  const max = Math.max(Math.ceil(Math.max(...values, 1) / unit) * unit, min + unit);
  const step = (width - left - 10) / 11;
  const x = (i: number) => left + i * step;
  const y = (value: number) => top + (height - top - bottom) * (1 - (value - min) / (max - min));
  const path = (series: (number | null)[]) => series.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");
  const ticks = [min, (min + max) / 2, max];
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Hospitalizacje w miesiącach: ${months.map((m) => `${m.year}: ${m.values.map((v, i) => `${MONTHS[i]} ${v === null ? "brak" : integer(v)}`).join(", ")}`).join("; ")}`}>
    {ticks.map((tick) => <g key={tick}>
      <line x1={left} x2={width} y1={y(tick)} y2={y(tick)} className={tick === min ? styles.axis : styles.grid} />
      <text x="0" y={y(tick) - 4} className={styles.tickStart}>{`${Math.round(tick / 1000)} tys.`}</text>
    </g>)}
    {months.map((m, i) => <polyline key={m.year} points={path(m.values)} className={i === months.length - 1 ? styles.lineLatest : styles.linePrevious} />)}
    {months.at(-1)?.values.map((v, i) => v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="3.5" className={styles.dotLatest} />)}
    {MONTHS.map((month, i) => <text key={month} x={x(i)} y={height - 6} className={styles.tick}>{month}</text>)}
  </svg>;
}

/** Sekcje katalogu JGP: udział w ostatnim roku i zmiana od pierwszego roku. */
export function SectionChanges({ sections, firstYear, latestYear }: { sections: SummarySection[]; firstYear: string; latestYear: string }) {
  const maxShare = Math.max(...sections.map((s) => s.sharePct), 1);
  return <ol className={styles.rows} aria-label={`Sekcje katalogu JGP: udział w ${latestYear} r. i zmiana od ${firstYear} r.`}>
    <li className={`${styles.sectionRow} ${styles.headRow}`} aria-hidden="true"><span /><span>Obszar leczenia</span><span>Udział {latestYear}</span><span>{firstYear}→{latestYear}</span></li>
    {sections.map((section) => <li key={section.letter} className={styles.sectionRow}>
      <span className={styles.letter}>{section.letter}</span>
      <span className={styles.label}>{section.label}</span>
      <span className={styles.share}><span className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${(section.sharePct / maxShare) * 100}%` }} /></span>{section.sharePct.toLocaleString("pl-PL", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%</span>
      <span className={(section.changePct ?? 0) >= 0 ? styles.up : styles.down}>{signedPct(section.changePct)}</span>
    </li>)}
  </ol>;
}

function Sparkline({ series }: { series: number[] }) {
  const max = Math.max(...series, 1);
  const step = 120 / series.length;
  return <svg className={styles.spark} viewBox="0 0 120 34" aria-hidden="true">
    {series.map((value, i) => <rect key={i} x={i * step + 1} y={34 - (30 * value) / max} width={step - 2} height={(30 * value) / max} rx="1.5" />)}
  </svg>;
}

/** Rodziny grup JGP: zmiana od pierwszego roku i mini-wykres lat; wiersz prowadzi do karty głównej grupy rodziny. */
export function FamilyRows({ families, firstYear, latestYear }: { families: SummaryFamilyRow[]; firstYear: string; latestYear: string }) {
  return <ul className={styles.rows}>
    {families.map((family) => <li key={family.id}>
      <Link href={jgpHref(family.mainCode)!} className={styles.familyRow} title={`${family.name}: ${integer(family.series[0])} (${firstYear}) → ${integer(family.series.at(-1) ?? 0)} (${latestYear}). Grupy: ${family.codes.join(", ")}`}>
        <span className={styles.familyName}>{family.name}<small>{family.codes.join(", ")} · {integer(family.series[0])} → {integer(family.series.at(-1) ?? 0)}</small></span>
        <Sparkline series={family.series} />
        <span className={(family.changePct ?? 0) >= 0 ? styles.up : styles.down}>{signedPct(family.changePct)}</span>
      </Link>
    </li>)}
  </ul>;
}

