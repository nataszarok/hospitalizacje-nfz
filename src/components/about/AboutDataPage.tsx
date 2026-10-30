import Link from "next/link";
import { DASHBOARD_HREFS } from "@/lib/dashboardNavigation";
import styles from "./AboutDataPage.module.css";

const HOSPITALIZATIONS_SOURCE_URL = "https://dane.gov.pl/en/dataset/3009,dane-dotyczace-hospitalizacji-rozliczonych-jgp-w-l/resource/2231001/table";

/** Strona „O danych”: źródła, jednostki i metody liczenia. Zakres lat pochodzi z danych. */
export function AboutDataPage({ yearFrom, yearTo }: { yearFrom: string; yearTo: string }) {
  const range = yearFrom === yearTo ? yearFrom : `${yearFrom}–${yearTo}`;
  return <main className={styles.page}>
    <header className={styles.header}>
      <h1>O danych</h1>
      <p>Skąd pochodzą liczby w Atlasie i jak je czytać.</p>
    </header>

    <section className={styles.card}>
      <h2>Hospitalizacje</h2>
      <p>
        Hospitalizacje rozliczone przez NFZ w grupach JGP, lata {range}. Źródło: otwarte dane NFZ w serwisie dane.gov.pl{" "}
        (<a href={HOSPITALIZATIONS_SOURCE_URL} target="_blank" rel="noreferrer">zbiór danych o hospitalizacjach rozliczonych JGP</a>).
        Dane obejmują miesiąc, oddział NFZ, świadczeniodawcę, produkt rozliczeniowy, tryb przyjęcia i wypisu oraz długość pobytu.
      </p>
      <ul>
        <li><strong>Świadczeniodawca</strong> to unikalna para: oddział wojewódzki NFZ + NIP. Ten sam podmiot działający w dwóch województwach to dwa wiersze.</li>
        <li><strong>Zgon</strong> to hospitalizacja z trybem wypisu „zgon”. Śmiertelność = zgony / hospitalizacje.</li>
        <li><strong>Tryb przyjęcia:</strong> planowe (kod 6), nagłe (kody 2 i 3), pozostałe.</li>
        <li><strong>Na 100 tys. mieszkańców:</strong> ludność województw wg GUS, stan na 31.12.2024. Liczymy według województwa świadczeniodawcy, nie miejsca zamieszkania pacjenta.</li>
      </ul>
    </section>

    <section className={styles.card}>
      <h2>Wartości &lt;5</h2>
      <p>
        Dane źródłowe nie podają liczb mniejszych niż 5. W analizach można wybrać metodę szacowania:
      </p>
      <ul>
        <li><strong>Konserwatywna</strong> (domyślna): każde &lt;5 = 1. Daje dolne oszacowanie.</li>
        <li><strong>Symulacyjna</strong>: wartości 1–4 losowane z rozkładu, w którym mniejsze liczby są bardziej prawdopodobne. Losowanie jest stałe, więc wyniki się powtarzają.</li>
      </ul>
      <p>Metoda wpływa także na liczbę zgonów, gdy wartość &lt;5 dotyczy hospitalizacji zakończonych zgonem.</p>
    </section>

    <section className={styles.card}>
      <h2>Zmiany katalogu JGP</h2>
      <p>
        Katalog grup JGP zmienia się między latami: grupy znikają, powstają nowe, zmieniają się nazwy. Nazwy grup spoza bieżącego katalogu
        pochodzą ze słownika API statystyk NFZ. Gdy grupy nie ma w katalogu w danym roku, wykres trendu pokazuje przerwę, a nie zero.
      </p>
    </section>

    <section className={styles.card}>
      <h2>Jak czytać analizy</h2>
      <p>
        Atlas pokazuje dane zagregowane. Różnice między świadczeniodawcami wynikają też z profilu pacjentów, zakresu działalności
        i sposobu rozliczania, dlatego jedna liczba nie wystarcza do oceny jakości leczenia.
      </p>
      <p className={styles.links}>
        <Link href={DASHBOARD_HREFS.trend}>Przejdź do analiz →</Link>
        <Link href={DASHBOARD_HREFS.hospital}>Profile szpitali →</Link>
      </p>
    </section>
  </main>;
}
