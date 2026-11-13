import Link from "next/link";
import { PageHeader } from "@/components/portal/PageHeader";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import { formatAtLeastCount } from "@/lib/formatters";
import { longStayPoints, type ExampleGroupFact, type JgpIntroFacts } from "@/lib/jgpIntroArticle";
import { jgpHref } from "@/lib/portalLinks";
import { ARTICLES_PATH } from "@/lib/articles";
import { ArticleToc } from "./ArticleToc";
import { PersonIcon, type PersonKind } from "./PersonIcon";
import { JGP_INTRO_SOURCES, sourceNumber, type JgpIntroSourceId } from "./jgpIntroSources";
import styles from "./Article.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");
const points = (value: number | null) => (value === null ? "—" : `${integer(value)} pkt`);
const groupHref = (code: string) => jgpHref(code) ?? "/jgp";
const isExternal = (href: string) => href.startsWith("http");

/** Spis treści: kotwice sekcji artykułu. */
const SECTIONS = [
  { id: "wstep", label: "O czym jest ten tekst" },
  { id: "anna", label: "Pani Anna idzie do szpitala" },
  { id: "kody", label: "Co szpital wysyła do NFZ" },
  { id: "gruper", label: "Jak powstaje grupa" },
  { id: "kwota", label: "Ile płaci NFZ" },
  { id: "inni", label: "Trzech innych pacjentów" },
  { id: "co-decyduje", label: "Co decyduje o grupie" },
  { id: "poza-jgp", label: "Co jest poza grupą" },
  { id: "system", label: "System w pigułce" },
  { id: "slowniczek", label: "Słowniczek" },
  { id: "przypisy", label: "Przypisy i źródła" },
] as const;

/** Pobyt pani Ewy w przykładzie (dni) — dłuższy niż liczba dni w wycenie grupy G26F. */
const LONG_STAY_DAYS = 22;

/** Bohaterowie przykładu: imię, wiek i piktogram (wiek powyżej 65 lat = siwe włosy i okulary). */
const PEOPLE: readonly { name: string; age: number; kind: PersonKind; story: string }[] = [
  { name: "Pani Anna", age: 52, kind: "woman", story: "operacja w umówionym terminie" },
  { name: "Pan Józef", age: 71, kind: "man", story: "ta sama operacja, starszy pacjent" },
  { name: "Pan Marek", age: 45, kind: "man", story: "nagły atak, leczenie bez operacji" },
  { name: "Pani Ewa", age: 60, kind: "woman", story: "jak pan Marek, ale długi pobyt" },
];
const person = (name: string) => PEOPLE.find((item) => item.name === name)!;

/** Odsyłacz do przypisu: numer w indeksie górnym, link do listy przypisów. */
function Ref({ ids }: { ids: JgpIntroSourceId[] }) {
  return <sup className={styles.ref}>
    {ids.map((id, i) => {
      const n = sourceNumber(id);
      return <span key={id}>{i > 0 ? "," : null}<a href={`#przypis-${n}`} aria-label={`Przypis ${n}`}>{n}</a></span>;
    })}
  </sup>;
}

/** Krótki opis grupy w tekście: kod z linkiem do karty i nazwa. */
function GroupName({ group }: { group: ExampleGroupFact }) {
  return <><Link href={groupHref(group.code)}><b>{group.code}</b></Link> „{group.name}”</>;
}

/** Nagłówek karty pacjenta: piktogram, imię i wiek. */
function PatientHeading({ name }: { name: string }) {
  const { age, kind } = person(name);
  return <div className={styles.patientHead}>
    <PersonIcon kind={kind} older={age > 65} size={40} />
    <h3>{name}, {age} lat</h3>
  </div>;
}

/**
 * Artykuł „Czym są grupy JGP?” dla osób bez wiedzy o systemie. Opowiada mechanizm na historii fikcyjnych pacjentów
 * z kamicą żółciową: wypis → kody → grupa → kwota. Zasady mają przypisy do aktualnych dokumentów NFZ (`jgpIntroSources.ts`);
 * wyceny i liczby przychodzą w `facts` z bieżących danych podczas budowania, tekst nie ma liczb wpisanych na stałe.
 */
export function JgpIntroArticle({ facts }: { facts: JgpIntroFacts }) {
  const { G25F: surgeryYoung, G25E: surgeryOld, G26F: medicalYoung } = facts.groups;
  const surgeries = facts.groups.G25F.hospitalizations + facts.groups.G25E.hospitalizations;
  const ewaPoints = longStayPoints(medicalYoung, LONG_STAY_DAYS);
  const ewaExtraDays = medicalYoung.daysFinanced === null ? null : LONG_STAY_DAYS - medicalYoung.daysFinanced;
  const year = facts.valuationYear;

  return <main>
    <PageHeader
      eyebrow={<><Link href={ARTICLES_PATH}>Artykuły</Link> · Podstawy</>}
      title="Czym są grupy JGP?"
      lead={<p>Jak NFZ płaci szpitalowi za pobyt pacjenta. Wyjaśniamy od zera, na historii czterech osób z kamicą żółciową.</p>}
    />

    <div className={styles.layout}>
      <ArticleToc items={SECTIONS} />

      <article className={styles.article}>
        <section id="wstep" aria-labelledby="wstep-h">
          <h2 id="wstep-h">O czym jest ten tekst</h2>
          <p className={styles.lede}>
            Kto leżał w szpitalu, ten na koniec dostał wypis. Dla pacjenta to koniec sprawy. Dla szpitala — początek rozliczenia z NFZ.
          </p>
          <p>
            NFZ nie płaci szpitalowi za każdy lek, badanie i dzień w łóżku osobno. Każdy pobyt przypisuje do jednej grupy,
            a każda grupa ma z góry ustaloną cenę.<Ref ids={["algorytm"]} /> Te grupy to <strong>Jednorodne Grupy Pacjentów</strong>, w skrócie <strong>JGP</strong>.
            W danych NFZ za {facts.latestYear} r. szpitale rozliczyły pobyty w {integer(facts.groupsInLatestYear)} grupach.<Ref ids={["dane"]} />
          </p>
          <p>
            Pokażemy drogę od wypisu do kwoty, którą NFZ płaci szpitalowi. Przykładem jest kamica żółciowa, czyli kamienie
            w „woreczku”. To częsty powód pobytu na chirurgii: w {facts.latestYear} r. szpitale rozliczyły z NFZ
            {" "}{formatAtLeastCount(surgeries)} operacji usunięcia pęcherzyka żółciowego.<Ref ids={["dane"]} />
          </p>
          <p>Nie potrzebujesz wiedzy medycznej. Pojęcia wyjaśniamy po drodze, a na końcu jest słowniczek. Poznaj bohaterów:</p>
          <ul className={styles.cast} aria-label="Bohaterowie przykładu">
            {PEOPLE.map((item) => <li key={item.name}>
              <PersonIcon kind={item.kind} older={item.age > 65} size={56} />
              <strong>{item.name}, {item.age} lat</strong>
              <span>{item.story}</span>
            </li>)}
          </ul>
          <p className={styles.note}>Postacie i wypis są przykładowe. Kody chorób i zabiegów, grupy i wyceny są prawdziwe. Źródła są w przypisach.</p>
        </section>

        <section id="anna" aria-labelledby="anna-h">
          <div className={styles.sectionPerson}>
            <PersonIcon kind="woman" size={48} />
            <h2 id="anna-h">Pani Anna idzie do szpitala</h2>
          </div>
          <p>
            Pani Anna ma 52 lata. Od kilku miesięcy po tłustym jedzeniu boli ją pod prawym żebrem.
            USG pokazuje kamienie w pęcherzyku żółciowym.
          </p>
          <p>
            Chirurg kwalifikuje ją do operacji. Pani Anna dostaje termin i przychodzi do szpitala w umówionym dniu.
            Lekarze usuwają pęcherzyk laparoskopowo, przez kilka małych nacięć. Po trzech dniach pani Anna wraca do domu z wypisem.
          </p>

          <figure className={styles.discharge} aria-label="Przykładowy wypis ze szpitala">
            <div className={styles.dischargeHead}>
              <span>Karta informacyjna leczenia szpitalnego</span>
              <span>Szpital (przykład) · Oddział Chirurgii Ogólnej</span>
            </div>
            <dl>
              <div><dt>Pacjentka</dt><dd>Anna K., 52 lata</dd></div>
              <div><dt>Przyjęcie</dt><dd>3 marca, tryb planowy</dd></div>
              <div><dt>Wypis</dt><dd>6 marca, do domu</dd></div>
              <div><dt>Rozpoznanie</dt><dd>Kamica pęcherzyka żółciowego bez zapalenia pęcherzyka żółciowego <code className={styles.code}>K80.2</code></dd></div>
              <div><dt>Leczenie</dt><dd>Laparoskopowa cholecystektomia (usunięcie pęcherzyka) <code className={styles.code}>51.239</code></dd></div>
              <div><dt>Zalecenia</dt><dd>Dieta lekkostrawna, kontrola w poradni chirurgicznej za 2 tygodnie</dd></div>
            </dl>
            <figcaption>
              Wypis przykładowy. Kody są prawdziwe: w grupie {surgeryYoung.code} rozpoznanie K80.2 ma połowa pobytów, a zabieg 51.239 — 95%.<Ref ids={["statystyki"]} />
            </figcaption>
          </figure>
        </section>

        <section id="kody" aria-labelledby="kody-h">
          <h2 id="kody-h">Co szpital wysyła do NFZ</h2>
          <p>
            Wypis jest dla pacjentki i jej lekarza. NFZ nie czyta tego tekstu. Szpital wysyła do NFZ te same fakty zapisane kodami.
            Ten zestaw danych to <em>rekord pacjenta</em>:<Ref ids={["algorytm"]} />
          </p>
          <ul>
            <li><strong>Rozpoznanie zasadnicze</strong>, czyli główny powód pobytu: <code className={styles.code}>K80.2</code>. Kody chorób pochodzą z klasyfikacji ICD-10.</li>
            <li><strong>Procedury</strong>, czyli co zrobili lekarze: <code className={styles.code}>51.239</code>. Kody zabiegów i badań pochodzą z klasyfikacji ICD-9-CM.</li>
            <li><strong>Wiek</strong> w dniu przyjęcia: 52 lata.</li>
            <li><strong>Daty</strong> przyjęcia i wypisu, czyli długość pobytu: 3 dni.</li>
            <li><strong>Oddział i jego umowa z NFZ</strong>, a także tryb przyjęcia i wypisu.</li>
          </ul>
          <p>
            Hospitalizacja to cały pobyt: od przyjęcia do wypisu. Jeśli pacjentka leżała na dwóch oddziałach, to nadal jedna hospitalizacja.<Ref ids={["algorytm"]} />
          </p>
        </section>

        <section id="gruper" aria-labelledby="gruper-h">
          <h2 id="gruper-h">Jak powstaje grupa</h2>
          <p>
            Rekord trafia do <em>grupera</em>. To program, który według reguł NFZ przypisuje pobyt do grupy JGP.<Ref ids={["algorytm"]} />
            {" "}Dla pani Anny działa tak:
          </p>
          <ol className={styles.steps}>
            <li>Gruper szuka ważnego zabiegu. Znajduje <code className={styles.code}>51.239</code> — usunięcie pęcherzyka.</li>
            <li>Zabieg wskazuje grupę zabiegową z sekcji <b>G</b>: choroby wątroby, dróg żółciowych, trzustki i śledziony.</li>
            <li>Gruper sprawdza warunki grupy. Tu liczy się wiek: pani Anna ma mniej niż 66 lat.</li>
            <li>Wynik: <GroupName group={surgeryYoung} />.</li>
          </ol>
          <p>Kod grupy da się przeczytać:</p>
          <div className={styles.codeParts} aria-label={`Budowa kodu ${surgeryYoung.code}`}>
            <div><b>G</b><span>sekcja: wątroba, drogi żółciowe, trzustka</span></div>
            <div><b>25</b><span>grupa: wycięcie pęcherzyka</span></div>
            <div><b>F</b><span>wariant: wiek do 65 lat</span></div>
          </div>
          <p className={styles.note}>
            Gdyby rekord nie miał ważnego zabiegu, gruper wybrałby grupę według rozpoznania zasadniczego. Tak wygląda pobyt pana Marka niżej.
            Nie każdy kod procedury zmienia grupę: NFZ nadaje procedurom rangę, a procedura z rangą 0 nie ma znaczenia dla grupowania.<Ref ids={["algorytm"]} />
          </p>
        </section>

        <section id="kwota" aria-labelledby="kwota-h">
          <h2 id="kwota-h">Ile płaci NFZ</h2>
          <p>
            Każda grupa ma wycenę w <strong>punktach</strong>. Grupa {surgeryYoung.code} w katalogu NFZ {year} ma {points(surgeryYoung.points)} za hospitalizację.<Ref ids={["wyceny", "zarzadzenie"]} />
            {" "}Punkty zamienia na złote cena punktu z umowy szpitala z NFZ:
          </p>
          <p className={styles.formulaBox}>kwota = punkty grupy × cena punktu z umowy</p>
          <p>
            To jedna kwota za cały pobyt, ustalona z góry.<Ref ids={["algorytm"]} /> NFZ nie płaci osobno za salę operacyjną, znieczulenie, leki,
            badania ani każdy dzień w łóżku. Jeśli leczenie kosztuje szpital mniej niż wycena, różnica zostaje w szpitalu. Jeśli więcej — szpital pokrywa ją sam.
          </p>
          <p>
            Wycena zależy też od rodzaju umowy oddziału: hospitalizacja, hospitalizacja planowa albo „leczenie jednego dnia”.<Ref ids={["algorytm"]} />
            {" "}Dla umowy „hospitalizacja planowa” grupa {surgeryYoung.code} ma {points(surgeryYoung.plannedPoints)}.<Ref ids={["wyceny"]} />
          </p>
        </section>

        <section id="inni" aria-labelledby="inni-h">
          <h2 id="inni-h">Trzech innych pacjentów</h2>
          <p>Ta sama choroba, kamica żółciowa, może dać inną grupę i inną kwotę. Zmieniamy w historii pani Anny jedną rzecz naraz.</p>

          <div className={styles.patients}>
            <div className={styles.patient}>
              <PatientHeading name="Pan Józef" />
              <p>Ta sama operacja na tym samym oddziale. Pan Józef ma więcej niż 65 lat.</p>
              <p className={styles.result}>→ <GroupName group={surgeryOld} />: {points(surgeryOld.points)}</p>
              <p className={styles.why}>Zmienił się tylko wiek. Grupa dla pacjentów powyżej 65 lat ma wyższą wycenę.</p>
            </div>
            <div className={styles.patient}>
              <PatientHeading name="Pan Marek" />
              <p>
                Trafia do szpitala w nocy, z ostrym bólem i gorączką. Rozpoznanie: kamica pęcherzyka żółciowego z ostrym zapaleniem <code className={styles.code}>K80.0</code>.
                Lekarze leczą go bez operacji. Wychodzi po 4 dniach.
              </p>
              <p className={styles.result}>→ <GroupName group={medicalYoung} />: {points(medicalYoung.points)}</p>
              <p className={styles.why}>
                Nie było zabiegu, więc o grupie zdecydowało rozpoznanie. To grupa zachowawcza (bez operacji).<Ref ids={["algorytm", "statystyki"]} />
              </p>
            </div>
            <div className={styles.patient}>
              <PatientHeading name="Pani Ewa" />
              <p>Choruje jak pan Marek, ale zapalenie się przedłuża. Leży w szpitalu {LONG_STAY_DAYS} dni.</p>
              <p className={styles.result}>
                → <GroupName group={medicalYoung} />{ewaPoints !== null ? <>: {points(ewaPoints)}</> : null}
              </p>
              {ewaPoints !== null && ewaExtraDays !== null ? <p className={styles.why}>
                Ta sama grupa. Wycena obejmuje {medicalYoung.daysFinanced} dni pobytu. Za każdy kolejny dzień NFZ dopłaca {points(medicalYoung.extraDayPoints)}:
                {" "}{points(medicalYoung.points)} + {ewaExtraDays} × {points(medicalYoung.extraDayPoints)}.<Ref ids={["algorytm", "wyceny"]} />
              </p> : null}
            </div>
          </div>

          <div className="priority-table">
            <table className={styles.table}>
              <caption>Grupy z historii: wyceny w katalogu NFZ {year}</caption>
              <thead>
                <tr>
                  <th scope="col">Grupa</th>
                  <th scope="col" className={styles.num}>Hospitalizacja</th>
                  <th scope="col" className={styles.num}>Hosp. planowa</th>
                  <th scope="col" className={`${styles.num} col-p3`}>Dni w wycenie</th>
                  <th scope="col" className={`${styles.num} col-p2`}>Każdy dzień więcej</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(facts.groups).map((group) => <tr key={group.code}>
                  <th scope="row"><Link href={groupHref(group.code)}>{group.code}</Link> <span>{group.name}</span></th>
                  <td className={styles.num}>{points(group.points)}</td>
                  <td className={styles.num}>{points(group.plannedPoints)}</td>
                  <td className={`${styles.num} col-p3`}>{group.daysFinanced === null ? "—" : integer(group.daysFinanced)}</td>
                  <td className={`${styles.num} col-p2`}>{points(group.extraDayPoints)}</td>
                </tr>)}
              </tbody>
            </table>
            <p className={styles.tableNote}>
              Kolumny „Hospitalizacja” i „Hosp. planowa” to rodzaje umowy oddziału. „—” — katalog nie podaje wartości dla grupy.<Ref ids={["wyceny"]} />
            </p>
          </div>
          <p><Link className={styles.more} href={groupHref(surgeryYoung.code)}>Karta grupy {surgeryYoung.code}: ile pobytów, gdzie i w których szpitalach →</Link></p>
        </section>

        <section id="co-decyduje" aria-labelledby="co-decyduje-h">
          <h2 id="co-decyduje-h">Co decyduje o grupie</h2>
          <p>Z czterech historii wynika lista. O grupie i kwocie decydują:<Ref ids={["algorytm"]} /></p>
          <ol className={styles.steps}>
            <li><strong>Co zrobili lekarze.</strong> Zabieg daje grupę zabiegową, leczenie bez zabiegu — grupę zachowawczą (Anna i Marek).</li>
            <li><strong>Z jakim problemem pacjent przyszedł.</strong> Bez zabiegu grupę wskazuje rozpoznanie zasadnicze (Marek).</li>
            <li><strong>Wiek pacjenta</strong> w dniu przyjęcia — w części grup (Anna i Józef).</li>
            <li>
              <strong>Długość pobytu.</strong> Po przekroczeniu liczby dni w wycenie NFZ dopłaca za każdy dzień (Ewa).
              Pobyt krótszy niż 3 dni ma w części grup niższą wycenę.
            </li>
            <li><strong>Rodzaj umowy oddziału</strong> — hospitalizacja, hospitalizacja planowa albo „leczenie jednego dnia”. Przy dwóch ostatnich NFZ nie dopłaca za dni ponad wycenę.</li>
          </ol>
          <p className={styles.note}>
            Grupa ma łączyć przypadki podobne medycznie i podobne pod względem zużycia zasobów szpitala. Stąd nazwa: <strong>Jednorodne Grupy Pacjentów</strong>.<Ref ids={["algorytm"]} />
          </p>
        </section>

        <section id="poza-jgp" aria-labelledby="poza-jgp-h">
          <h2 id="poza-jgp-h">Co jest poza grupą</h2>
          <p>Jedna kwota za pobyt to zasada. Są od niej wyjątki:</p>
          <ul>
            <li>
              <strong>Świadczenia doliczane do grupy.</strong> Za jeden pobyt szpital rozlicza tylko jedną grupę JGP, ale może do niej doliczyć
              świadczenia towarzyszące na zasadach z zarządzeń NFZ.<Ref ids={["algorytm"]} /> Przykład: przetoczenie krwi i jej składników NFZ rozlicza jako osobne
              świadczenia, np. „Przetoczenie koncentratu krwinek czerwonych z krwi pełnej”.<Ref ids={["krew"]} />
            </li>
            <li>
              <strong>Intensywna terapia.</strong> Pobyt na oddziale anestezjologii i intensywnej terapii nie wchodzi do grupowania.<Ref ids={["algorytm"]} />
              {" "}NFZ rozlicza go za każdy dzień, według punktowej oceny stanu pacjenta w skali TISS-28.<Ref ids={["oait"]} />
            </li>
            <li><strong>SOR i izba przyjęć.</strong> NFZ finansuje je ryczałtem dobowym, nie grupą.<Ref ids={["sor"]} /></li>
            <li><strong>Chemioterapia i programy lekowe.</strong> Mają osobne zarządzenia Prezesa NFZ.<Ref ids={["chemio"]} /></li>
            <li><strong>Przypadki nietypowe.</strong> Pobyt wyraźnie wykraczający poza grupy NFZ może rozliczyć za indywidualną zgodą.<Ref ids={["algorytm"]} /></li>
          </ul>
          <p>
            Gdy pobyt pasuje do więcej niż jednej grupy, szpital sam wskazuje jedną z nich do rozliczenia.<Ref ids={["algorytm"]} />
          </p>
        </section>

        <section id="system" aria-labelledby="system-h">
          <h2 id="system-h">System w pigułce</h2>
          <p>Te same elementy, co w historii pani Anny, nazwane tak, jak w dokumentach NFZ:<Ref ids={["algorytm"]} /></p>
          <dl className={styles.glossary}>
            <div><dt>Sekcja</dt><dd>Obszar medycyny oznaczony literą, np. G.</dd></div>
            <div><dt>Grupa</dt><dd>Kod, nazwa i kod produktu do rozliczeń z NFZ{surgeryYoung.productCode ? <>, np. {surgeryYoung.code}: {surgeryYoung.productCode}</> : null}.</dd></div>
            <div><dt>Charakterystyka JGP</dt><dd>Załącznik do zarządzenia NFZ z warunkami grup: procedury, rozpoznania, wiek, czas pobytu.</dd></div>
            <div><dt>Grupa zabiegowa / zachowawcza</dt><dd>Do zabiegowej kieruje procedura ICD-9-CM, do zachowawczej — rozpoznanie ICD-10.</dd></div>
            <div><dt>Wycena i taryfa</dt><dd>Wycena to punkty grupy w katalogu JGP. Taryfa to kwota po przeliczeniu punktów.</dd></div>
            <div><dt>Gruper</dt><dd>Program, który przypisuje rekord do grupy według algorytmu NFZ.</dd></div>
          </dl>
          <p>
            NFZ wprowadził JGP 1 lipca 2008 r. System wzorowano na systemach DRG (Diagnosis Related Groups), używanych w wielu krajach.<Ref ids={["algorytm"]} />
            {" "}NFZ zmienia grupy i wyceny w zarządzeniach Prezesa NFZ. Obecnie obowiązuje zarządzenie nr 101/2025/DSOZ.<Ref ids={["zarzadzenie"]} />
          </p>
          <p className={styles.links}>
            <Link href="/jgp">Katalog grup JGP →</Link>
            <Link href={DASHBOARD_HREFS.summary}>Hospitalizacje w Polsce →</Link>
            <Link href={DASHBOARD_HREFS.methodology}>O danych →</Link>
          </p>
        </section>

        <section id="slowniczek" aria-labelledby="slowniczek-h">
          <h2 id="slowniczek-h">Słowniczek</h2>
          <dl className={styles.glossary}>
            <div><dt>Hospitalizacja</dt><dd>Cały pobyt w szpitalu od przyjęcia do wypisu, niezależnie od liczby oddziałów.</dd></div>
            <div><dt>Wypis</dt><dd>Karta informacyjna dla pacjenta: rozpoznanie, leczenie, zalecenia.</dd></div>
            <div><dt>Rekord pacjenta</dt><dd>Dane pobytu zapisane kodami, z których gruper wybiera grupę.</dd></div>
            <div><dt>Rozpoznanie zasadnicze</dt><dd>Główny powód pobytu, kod ICD-10.</dd></div>
            <div><dt>Procedura</dt><dd>Zabieg albo badanie, kod ICD-9-CM.</dd></div>
            <div><dt>Punkt</dt><dd>Jednostka, w której NFZ wycenia grupy.</dd></div>
            <div><dt>Osobodzień</dt><dd>Jeden dzień pobytu jednego pacjenta.</dd></div>
          </dl>
        </section>

        <footer id="przypisy" className={styles.sources} aria-labelledby="przypisy-h">
          <h2 id="przypisy-h">Przypisy i źródła</h2>
          <ol className={styles.footnotes}>
            {JGP_INTRO_SOURCES.map((source, i) => <li key={source.id} id={`przypis-${i + 1}`}>
              {isExternal(source.href)
                ? <a href={source.href} target="_blank" rel="noreferrer">{source.title}</a>
                : <Link href={source.href}>{source.title}</Link>}
              {source.id === "wyceny" ? ` (katalog ${year})` : source.id === "dane" ? ` (${facts.latestYear} r.)` : null}
              . <span>Potwierdza: {source.note}.</span>
            </li>)}
          </ol>
        </footer>
      </article>
    </div>
  </main>;
}
