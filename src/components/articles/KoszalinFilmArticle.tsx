import Link from "next/link";
import { PageHeader } from "@/components/portal/PageHeader";
import { ARTICLES_PATH, findArticle } from "@/lib/articles";
import { ArticleVideo } from "./ArticleVideo";
import { KOSZALIN_FILM_SOURCES, koszalinFilmSourceNumber, type KoszalinFilmSourceId } from "./koszalinFilm";
import styles from "./Article.module.css";

const isExternal = (href: string) => href.startsWith("http");

export const KOSZALIN_FILM_SLUG = "film-koszalin-h52-h53";

/** Odsyłacz do przypisu: numer w indeksie górnym, link do listy przypisów. */
function Ref({ ids }: { ids: readonly KoszalinFilmSourceId[] }) {
  return <sup className={styles.ref}>
    {ids.map((id, i) => {
      const n = koszalinFilmSourceNumber(id);
      return <span key={id}>{i > 0 ? "," : null}<a href={`#przypis-${n}`} aria-label={`Przypis ${n}`}>{n}</a></span>;
    })}
  </sup>;
}

/**
 * Artykuł z filmem: hospitalizacje H52 i H53 w Szpitalu Wojewódzkim w Koszalinie i dwie kontrole NFZ.
 * Wstęp (3 zdania z przypisami), film i przypisy. Plik filmu i kadr: wpis artykułu w `ARTICLES` (to samo bierze podgląd linku).
 */
export function KoszalinFilmArticle() {
  const video = findArticle(KOSZALIN_FILM_SLUG).video!;
  return <main>
    <PageHeader
      eyebrow={<><Link href={ARTICLES_PATH}>Artykuły</Link> · Film</>}
      title="Koszalin: H52 i H53 miesiąc po miesiącu"
      lead={<p>
        Szpital Wojewódzki w Koszalinie przez kilka lat rozliczał najwięcej hospitalizacji H52 w Polsce: zabiegów kręgosłupa z implantem,
        zwykle z wypisem w ciągu doby.<Ref ids={["jgp", "pobyty"]} /> Po pierwszej kontroli NFZ w 2024 r. liczba H52 spadła w jeden miesiąc
        ze 109 do 19, a liczba tańszych hospitalizacji H53 wzrosła z 9 do 79.<Ref ids={["jgp", "kontrole"]} /> Film pokazuje te zmiany
        miesiąc po miesiącu i okresy, które sprawdziły dwie kontrole NFZ.<Ref ids={["kontrole", "pytania"]} />
      </p>}
    />

    <div className={`${styles.layout} ${styles.noToc}`}>
      <article className={styles.article}>
        <section id="film" aria-label="Film">
          <ArticleVideo
            title="H52 i H53 w Koszalinie: film"
            src={video.src}
            poster={video.poster}
            ariaLabel="Film z napisami: hospitalizacje H52 i H53 w Szpitalu Wojewódzkim w Koszalinie miesiąc po miesiącu i dwie kontrole NFZ."
          />
        </section>

        <footer id="przypisy" className={styles.sources} aria-labelledby="przypisy-h">
          <h2 id="przypisy-h">Przypisy i źródła</h2>
          <ol className={styles.footnotes}>
            {KOSZALIN_FILM_SOURCES.map((source, i) => <li key={source.id} id={`przypis-${i + 1}`}>
              {"href" in source
                ? isExternal(source.href)
                  ? <a href={source.href} target="_blank" rel="noreferrer">{source.title}</a>
                  : <Link href={source.href}>{source.title}</Link>
                : source.title}
              . <span>Potwierdza: {source.note}.</span>
            </li>)}
          </ol>
        </footer>
      </article>
    </div>
  </main>;
}
