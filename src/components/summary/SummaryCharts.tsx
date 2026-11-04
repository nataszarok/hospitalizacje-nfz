import Link from "next/link";
import { formatJgpName, formatPln, shortenName } from "@/lib/formatters";
import { STAY_BUCKETS, type SummaryStayYear, type SummarySection, type SummaryTrendRow, type SummaryValueRow } from "@/lib/hospitalizationSummary";
import { jgpHref } from "@/lib/portalLinks";
import styles from "./SummaryCharts.module.css";

// Lekkie wykresy SVG karty „Hospitalizacje w Polsce”: rysowane podczas budowania, bez JavaScriptu w przeglądarce.
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export { formatPln };
const signedPct = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}%`;
const shortYear = (year: string) => `’${year.slice(2)}`;
const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/**
 * Słupki wartości w latach z dowolnym formatem (np. odsetek zgonów, liczba świadczeniodawców); ostatni rok wyróżniony.
 * `notes`: dopisek pod rokiem (np. zmiana r/r); pusty tekst = bez dopisku.
 */
export function ValueBars({ years, values, format, label, notes }: { years: string[]; values: number[]; format: (value: number) => string; label: string; notes?: string[] }) {
  const width = 520;
  const top = 26;
  const bottom = notes ? 40 : 24;
  const height = 166 + bottom;
  const max = Math.max(...values, 0) || 1;
  const step = width / Math.max(values.length, 1);
  const barWidth = Math.min(38, step * 0.62);
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${years.map((year, i) => `${year} — ${format(values[i])}${notes?.[i] ? ` (${notes[i]})` : ""}`).join(", ")}`}>
    <line x1="0" x2={width} y1={height - bottom} y2={height - bottom} className={styles.axis} />
    {values.map((value, i) => {
      const barHeight = ((height - top - bottom) * value) / max;
      const x = i * step + (step - barWidth) / 2;
      const latest = i === values.length - 1;
      return <g key={years[i]}>
        <rect x={x} y={height - bottom - barHeight} width={barWidth} height={barHeight} rx="3" className={latest ? styles.barLatest : styles.bar} />
        <text x={x + barWidth / 2} y={height - bottom - barHeight - 7} className={`${styles.value} ${latest ? styles.valueStrong : ""}`}>{format(value)}</text>
        <text x={x + barWidth / 2} y={height - bottom + 18} className={styles.tick}>{shortYear(years[i])}</text>
        {notes?.[i] ? <text x={x + barWidth / 2} y={height - 4} className={`${styles.note} ${notes[i].startsWith("−") ? styles.noteDown : styles.noteUp}`}>{notes[i]}</text> : null}
      </g>;
    })}
  </svg>;
}

/** Klasa linii roku: ostatni rok wyróżniony, pierwszy (gdy są trzy lata i więcej) przerywany, pozostałe jasne. */
const monthLineClass = (i: number, count: number) => (i === count - 1 ? styles.lineLatest : i === 0 && count > 2 ? styles.lineFirst : styles.linePrevious);

/** Hospitalizacje w miesiącach: ostatni rok na tle poprzedniego i pierwszego. Miesiące bez danych są pomijane. */
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
    {months.map((m, i) => <polyline key={m.year} points={path(m.values)} className={monthLineClass(i, months.length)} />)}
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

/** Zmiana wieloletnia: rodzina albo grupa JGP, mini-wykres lat i zmiana od pierwszego roku; wiersz prowadzi do karty (głównej) grupy. */
export function TrendRows({ rows, firstYear, latestYear, label }: { rows: SummaryTrendRow[]; firstYear: string; latestYear: string; label: string }) {
  return <ol className={styles.rows} aria-label={label}>
    {rows.map((row) => {
      const name = row.family ? row.name : formatJgpName(row.name);
      const range = `${integer(row.series[0])} → ${integer(row.series.at(-1) ?? 0)}`;
      return <li key={row.id}>
        <Link href={jgpHref(row.mainCode)!} className={`${styles.familyRow} ${styles.trendRow}`} title={`${name}: ${integer(row.series[0])} (${firstYear}) → ${integer(row.series.at(-1) ?? 0)} (${latestYear}). Grupy: ${row.codes.join(", ")}`}>
          <span className={styles.familyName}><span className={styles.clamp}>{name}</span><small>{row.family ? `Rodzina: ${row.codes.join(", ")}` : row.codes[0]} · {range}</small></span>
          <Sparkline series={row.series} />
          <span className={(row.changePct ?? 0) >= 0 ? styles.up : styles.down}>{signedPct(row.changePct)}</span>
        </Link>
      </li>;
    })}
  </ol>;
}

/** Kolory linii przedziałów długości pobytu: od najkrótszego (jasny) do najdłuższego (ciemny). */
export const STAY_COLORS = ["#6C93D6", "#5B7FC4", "#2856A3", "#132C57"];

/** Udział przedziałów długości pobytu w hospitalizacjach roku (%): linia na przedział z podpisem na końcu. `buckets`: indeksy przedziałów do pokazania. */
export function StayShares({ stays, buckets = STAY_BUCKETS.map((_, i) => i) }: { stays: SummaryStayYear[]; buckets?: number[] }) {
  const width = 520;
  const height = 220;
  const left = 34;
  const right = 52;
  const top = 12;
  const bottom = 26;
  const shares = buckets.map((b) => stays.map((y) => {
    const total = y.buckets.reduce((sum, value) => sum + value, 0);
    return total ? (y.buckets[b] / total) * 100 : 0;
  }));
  const max = Math.max(10, Math.ceil(Math.max(...shares.flat(), 0) / 10) * 10);
  const step = (width - left - right) / Math.max(stays.length - 1, 1);
  const x = (i: number) => left + i * step;
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  const ticks = Array.from({ length: max / 10 + 1 }, (_, i) => i * 10);
  // Podpisy końcowe rozsuwamy, gdy linie kończą się blisko siebie.
  const ends = shares.map((series, i) => ({ b: i, y: y(series.at(-1) ?? 0) })).sort((p, q) => p.y - q.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 13);
  const endY = new Map(ends.map((end) => [end.b, end.y]));
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Udział hospitalizacji według długości pobytu (%): ${buckets.map((bucket, b) => `${STAY_BUCKETS[bucket]}: ${stays.map((s, i) => `${s.year} ${decimal(shares[b][i])}%`).join(", ")}`).join("; ")}`}>
    {ticks.map((tick) => <g key={tick}>
      <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? styles.axis : styles.grid} />
      <text x="0" y={y(tick) + 4} className={styles.tickStart}>{tick}%</text>
    </g>)}
    {shares.map((series, i) => {
      const color = STAY_COLORS[buckets[i]];
      return <g key={STAY_BUCKETS[buckets[i]]}>
        <polyline points={series.map((value, j) => `${x(j)},${y(value)}`).join(" ")} fill="none" stroke={color} strokeWidth={3.5} />
        {series.map((value, j) => <circle key={j} cx={x(j)} cy={y(value)} r={j === series.length - 1 ? 4 : 2.5} fill={color} />)}
        <text x={width - right + 8} y={endY.get(i)! + 4} className={styles.endLabel} fill={color}>{Math.round(series.at(-1) ?? 0)}%</text>
      </g>;
    })}
    {stays.map((s, i) => <text key={s.year} x={x(i)} y={height - 6} className={styles.tick}>{shortYear(s.year)}</text>)}
  </svg>;
}

/**
 * Kwoty NFZ: wiersze od największej kwoty z paskiem względem największej i zmianą od `firstYear`.
 * Sekcje (bez linków) mają układ listy obszarów leczenia, grupy (z linkami) — listy najczęstszych grup.
 */
export function ValueRows({ rows, label, firstYear, linkGroups = false }: { rows: SummaryValueRow[]; label: string; firstYear: string; linkGroups?: boolean }) {
  const max = Math.max(...rows.map((row) => row.valuePln), 1);
  const bar = (row: SummaryValueRow) => <span className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${(row.valuePln / max) * 100}%` }} /></span>;
  const change = (row: SummaryValueRow) => <span className={(row.changePct ?? 0) >= 0 ? styles.up : styles.down} title={row.changePct === null ? `Brak kwot w ${firstYear} r.` : `Zmiana od ${firstYear} r.`}>{signedPct(row.changePct)}</span>;
  if (linkGroups) {
    return <ol className={styles.rows} aria-label={label}>
      {rows.map((row) => <li key={row.code}>
        <Link href={jgpHref(row.code)!} className={styles.valueGroupRow} title={`${row.code} ${formatJgpName(row.label)}: ${formatPln(row.valuePln)}${row.perStayPln === null ? "" : `, ${integer(row.perStayPln)} zł na hospitalizację`}`}>
          <span className={styles.valueGroupLabel}><b>{row.code}</b> {shortenName(formatJgpName(row.label))}</span>
          {bar(row)}
          <span className={styles.valueAmount}>{formatPln(row.valuePln)}</span>
          {change(row)}
        </Link>
      </li>)}
    </ol>;
  }
  return <ol className={styles.rows} aria-label={label}>
    <li className={`${styles.sectionRow} ${styles.valueSectionRow} ${styles.headRow}`} aria-hidden="true"><span /><span>Obszar leczenia</span><span>Kwota</span><span>od {firstYear}</span></li>
    {rows.map((row) => <li key={row.code} className={`${styles.sectionRow} ${styles.valueSectionRow}`} title={row.perStayPln === null ? undefined : `${integer(row.perStayPln)} zł na hospitalizację`}>
      <span className={styles.letter}>{row.code}</span>
      <span className={styles.label}>{row.label}</span>
      <span className={styles.share}>{bar(row)}{formatPln(row.valuePln)}</span>
      {change(row)}
    </li>)}
  </ol>;
}
