import { cellColor, darkLabel, type CartogramCell, type RegionsMap } from "@/lib/jgpCard";
import styles from "./JgpPage.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const decimal = (value: number) => value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Mapa województw z prawdziwymi granicami (SVG). Kliknięcie albo Enter zaznacza województwo. */
export function RegionMap({ map, cells, regions, onToggle, colors }: { map: RegionsMap; cells: CartogramCell[]; regions: string[]; onToggle: (ow: string) => void; colors: string[] }) {
  const byCode = new Map(cells.map((cell) => [cell.owNfz, cell]));
  const [width, height] = map.viewBox;
  const shapes = map.regions.flatMap(([code, , path, label]) => {
    const cell = byCode.get(code);
    return cell ? [{ code, path, label, cell }] : [];
  });
  return <svg className={styles.regionMap} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Mapa województw: hospitalizacje na 100 tys. mieszkańców">
    {shapes.map(({ code, path, cell }) => <path
      key={code}
      d={path}
      className={styles.regionShape}
      fill={cellColor(cell)}
      role="button"
      tabIndex={0}
      aria-pressed={regions.includes(code)}
      aria-label={regionTitle(cell)}
      onClick={() => onToggle(code)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(code); } }}
    ><title>{regionTitle(cell)}</title></path>)}
    {/* Obwódki zaznaczonych województw w kolorach linii wykresu, nad pozostałymi granicami. */}
    {regions.map((code, i) => {
      const shape = shapes.find((item) => item.code === code);
      return shape ? <path key={`sel-${code}`} d={shape.path} className={styles.regionSelected} stroke={colors[i % colors.length]} aria-hidden /> : null;
    })}
    {shapes.map(({ code, label, cell }) => <text
      key={`label-${code}`}
      x={label[0]}
      y={label[1]}
      className={`${styles.regionLabel} ${darkLabel(cell) ? styles.regionLabelDark : ""}`}
      aria-hidden
    >{decimal(cell.per100k)}</text>)}
  </svg>;
}

/** Opis województwa: wskaźnik, liczba hospitalizacji i odchylenie od średniej Polski. */
export function regionTitle(cell: CartogramCell) {
  const relation = Math.abs(cell.ratio - 1) < 0.05 ? "blisko średniej Polski" : `${decimal(cell.ratio)} × średniej Polski`;
  return `${cell.name}: ${decimal(cell.per100k)} na 100 tys. (${relation}), ${integer(cell.hospitalizations)} hospitalizacji`;
}
