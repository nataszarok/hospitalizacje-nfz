import Link from "next/link";
import { PageHeader } from "@/components/portal/PageHeader";
import { ARTICLES_PATH } from "@/lib/articles";
import { REGION_PICK_COLORS } from "@/lib/chartPalette";
import { findControl } from "@/lib/h55Controls";
import type { ProviderGroupsSeries } from "@/lib/spineQuestions";
import { ArticleLineChart } from "./ArticleLineChart";
import { ArticleToc } from "./ArticleToc";
import {
  SPINE_QUESTION_COUNT, SPINE_QUESTION_SECTIONS, SPINE_QUESTION_SOURCES, spineSourceNumber, type SpineQuestionSourceId,
} from "./spineQuestions";
import styles from "./Article.module.css";

const isExternal = (href: string) => href.startsWith("http");

/** „24 pytania”, „25 pytań”, „1 pytanie”. */
export function questionsText(n: number): string {
  const word = n === 1 ? "pytanie" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "pytania" : "pytań";
  return `${n} ${word}`;
}

const TOC = [
  ...SPINE_QUESTION_SECTIONS.map((section) => ({ id: section.id, label: section.title })),
  { id: "przypisy", label: "Przypisy i źródła" },
];

/** Odsyłacz do przypisu: numer w indeksie górnym, link do listy przypisów. */
function Ref({ ids }: { ids: SpineQuestionSourceId[] }) {
  return <sup className={styles.ref}>
    {ids.map((id, i) => {
      const n = spineSourceNumber(id);
      return <span key={id}>{i > 0 ? "," : null}<a href={`#przypis-${n}`} aria-label={`Przypis ${n}`}>{n}</a></span>;
    })}
  </sup>;
}

/** Okres H52 objęty drugą kontrolą w Koszalinie (opis zakresu kontroli DK.TWK-X.4840.026.2025). */
const SECOND_CONTROL_H52 = { from: "2023-01", to: "2023-08" };

const sumYear = (values: number[], months: string[], year: string) => values.reduce((total, value, i) => total + (months[i].startsWith(year) ? value : 0), 0);

/** Okres pracy kontrolerów w szpitalu: żółte pasmo, wyraźniejsze niż pasmo okresu objętego kontrolą. */
const CONTROL_COLOR = "#F2C200";
const CONTROL_OPACITY = 0.35;

/**
 * Wykres: hospitalizacje H52 i H53 w Szpitalu Wojewódzkim w Koszalinie, miesiąc po miesiącu.
 * Żółte pasma: okresy pracy kontrolerów (od początku do końca każdej kontroli), z podpisem przy początku.
 * Pasmo w kolorze H52: okres H52 objęty drugą kontrolą.
 */
function KoszalinChart({ series }: { series: ProviderGroupsSeries }) {
  const { months, groups } = series;
  const h52 = groups.H52 ?? [];
  const h53 = groups.H53 ?? [];
  const controls = [findControl("Koszalin"), findControl("Koszalin (2. kontrola)")];
  const peakYear = ["2022", "2025"];
  return <ArticleLineChart
    title="Ile hospitalizacji H52 i H53 rozliczył szpital w Koszalinie?"
    months={months}
    lines={[
      { key: "H52", name: "H52 (z implantami)", values: h52, color: REGION_PICK_COLORS[0] },
      { key: "H53", name: "H53 (bez implantów)", values: h53, color: REGION_PICK_COLORS[1] },
    ]}
    valueLabel="hosp."
    ariaLabel={`Hospitalizacje H52 i H53 w Szpitalu Wojewódzkim w Koszalinie: H52 ${sumYear(h52, months, peakYear[0])} w ${peakYear[0]} r., H53 ${sumYear(h53, months, peakYear[1])} w ${peakYear[1]} r.; w maju 2024 r. H52 spada, a H53 rośnie`}
    bands={[
      { from: SECOND_CONTROL_H52.from, to: SECOND_CONTROL_H52.to, color: REGION_PICK_COLORS[0] },
      ...controls.map((control) => ({ from: control.start.slice(0, 7), to: control.end.slice(0, 7), color: CONTROL_COLOR, opacity: CONTROL_OPACITY })),
    ]}
    markers={controls.map((control, i) => ({ date: control.start, label: `${i + 1}. kontrola` }))}
    initialPeriod="month"
    caption={<>Miesiące: hospitalizacje w miesiącu (kropki) i średnia z 3 miesięcy (linia); lata: suma roku. Żółte pasma: kontrolerzy w szpitalu,
      od początku do końca kontroli (1. kontrola: II–IV 2024, H55; 2. kontrola: VIII 2025 – III 2026, H55 i H52). Fioletowe pasmo: okres H52 objęty drugą kontrolą (I–VIII 2023).
      Źródło: otwarte dane NFZ o hospitalizacjach, wyniki kontroli NFZ, obliczenia funduszdanych.pl.</>}
  />;
}

/** Numer pierwszego pytania części (numeracja ciągła przez wszystkie części). */
const firstNumber = (index: number) => 1 + SPINE_QUESTION_SECTIONS.slice(0, index).reduce((total, section) => total + section.questions.length, 0);

/**
 * Lista pytań do NFZ o rozliczenia zabiegów na kręgosłupie (H52, H53, H55) i o model kontroli.
 * Forma listy, nie artykułu: krótki wstęp, pytania w częściach, pod każdym pytaniem fakty z przypisami.
 * Treść pytań: `spineQuestions.ts`; dane wykresu Koszalina liczy strona podczas budowania (`providerGroupsSeries`).
 */
export function SpineQuestionsArticle({ koszalin }: { koszalin: ProviderGroupsSeries }) {
  return <main>
    <PageHeader
      eyebrow={<><Link href={ARTICLES_PATH}>Artykuły</Link> · Pytania</>}
      title="Zabiegi na kręgosłupie: pytania do NFZ"
      lead={<p>{questionsText(SPINE_QUESTION_COUNT)} o rozliczenia grup H52, H53 i H55 i o to, jak NFZ kontroluje szpitale.</p>}
    />

    <div className={styles.layout}>
      <ArticleToc items={TOC} />

      <article className={styles.article}>
        <section id="wstep" aria-label="Wstęp">
          <p>
            14 listopada 2026 r. poseł Rafał Komarewicz zapowiedział wniosek do Prezesa NFZ o kompleksowy audyt rozliczeń
            zabiegów na kręgosłupie.<Ref ids={["posel"]} /> Poniżej są pytania, które wynikają z danych NFZ i z wyników kontroli NFZ.
            Pod każdym pytaniem są fakty, na których się opiera.
          </p>
        </section>

        {SPINE_QUESTION_SECTIONS.map((section, index) => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`}>
          <h2 id={`${section.id}-h`}>{section.title}</h2>
          {section.lead ? <p className={styles.lede}>{section.lead}</p> : null}
          {section.figure === "koszalin-h52-h53" ? <KoszalinChart series={koszalin} /> : null}
          <ol className={styles.questions} start={firstNumber(index)}>
            {section.questions.map((item) => <li key={item.question}>
              <p className={styles.question}>{item.question}</p>
              <p className={styles.questionFacts}>{item.facts}{item.points ? null : <Ref ids={item.sources} />}</p>
              {item.points ? <ul className={styles.questionPoints}>
                {item.points.map((point, i) => <li key={point}>{point}{i === item.points!.length - 1 ? <Ref ids={item.sources} /> : null}</li>)}
              </ul> : null}
            </li>)}
          </ol>
        </section>)}

        <footer id="przypisy" className={styles.sources} aria-labelledby="przypisy-h">
          <h2 id="przypisy-h">Przypisy i źródła</h2>
          <ol className={styles.footnotes}>
            {SPINE_QUESTION_SOURCES.map((source, i) => <li key={source.id} id={`przypis-${i + 1}`}>
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
