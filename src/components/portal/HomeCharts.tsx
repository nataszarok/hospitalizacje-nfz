import Link from "next/link";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { formatJgpName } from "@/lib/formatters";
import type { HistogramBin, HospitalMapStats, PeerExample } from "@/lib/hospitalHomeStats";
import type { HomeGroup, HomeStats, HomeYear } from "@/lib/homeStats";
import { scaleColor } from "@/lib/jgpCard";
import { PEER_DISTANCE_A_LIMIT } from "@/lib/peerDistance";
import { jgpHref } from "@/lib/portalLinks";
import { HospitalLink } from "@/components/TableLinks";
import styles from "./HomeCharts.module.css";

// Lekkie wykresy SVG strony głównej (bez Plotly): rysowane podczas budowania, bez JavaScriptu w przeglądarce.
// Mapa, tryb przyjęcia i zmiany r/r czekają na kartę podsumowania hospitalizacji (docs/karta-hospitalizacje-podsumowanie.html).
const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millions = (value: number) => `${decimal(value / 1_000_000)} mln`;
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value))}%`;
const shortYear = (year: string) => `’${year.slice(2)}`;

/** Hospitalizacje w latach: słupki, najnowszy rok wyróżniony. */
export function YearBars({ years }: { years: HomeYear[] }) {
  const width = 520;
  const height = 190;
  const top = 26;
  const bottom = 24;
  const max = Math.max(...years.map((y) => y.hospitalizations), 1);
  const step = width / Math.max(years.length, 1);
  const barWidth = Math.min(38, step * 0.62);
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Hospitalizacje w latach: ${years.map((y) => `${y.year} — ${millions(y.hospitalizations)}`).join(", ")}`}>
    <line x1="0" x2={width} y1={height - bottom} y2={height - bottom} className={styles.axis} />
    {years.map((y, i) => {
      const barHeight = ((height - top - bottom) * y.hospitalizations) / max;
      const x = i * step + (step - barWidth) / 2;
      const latest = i === years.length - 1;
      return <g key={y.year}>
        <rect x={x} y={height - bottom - barHeight} width={barWidth} height={barHeight} rx="3" className={latest ? styles.barLatest : styles.bar} />
        <text x={x + barWidth / 2} y={height - bottom - barHeight - 7} className={`${styles.value} ${latest ? styles.valueStrong : ""}`}>{decimal(y.hospitalizations / 1_000_000)}</text>
        <text x={x + barWidth / 2} y={height - 6} className={styles.tick}>{shortYear(y.year)}</text>
      </g>;
    })}
  </svg>;
}

/** Histogram szpitali (np. według liczby łóżek albo marży); przedziały straty na pomarańczowo. */
export function Histogram({ bins, label, unit }: { bins: HistogramBin[]; label: string; unit: string }) {
  const width = 520;
  const height = 190;
  const top = 26;
  const bottom = 24;
  const max = Math.max(...bins.map((bin) => bin.count), 1);
  const step = width / Math.max(bins.length, 1);
  const barWidth = Math.min(54, step * 0.7);
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${bins.map((bin) => `${bin.label}${unit ? ` ${unit}` : ""} — ${bin.count}`).join(", ")}`}>
    <line x1="0" x2={width} y1={height - bottom} y2={height - bottom} className={styles.axis} />
    {bins.map((bin, i) => {
      const barHeight = ((height - top - bottom) * bin.count) / max;
      const x = i * step + (step - barWidth) / 2;
      return <g key={bin.label}>
        <rect x={x} y={height - bottom - barHeight} width={barWidth} height={barHeight} rx="3" className={bin.negative ? styles.barLoss : styles.barLatest} />
        <text x={x + barWidth / 2} y={height - bottom - barHeight - 7} className={styles.value}>{integer(bin.count)}</text>
        <text x={x + barWidth / 2} y={height - 6} className={styles.tick}>{bin.label}</text>
      </g>;
    })}
  </svg>;
}

/** Histogram na osi liczbowej (np. marża netto w %): przylegające słupki równych przedziałów, podziałka co 5. */
export function ContinuousHistogram({ bins, label, unit }: { bins: HistogramBin[]; label: string; unit: string }) {
  const width = 520;
  const height = 200;
  const top = 22;
  const bottom = 26;
  const max = Math.max(...bins.map((bin) => bin.count), 1);
  const step = width / Math.max(bins.length, 1);
  const base = height - bottom;
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${bins.map((bin) => `${bin.label} ${unit} — ${bin.count}`).join(", ")}`}>
    {bins.map((bin, i) => {
      const barHeight = ((base - top) * bin.count) / max;
      return <g key={bin.label}>
        <title>{`${bin.label} ${unit}: ${integer(bin.count)}`}</title>
        <rect x={i * step + 0.5} y={base - barHeight} width={step - 1} height={barHeight} className={bin.negative ? styles.barLoss : styles.barLatest} />
        {bin.count ? <text x={i * step + step / 2} y={base - barHeight - 6} className={styles.valueSmall}>{integer(bin.count)}</text> : null}
      </g>;
    })}
    <line x1="0" x2={width} y1={base} y2={base} className={styles.axis} />
    {bins.map((bin, i) => bin.from !== undefined && bin.from % 5 === 0
      ? <g key={`tick-${bin.label}`}>
        <line x1={i * step} x2={i * step} y1={base} y2={base + 5} className={bin.from === 0 ? styles.axisZero : styles.axis} />
        <text x={i * step} y={height - 6} className={styles.tick}>{bin.from.toLocaleString("pl-PL").replace("-", "−")}</text>
      </g>
      : null)}
  </svg>;
}

/** Podobne szpitale: dystans od wybranego szpitala na skali 0–granica klasy A; wiersz prowadzi do karty szpitala (bez karty — bez linku). */
export function PeerDistances({ example }: { example: PeerExample }) {
  return <ol className={styles.peerList} aria-label={`Najbardziej podobne szpitale: ${example.name}`}>
    {example.peers.map((peer) => {
      const [ow, nip] = peer.key.split("|");
      return <li key={peer.key}>
        <HospitalLink owNfz={ow} nip={nip} className={styles.peerRow} title={`${peer.name} (${peer.city}): dystans ${decimal(peer.distance)}`}>
          <span className={styles.peerName}><span>{peer.name}</span><small>{peer.city}</small></span>
          <span className={styles.peerTrack} aria-hidden="true"><span className={styles.peerDot} style={{ left: `${Math.min(peer.distance / PEER_DISTANCE_A_LIMIT, 1) * 100}%` }} /></span>
          <span className={styles.peerValue}>{decimal(peer.distance)}</span>
        </HospitalLink>
      </li>;
    })}
  </ol>;
}

/** Udział trybów przyjęcia w latach: słupki 100% (nagłe, planowe, pozostałe). */
export function AdmissionBars({ years }: { years: HomeYear[] }) {
  const width = 520;
  const height = 190;
  const top = 8;
  const bottom = 24;
  const step = width / Math.max(years.length, 1);
  const barWidth = Math.min(38, step * 0.62);
  const scale = (pct: number) => ((height - top - bottom) * pct) / 100;
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Przyjęcia nagłe w latach: ${years.map((y) => `${y.year} — ${Math.round(y.urgentPct)}%`).join(", ")}`}>
    {years.map((y, i) => {
      const x = i * step + (step - barWidth) / 2;
      const urgent = scale(y.urgentPct);
      const planned = scale(y.plannedPct);
      const other = scale(y.otherPct);
      const base = height - bottom;
      return <g key={y.year}>
        <rect x={x} y={base - urgent} width={barWidth} height={urgent} className={styles.urgent} />
        <rect x={x} y={base - urgent - planned} width={barWidth} height={planned} className={styles.planned} />
        <rect x={x} y={base - urgent - planned - other} width={barWidth} height={other} className={styles.other} />
        <text x={x + barWidth / 2} y={base - urgent / 2} className={styles.inBar}>{Math.round(y.urgentPct)}</text>
        <text x={x + barWidth / 2} y={height - 6} className={styles.tick}>{shortYear(y.year)}</text>
      </g>;
    })}
  </svg>;
}

/** Ranking grup: poziome słupki, każdy wiersz prowadzi do karty grupy. */
export function GroupBars({ groups }: { groups: HomeGroup[] }) {
  const max = Math.max(...groups.map((g) => g.latest), 1);
  return <ol className={styles.groupList}>
    {groups.map((group) => <li key={group.code}>
      <Link href={jgpHref(group.code)!} className={styles.groupRow} title={`${group.code} ${formatJgpName(group.name)}`}>
        <span className={styles.groupLabel}><b>{group.code}</b> {formatJgpName(group.name)}</span>
        <span className={styles.groupTrack} aria-hidden="true"><span className={styles.groupBar} style={{ width: `${(group.latest / max) * 100}%` }} /></span>
        <span className={styles.groupValue}>{integer(group.latest)}</span>
      </Link>
    </li>)}
  </ol>;
}

/** Grupy z największą zmianą r/r: wzrosty i spadki, z linkami do kart. */
export function ChangeList({ title, groups, direction }: { title: string; groups: HomeGroup[]; direction: "up" | "down" }) {
  return <div className={styles.changeColumn}>
    <h4 className={direction === "up" ? styles.changeUp : styles.changeDown}>{title}</h4>
    <ul className={styles.changeList}>
      {groups.map((group) => <li key={group.code}>
        <Link href={jgpHref(group.code)!} className={styles.changeRow} title={`${group.code} ${formatJgpName(group.name)}: ${integer(group.previous)} → ${integer(group.latest)}`}>
          <span className={styles.changeCode}>{group.code}</span>
          <span className={styles.changeName}>{formatJgpName(group.name)}</span>
          <span className={direction === "up" ? styles.changeUp : styles.changeDown}>{signedPct(group.changePct ?? 0)}</span>
        </Link>
      </li>)}
    </ul>
  </div>;
}

/** Odchylenie od średniej Polski w % (±15% i więcej = koniec skali koloru). */
const MAP_LIMIT_PCT = 15;

/** Mapa województw: hospitalizacje na 100 tys. mieszkańców wobec średniej Polski; województwo prowadzi do widoku „Gdzie”. */
export function RegionsMiniMap({ regions }: { regions: NonNullable<HomeStats["regions"]> }) {
  const [width, height] = regions.map.viewBox;
  const cells = new Map(regions.cells.map((cell) => [cell.owNfz, cell]));
  const shapes = regions.map.regions.flatMap(([code, , path, label]) => {
    const cell = cells.get(code);
    if (!cell) return [];
    const deviation = (cell.ratio - 1) * 100;
    const position = Math.max(-1, Math.min(1, deviation / MAP_LIMIT_PCT));
    return [{ code, path, label, cell, deviation, position }];
  });
  return <svg className={styles.map} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Mapa województw: hospitalizacje na 100 tys. mieszkańców wobec średniej Polski">
    {shapes.map(({ code, path, cell, deviation, position }) => {
      const title = `${cell.name}: ${integer(cell.per100k)} na 100 tys. (${signedPct(deviation)} wobec średniej Polski)`;
      return <a key={code} href={`${DASHBOARD_HREFS.regions}&ow=${encodeURIComponent(code)}`} aria-label={title} className={styles.mapLink}>
        <title>{title}</title>
        <path d={path} fill={scaleColor(position)} className={styles.mapShape} />
      </a>;
    })}
    {shapes.map(({ code, label, deviation, position }) => <text key={`label-${code}`} x={label[0]} y={label[1]} className={`${styles.mapLabel} ${position < 0.35 ? styles.mapLabelDark : ""}`} aria-hidden="true">{signedPct(deviation)}</text>)}
  </svg>;
}

/** Legenda mapy: skala od −15% do +15% wobec średniej. */
export function MapLegend() {
  return <div className={styles.mapLegend} aria-hidden="true">
    <span>−{MAP_LIMIT_PCT}%</span>
    <span className={styles.mapScale} style={{ background: `linear-gradient(90deg, ${scaleColor(-1)}, ${scaleColor(0)}, ${scaleColor(1)})` }} />
    <span>+{MAP_LIMIT_PCT}%</span>
  </div>;
}

/**
 * Mapa szpitali: kontury województw i kropka na szpital (jak mapa katalogu `/szpitale`). Obraz statyczny: bez dymków,
 * kliknięć i fokusu; liczby są w `aria-label` i w opisie karty. Kolor: sieć PSZ — błękit danych, poza siecią — jasny błękit.
 */
export function HospitalMap({ map }: { map: HospitalMapStats }) {
  const [width, height] = map.viewBox;
  return <svg className={styles.hospitalMap} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Mapa szpitali z hospitalizacjami w ${map.year} r.: ${integer(map.hospitals)} szpitali, w tym ${integer(map.inPsz)} w sieci szpitali (PSZ)`}>
    {map.regions.map((path, i) => <path key={i} d={path} className={styles.hospitalMapRegion} />)}
    {map.dots.map(([x, y, r, psz], i) => <circle key={i} cx={x} cy={y} r={r} className={psz ? styles.hospitalDotPsz : styles.hospitalDot} />)}
  </svg>;
}
