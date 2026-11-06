import Link from "next/link";
import type { CalibrationSummary } from "@/lib/calibration";
import styles from "./Below5MethodPage.module.css";

export const BELOW5_METHOD_HREF = "/o-danych/szacowanie-ponizej-5";

// Ocena metody na danych, których metoda nie używa (jednorazowa analiza, opis w docs/kalibracja/kalibracja-schemat-decyzji.html).
// Różnica udziałów = połowa sumy |udział w wyniku − udział w API|; mediana po grupach JGP.
const EVALUATION = {
  year: "2024",
  ranges: { median: "0,20%", p90: "0,91%" },
  margins: [
    { label: "Długość pobytu (4 przedziały)", cal: "1,26%", min: "1,43%", sim: "1,87%" },
    { label: "Tryb przyjęcia", cal: "1,11%", min: "1,31%", sim: "1,92%" },
    { label: "Płeć", cal: "0,57%", min: "0,56%", sim: "0,64%" },
  ],
  hidden: { median: "1,9%", p90: "9,3%" },
};

const pl = (value: number) => value.toLocaleString("pl-PL");

/** Strona metody szacowania wartości „<5” (metoda cal). Liczby wyniku pochodzą z plików kalibracji. */
export function Below5MethodPage({ summaries }: { summaries: CalibrationSummary[] }) {
  const latest = summaries.at(-1);
  const years = summaries.map((summary) => summary.year).join(", ");
  return <main className={styles.page}>
    <p className={styles.back}><Link href="/o-danych">← O danych</Link></p>
    <header className={styles.header}>
      <h1>Jak szacujemy wartości „&lt;5”</h1>
      <p>
        Opis metody kalibrowanej (<code>cal</code>) dla osób technicznych: źródła, jednostka obliczeń, wzory, kolejność kroków,
        kontrola wyniku i ograniczenia.
      </p>
    </header>

    <section className={styles.status} aria-label="Stan metody">
      {latest
        ? <p>Metoda <code>cal</code> jest policzona dla {summaries.length > 1 ? "lat" : "roku"}: <strong>{years}</strong>. Pliki danych mają już kolumny
          <code>hCal</code>/<code>dCal</code> dla tych lat, ale analizy w serwisie nadal pokazują metody konserwatywną (<code>min</code>)
          i symulacyjną (<code>sim</code>). Przełączymy je, gdy kalibracja obejmie wszystkie lata.</p>
        : <p>Metoda <code>cal</code> nie jest jeszcze policzona dla żadnego roku. Analizy pokazują metody <code>min</code> i <code>sim</code>.</p>}
    </section>

    <section className={styles.card}>
      <h2>1. Problem</h2>
      <p>
        Plik hospitalizacji NFZ ma wiersz dla każdej kombinacji: miesiąc, oddział NFZ, świadczeniodawca (NIP), zakres umowy,
        produkt JGP, tryb przyjęcia, tryb wypisu, płeć, grupa wieku i przedział długości pobytu. Liczby od 1 do 4 są ukryte jako „&lt;5”.
        Takich wierszy jest bardzo dużo, bo kombinacji jest dużo, a większość z nich ma małe liczby.
      </p>
      {latest && <p>
        W {latest.year} r. metoda <code>min</code> (każde „&lt;5” = 1) daje {pl(latest.staysMin)} pobytów w grupach z danymi API,
        a statystyki JGP NFZ podają {pl(latest.staysApi)}. Wiersze „&lt;5” kryją więc o {pl(latest.staysApi - latest.staysMin)} pobytów
        więcej, niż pokazuje <code>min</code>.
      </p>}
      <p>
        Metoda <code>sim</code> losuje 1–4 jednakowo dla każdej grupy JGP i nie wie nic o grupie. Jej błąd ma różny znak: w jednych
        grupach zawyża liczbę pobytów o kilkadziesiąt procent, w innych ją zaniża. Metoda <code>cal</code> korzysta z dodatkowych,
        jawnych danych NFZ i dopasowuje wynik do sum krajowych.
      </p>
    </section>

    <section className={styles.card}>
      <h2>2. Źródła danych</h2>
      <div className={styles.scroll}><table className={styles.sources}>
        <thead><tr><th>Źródło</th><th>Poziom</th><th>Co z niego bierzemy</th></tr></thead>
        <tbody>
          <tr><td>Plik hospitalizacji (dane.gov.pl)</td><td>wiersz</td><td>pobyty jawne (≥ 5), liczba wierszy „&lt;5”, długość pobytu, tryb wypisu</td></tr>
          <tr><td>Zestawienie świadczeń NFZ</td><td>świadczeniodawca × zakres × produkt</td><td>punkty rozliczone i liczba pacjentów (też jako „&lt;5”)</td></tr>
          <tr><td>API statystyk JGP NFZ</td><td>produkt JGP, cały kraj</td><td>pobyty, pacjenci, pobyty w zakresach umów, zgony, histogram długości pobytu w dniach</td></tr>
          <tr><td>Katalog grup JGP (zarządzenia Prezesa NFZ, zał. 1a)</td><td>produkt JGP</td><td>wycena pobytu (0, 1, 2 dni, ryczałt), dni finansowane ryczałtem, punkty za osobodzień; wersje katalogu ważone liczbą miesięcy obowiązywania w roku</td></tr>
        </tbody>
      </table></div>
      <p className={styles.note}>
        Świadczeniodawców łączymy przez kod NFZ i NIP. Zakresy z API łączymy z zestawieniem po nazwie zakresu (kod zakresu w API
        ma inny format niż w plikach).
      </p>
    </section>

    <section className={styles.card}>
      <h2>3. Jednostka obliczeń i twarde granice</h2>
      <p>
        Liczymy dla <strong>komórki</strong>: oddział NFZ + NIP + kod zakresu umowy + produkt JGP. Komórka łączy wszystkie wiersze
        pliku z tymi czterema wartościami (miesiące, tryby, płeć, wiek). Dla komórki z <em>k</em> pobytami jawnymi i <em>m</em> wierszami
        „&lt;5”:
      </p>
      <div className={styles.formula}>lo = k + m &nbsp;&nbsp;·&nbsp;&nbsp; hi = k + 4m</div>
      <p>
        Wynik zawsze leży w [lo, hi]: plik pozwala tylko na tyle. Gdy zestawienie podaje pacjentów jako „&lt;5”, komórka ma
        co najwyżej 4 pacjentów na wiersz zestawienia, więc górna granica spada do <code>hi2 = min(hi, ⌊4 × wiersze zestawienia × r⌋)</code>,
        gdzie <em>r</em> to iloraz pobytów do pacjentów grupy z API.
      </p>
      <p>
        Druga dolna granica to <strong>jawni pacjenci</strong> (P ≥ 5): pobytów nie może być mniej niż pacjentów. Ta granica obowiązuje
        we wszystkich krokach dopasowania (punkt 6).
      </p>
    </section>

    <section className={styles.card}>
      <h2>4. Wycena pobytu U</h2>
      <p>
        Punkty z zestawienia to suma wycen pobytów. Żeby z punktów odczytać liczbę pobytów, potrzebujemy średnich punktów
        jednego pobytu w komórce (<strong>U</strong>). U to średnia wycena wierszy komórki według przedziału długości pobytu:
      </p>
      <ul>
        <li><strong>0 dni</strong> i <strong>1–2 dni</strong>: wycena pobytu 0, 1 i 2 dni z katalogu; dla 1–2 dni ważona liczbą pobytów 1- i 2-dniowych z histogramu API;</li>
        <li><strong>3–5 dni</strong>: ryczałt grupy;</li>
        <li><strong>6 i więcej dni</strong>: ryczałt plus osobodnie ponad dni finansowane ryczałtem, uśrednione po histogramie dni z API.</li>
      </ul>
      <div className={styles.formula}>U(6+) = Σ<sub>d ≥ 6</sub> h(d) × (W + o × max(0, d − D)) ÷ Σ<sub>d ≥ 6</sub> h(d)</div>
      <p className={styles.note}>
        h(d): liczba pobytów trwających d dni (API), W: ryczałt, o: punkty za osobodzień, D: dni finansowane ryczałtem. Przykład: grupa J08
        ma ryczałt 2 067 pkt, a średni pobyt 6+ dni z osobodniami to ok. 3 090 pkt. Bez tej poprawki krótkie i długie pobyty liczyły się tak samo.
      </p>
    </section>

    <section className={styles.card}>
      <h2>5. Dwie metody: z pacjentów albo z punktów</h2>
      <p>
        Metodę wybieramy dla całej grupy JGP według ilorazu <em>r</em> = pobyty ÷ pacjenci z API. Gdy r jest bliski 1, jawna liczba
        pacjentów jest prawie dokładną liczbą pobytów. Gdy pacjenci wracają do szpitala, liczba pacjentów nie mówi, ile było pobytów,
        i głównym źródłem są punkty.
      </p>
      <div className={styles.methods}>
        <div className={styles.method}>
          <h3>Metoda A: r &lt; 1,05{latest ? ` (${pl(latest.groupsA)} grup)` : ""}</h3>
          <ul>
            <li>Jawni pacjenci P: <code>n = ⌊P × r⌋</code>, w [lo, hi].</li>
            <li>Pacjenci „&lt;5”: wybieramy n z [lo, hi2], dla którego punkty ÷ (U × n) leży w oknie 0,97–1,32 i najbliżej mediany zakresu.
              Mediana zakresu = mediana punkty ÷ (U × P × r) z komórek z jawnymi pacjentami w tym zakresie.</li>
            <li>Bez n w oknie: <code>⌊punkty ÷ (U × mediana)⌋</code>, w [lo, hi2].</li>
          </ul>
        </div>
        <div className={styles.method}>
          <h3>Metoda B: r ≥ 1,05{latest ? ` (${pl(latest.groupsB)} grup)` : ""}</h3>
          <ul>
            <li>Każda komórka: <code>n(c) = ⌊punkty ÷ (U × c)⌋</code>, nie mniej niż jawni pacjenci, w [lo, hi2].</li>
            <li>Współczynnik <em>c</em> jest wspólny dla zakresu umowy. Dobieramy go bisekcją (60 kroków, przedział 0,05–20) tak,
              by suma n(c) w zakresie była równa liczbie pobytów zakresu z API.</li>
            <li>c mierzy dopłaty, których U nie zawiera (procedury, tryb). Różni się między zakresami, dlatego nie liczymy jednego c dla grupy.</li>
          </ul>
        </div>
      </div>
    </section>

    <section className={styles.card}>
      <h2>6. Dopasowanie do sum z API</h2>
      <ol>
        <li><strong>Cele zakresów.</strong> Dla każdego zakresu z API celem jest jego liczba pobytów. Zakresy, których API nie wymienia
          (małe), liczymy razem: cel = pobyty grupy − suma zakresów z API. Komórki bez pary w zestawieniu zostają na lo i pomniejszają cel.</li>
        <li><strong>Dopasowanie w zakresie.</strong> Nadwyżkę ponad lo (n − lo) skalujemy proporcjonalnie, aż suma zakresu jest równa celowi.
          Każda komórka zostaje w [max(lo, P), hi2]. Liczby całkowite: po zaokrągleniu w dół brakujące jednostki dostają komórki
          o największej części ułamkowej.</li>
        <li><strong>Domknięcie grupy.</strong> Gdy zakres nie mieści swoich jawnych pacjentów (cel z API jest mniejszy niż suma
          max(lo, P)), zostaje ponad celem, a różnicę oddają komórki innych zakresów, które mają zapas ponad swoją dolną granicę.
          Suma grupy zawsze jest równa API.</li>
        <li><strong>Ostateczność.</strong> Tylko gdy cała grupa nie mieści jawnych pacjentów w sumie z API, komórki schodzą do lo.
          {latest ? ` W ${latest.year} r. dotyczy to ${pl(latest.groupsBelowPatients)} grup i razem ${pl(latest.cellsBelowPatients)} komórek.` : ""}
          To konflikt źródeł (zestawienie podaje więcej pacjentów niż API pobytów), nie błąd dopasowania.</li>
      </ol>
    </section>

    <section className={styles.card}>
      <h2>7. Zgony</h2>
      <p>
        Wiersz „&lt;5” z trybem wypisu „zgon” to 1–4 pobyty zakończone zgonem. Brakujące zgony to
        <code> X = zgony z API − zgony jawne − wiersze „&lt;5” ze zgonem</code>. X dzielimy na komórki z wierszami „&lt;5” ze zgonem,
        proporcjonalnie do liczby tych wierszy i nadwyżki pobytów komórki, najwyżej 3 dodatkowe zgony na wiersz i nie więcej niż nadwyżka.
      </p>
      <p>
        Wyjątek wynika z budowy pliku: wiersz „&lt;5” ze zgonem zawiera tylko pobyty zakończone zgonem. Gdy nadwyżka komórki nie mieści się
        w jej wierszach „&lt;5” bez zgonu (najwyżej 3 dodatkowe pobyty na wiersz), reszta trafia do wierszy ze zgonem i jest zgonami, nawet
        jeśli suma zgonów grupy przekroczy wtedy API.
      </p>
    </section>

    {latest && <section className={styles.card}>
      <h2>8. Wynik i kontrola ({latest.year})</h2>
      <div className={styles.scroll}><table>
        <tbody>
          <tr><td>Komórki</td><td>{pl(latest.cells)}</td></tr>
          <tr><td>Grupy JGP z danymi API (metoda A / B)</td><td>{pl(latest.groups)} ({pl(latest.groupsA)} / {pl(latest.groupsB)})</td></tr>
          <tr><td>Grupy bez danych API (zostają przy <code>min</code>)</td><td>{pl(latest.groupsWithoutApi)}</td></tr>
          <tr><td>Pobyty: <code>min</code> / <code>cal</code> / API</td><td>{pl(latest.staysMin)} / {pl(latest.staysCal)} / {pl(latest.staysApi)}</td></tr>
          <tr><td>Grupy z sumą pobytów równą API</td><td>{pl(latest.groupsStaysEqualApi)} z {pl(latest.groups)}</td></tr>
          <tr><td>Zgony: <code>cal</code> / API</td><td>{pl(latest.deathsCal)} / {pl(latest.deathsApi)}</td></tr>
          <tr><td>Grupy z sumą zgonów równą API</td><td>{pl(latest.groupsDeathsEqualApi)} z {pl(latest.groups)}</td></tr>
          <tr><td>Komórki poniżej jawnych pacjentów (konflikt źródeł)</td><td>{pl(latest.cellsBelowPatients)}</td></tr>
        </tbody>
      </table></div>
      <p className={styles.note}>
        Suma zgonów grupy różni się od API, gdy plik ma więcej zgonów, niż podaje API, albo gdy nadwyżka pobytów trafia do wierszy
        „&lt;5” ze zgonem (punkt 7). Przy budowie serwisu kontrolujemy też, że pobyty <code>min</code> każdej komórki sumują się do
        danych w analizach, <code>cal</code> nie jest mniejsze niż <code>min</code>, a kolumny <code>hCal</code>/<code>dCal</code>
        w plikach hospitalizacji sumują się do pliku kalibracji.
      </p>
    </section>}

    <section className={styles.card}>
      <h2>{latest ? "9" : "8"}. Jak sprawdziliśmy metodę</h2>
      <p>
        Sumy grup są równe API z definicji, więc nie mówią nic o jakości podziału między szpitale. Metodę sprawdziliśmy na danych
        z {EVALUATION.year} r., których kalibracja nie używa:
      </p>
      <ul>
        <li><strong>Podział na zakresy.</strong> Model dopasowany tylko do sumy grupy (bez celów zakresów) porównujemy z pobytami
          zakresów z API. Różnica udziałów: mediana {EVALUATION.ranges.median}, 90. percentyl {EVALUATION.ranges.p90}.</li>
        <li><strong>Ukrycie pacjentów.</strong> W grupach z r ≈ 1 bierzemy komórki z jawnymi pacjentami (tam n ≈ P × r) i liczymy n z samych
          punktów. Błąd względny: mediana {EVALUATION.hidden.median}, 90. percentyl {EVALUATION.hidden.p90}. To górna miara błędu
          dla komórek, w których punkty są jedynym źródłem.</li>
        <li><strong>Rozkłady krajowe.</strong> API podaje pobyty grupy według długości pobytu, trybu przyjęcia i płci. Te kolumny są
          w pliku, ale kalibracja ich nie dopasowuje. Różnica udziałów wobec API (mediana po grupach):</li>
      </ul>
      <div className={styles.scroll}><table>
        <thead><tr><th>Rozkład</th><th><code>cal</code></th><th><code>min</code></th><th><code>sim</code></th></tr></thead>
        <tbody>{EVALUATION.margins.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.cal}</td><td>{row.min}</td><td>{row.sim}</td></tr>)}</tbody>
      </table></div>
      <p className={styles.note}>
        Różnica udziałów = ½ Σ |udział w wyniku − udział w API|. Wersję obecną (v4) wybraliśmy spośród trzech wariantów: wcześniejszej
        (bez osobodni i bez dolnej granicy z pacjentów) i modelu probabilistycznego z rozkładem dla każdej komórki. v4 była najlepsza
        w teście zakresów i w rozkładach krajowych.
      </p>
    </section>

    <section className={styles.card}>
      <h2>{latest ? "10" : "9"}. Ograniczenia</h2>
      <ul>
        <li><strong>Komórka, nie wiersz.</strong> Kalibracja daje liczbę pobytów komórki. Na wiersze (miesiące, tryby, płeć, wiek)
          dzielimy nadwyżkę po równo: dodatkowe zgony na wiersze „&lt;5” ze zgonem, resztę na pozostałe wiersze „&lt;5”, a resztę
          z dzielenia dostają wiersze wybrane losowo (stałe ziarno dla roku, więc wynik się powtarza). To reguła prosta, a nie szacunek
          rozkładu w ciągu roku.</li>
        <li><strong>Małe komórki są niepewne.</strong> Dla komórki z 1–2 wierszami „&lt;5” punkty zwykle zgadzają się z kilkoma wartościami n.
          Wynik to wartość najlepiej zgodna z danymi i sumą z API, a nie pomiar.</li>
        <li><strong>Histogram dni jest wspólny dla grupy.</strong> Zakres z dłuższymi pobytami (np. choroby wewnętrzne w grupach
          onkologicznych) nadal ma wyższy współczynnik c.</li>
        <li><strong>Niezgodne źródła.</strong> Część komórek ma w zestawieniu więcej pacjentów, niż plik może pomieścić, albo 0 punktów,
          albo punkty kilka razy wyższe niż wycena. Wynik zostaje wtedy w granicach z pliku.</li>
        <li><strong>Zakresy pominięte w API.</strong> API nie wymienia małych zakresów (w {EVALUATION.year} r. razem ok. 1,5% pobytów). Liczymy je razem, z jednym współczynnikiem, więc ich podział między siebie jest mniej pewny.</li>
      </ul>
    </section>
  </main>;
}
