import type { ReactNode } from "react";
import styles from "./ArticleFigure.module.css";

/**
 * Film w tekście artykułu: tytuł nad filmem, odtwarzacz przeglądarki, podpis ze źródłem pod nim (jak wykres, `ArticleFigure.module.css`).
 * Bez autoodtwarzania; `preload="metadata"` pobiera tylko długość i pierwszą klatkę, nie cały plik.
 */
export function ArticleVideo({ title, src, poster, caption, ariaLabel }: {
  title: string;
  /** Ścieżka pliku w `public/`, np. `/video/<plik>.mp4`. */
  src: string;
  /** Kadr widoczny przed odtworzeniem (JPG w `public/`). */
  poster?: string;
  caption?: ReactNode;
  /** Opis filmu dla czytnika ekranu. */
  ariaLabel: string;
}) {
  return <figure className={styles.figure} aria-label={title}>
    <div className={styles.head}><span className={styles.title}>{title}</span></div>
    <video className={styles.video} src={src} poster={poster} controls preload="metadata" playsInline aria-label={ariaLabel}>
      <a href={src}>Pobierz film (MP4)</a>
    </video>
    {caption ? <p className={styles.note}>{caption}</p> : null}
  </figure>;
}
