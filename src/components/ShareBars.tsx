import base from "@/components/jgp/JgpPage.module.css";
import styles from "@/components/jgp/JgpTabs.module.css";
import own from "./ShareBars.module.css";

const pct = (value: number) => `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * Część słupka 100%: nazwa, wartość i klasa koloru (np. `base.segmentUrgent`). `short`: podpis w odcinku (np. litera sekcji JGP);
 * `dark`: odcinek w ciemnym kolorze (biały podpis).
 */
export interface SharePart { key: string; label: string; value: number; className: string; short?: string; dark?: boolean }

/** Najmniejszy udział (%), przy którym odcinek ma podpis (skrót); udziały są w podpowiedzi. */
export const MIN_LABEL_SHARE = 6;
/** Wiersz: etykieta (np. rok), części i czy wiersz jest wybrany (rok karty). */
export interface ShareRow { key: string; label: string; parts: SharePart[]; on?: boolean }

/** Legenda części słupków (kolor + nazwa); klasy kolorów jak w słupkach. */
export function ShareLegend({ parts }: { parts: Pick<SharePart, "key" | "label" | "className">[] }) {
  return <ul className={base.legend} aria-label="Legenda">
    {parts.map((part) => <li key={part.key}><span className={`${base.swatch} ${part.className}`} aria-hidden />{part.label}</li>)}
  </ul>;
}

/**
 * Słupki 100% w wierszach (np. tryb przyjęcia albo długość pobytu w latach). Same słupki; udziały w podpowiedzi
 * po najechaniu albo fokusie klawiatury (Tab). Wybrany wiersz ma tło jak wybrany rok na wykresach.
 */
export function ShareBars({ rows, ariaLabel, labels = false }: { rows: ShareRow[]; ariaLabel: string; labels?: boolean }) {
  return <ul className={styles.admRows} aria-label={ariaLabel}>
    {rows.map((row) => {
      const total = row.parts.reduce((sum, part) => sum + part.value, 0);
      const share = (value: number) => total ? (value / total) * 100 : 0;
      const label = `${row.label}: ${row.parts.map((part) => `${part.label} ${pct(share(part.value))}`).join(", ")}`;
      return <li key={row.key} className={`${styles.admRow} ${row.on ? styles.admRowOn : ""}`} tabIndex={0} aria-label={label}>
        <span className={styles.admYear} aria-hidden>{row.label}</span>
        <span className={`${styles.admBar} ${labels ? own.tall : ""}`} aria-hidden>
          {row.parts.map((part) => {
            if (!part.value) return null;
            const value = share(part.value);
            const text = labels && value >= MIN_LABEL_SHARE ? part.short ?? null : null;
            return <span key={part.key} className={`${base.segment} ${part.className} ${labels ? own.label : ""} ${part.dark ? own.onDark : ""}`} style={{ width: `${value}%` }}>{text}</span>;
          })}
        </span>
        <span className={styles.admTip} role="tooltip" aria-hidden>
          <b>{row.label}</b>
          {row.parts.map((part) => <span key={part.key}><i className={part.className} />{part.label} {pct(share(part.value))}</span>)}
        </span>
      </li>;
    })}
  </ul>;
}
