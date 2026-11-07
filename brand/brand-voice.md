# Głos marki funduszdanych.pl

Wersja robocza 0.1 (listopad 2026). Uzupełnia [brandbook](brandbook.html) i [DESIGN.md](../DESIGN.md).

Liczby w przykładach są ilustracyjne. Wyjątek: 6,0 mln hospitalizacji JGP w 2025 r. (strona główna, metoda min).

## Jednym zdaniem

Mówimy jak dobra karta wypisowa: konkretnie, w ustalonej kolejności, bez ocen, z podpisem pod każdą liczbą.

## Dla kogo piszemy

| Czytelnik | Czego szuka | Co dla niego robimy |
|---|---|---|
| Dziennikarz, analityk | Liczby do tekstu, porównania, trendy | Źródło i zakres lat przy każdej liczbie; link do widoku, z którego liczba pochodzi |
| Dyrekcja i kadra szpitala | Jak wypada ich placówka na tle podobnych | Porównanie z grupą podobnych szpitali, nie ranking całej Polski |
| Lekarz | Co i gdzie się leczy w danej grupie JGP | Nazwy grup i trybów przyjęcia takie, jak w systemie NFZ, z krótkim wyjaśnieniem |
| Obywatel | Jak wydawane są składki, gdzie leczyć się blisko domu | Prosty język, pytania zamiast terminów, przykłady |

Piszemy tak, żeby zrozumiał obywatel, i tak, żeby analityk nie musiał się domyślać metody.

## Cechy głosu

| Jesteśmy | Ale nie | Na przykład |
|---|---|---|
| **Rzeczowi** | urzędowi | „Ile hospitalizacji JGP rozlicza NFZ w roku?” zamiast „Zestawienie wolumenu świadczeń” |
| **Spokojni** | obojętni | „Śmiertelność była tu wyższa niż w 12 podobnych szpitalach.” Bez „szokujące”, „alarmujące” |
| **Przejrzyści** | przegadani | Metoda w przypisie lub w zakładce „O danych”, nie w każdym zdaniu |
| **Publiczni** | partyjni | Perspektywa systemu i pacjenta. Nie oceniamy polityków, dyrektorów ani lekarzy z nazwiska |

## Zasady

### 1. Pytanie, liczba, kontekst

Tytuł karty lub wykresu to pytanie czytelnika albo krótkie stwierdzenie. Pod nim liczba. Pod liczbą jedno zdanie kontekstu.

> **Ile hospitalizacji JGP rozlicza NFZ w roku?**
> 6,0 mln w 2025 r. Liczby w milionach.

### 2. Liczba zawsze ma podpis

Każda liczba ma: jednostkę, okres i źródło (na wykresie, w przypisie lub w zakładce). Szacunki oznaczamy słowem „szacunek” albo „ok.”.

- „6,0 mln hospitalizacji JGP w 2025 r.” — tak.
- „6 mln hospitalizacji” — nie: brak roku i rodzaju świadczeń.
- Wartości, które NFZ podaje jako „<5”, opisujemy wprost: „część wartości szacowana”.

### 3. Mechanizmy, nie winni

Opisujemy, jak działa system: wyceny, tryb przyjęcia, rozliczenia. Nie szukamy winnych. Różnicę między szpitalami pokazujemy na tle podobnych placówek, z opisem, jak je dobraliśmy.

- Tak: „W tej grupie 64% przyjęć to przyjęcia nagłe. W podobnych szpitalach średnio 51%.”
- Nie: „Ten szpital przyjmuje pacjentów bez planu.”

### 4. Zdania krótkie, strona czynna

- Zdanie: do ok. 20 słów. Jedna myśl w zdaniu.
- Strona czynna: „NFZ rozlicza”, „szpital przyjął”. Nie: „zostało rozliczone”.
- Bez kancelaryjnych zwrotów: „przedmiotowy”, „w zakresie”, „celem”, „dokonać analizy”.

### 5. Zwracamy się do czytelnika na „Ty”, w trybie rozkazującym przy akcjach

- Przyciski i linki mówią, co się stanie: „Znajdź szpital”, „Porównaj szpitale”, „Otwórz eksplorator”.
- Wstępy: „Wybierz pytanie, które pasuje do Ciebie.” „Ty/Ciebie” wielką literą tylko w zwrocie bezpośrednim.
- Nie piszemy „Kliknij tutaj”. Link ma nazwę celu.

### 6. Terminy systemu: tak, żargon: wyjaśniony

Używamy nazw z systemu NFZ (JGP, OW NFZ, tryb przyjęcia, świadczeniodawca), bo czytelnik spotka je w innych źródłach. Przy pierwszym użyciu na stronie dodajemy krótkie wyjaśnienie albo podpowiedź.

| Termin | Jak tłumaczymy przy pierwszym użyciu |
|---|---|
| JGP | Jednorodne Grupy Pacjentów: sposób, w jaki NFZ płaci szpitalom za leczenie |
| Świadczeniodawca | Placówka z umową z NFZ (szpital, spółka, SP ZOZ) |
| Tryb nagły / planowy | Przyjęcie w pilnej sytuacji / przyjęcie z wyznaczonym terminem |
| OW NFZ | Oddział wojewódzki NFZ, który rozlicza świadczenie |

### 7. Rok i zakres nie są na sztywno

Teksty działają dla każdego zakresu lat. Rok bierzemy z danych (`analysisYear`, `yearFrom`/`yearTo`). Nie piszemy „w 2025 roku” w stałym tekście interfejsu.

### 8. Polska typografia

- Przecinek dziesiętny: 6,0 mln. Spacja tysięcy: 12 345.
- „mln”, „mld zł”, „r/r”, „p.p.” (punkty procentowe dla różnicy udziałów).
- Półpauza w zakresie: 2017–2025. Minus typograficzny: −3,2%.
- Cudzysłów polski: „…”.
- Tytuły-stwierdzenia z kropką: „Trzy ścieżki przez dane.”

## Słownik: piszemy / unikamy

| Piszemy | Unikamy |
|---|---|
| publiczna ochrona zdrowia | szpitalnictwo, służba zdrowia (poza nazwami własnymi) |
| hospitalizacje | pobyty, przypadki (w nagłówkach) |
| podobne szpitale, grupa porównawcza | konkurencja, rywale |
| na tle podobnych | ranking, najlepszy, najgorszy |
| szacunek, ok. | dokładnie (przy wartościach estymowanych) |
| zgony w trakcie hospitalizacji | śmiertelność szpitala (bez kontekstu grupy JGP) |
| dane NFZ | oficjalne dane rządowe |

## Kanały

| Kanał | Ton | Długość |
|---|---|---|
| Interfejs (etykiety, przyciski) | Neutralny, rozkazujący | 1–4 słowa |
| Opis karty, wstęp sekcji | Rzeczowy, z liczbą | 1–2 zdania |
| Artykuł | Spokojna narracja, źródło przy każdej tezie | Akapity do 4 zdań |
| Post (X, LinkedIn) | Jedna liczba, jedno pytanie, link | Do 280 znaków |
| Baner, podgląd linku | Hasło + 3 liczby | Hasło i podpisy liczb |

### Przykład posta

> Ile hospitalizacji JGP rozlicza NFZ w roku? W 2025 r. ok. 6,0 mln, tyle co przed pandemią. Sprawdź swoją grupę i województwo: funduszdanych.pl

## Komunikaty systemowe

- Błąd mówi, co się stało i co zrobić: „Nie udało się wczytać danych za 2019 r. Odśwież stronę.” Bez „Ups!” i przeprosin.
- Pusty stan mówi, co pojawi się po wyborze: „Wybierz grupę JGP, żeby zobaczyć ośrodki.”
- Status planowanego modułu: „Planowane”. Bez dat, których nie znamy.

## Lista kontrolna przed publikacją tekstu

1. Czy każda liczba ma jednostkę, okres i źródło?
2. Czy szacunki są oznaczone?
3. Czy tekst nie wskazuje winnych z nazwiska?
4. Czy zdania mają do ok. 20 słów i stronę czynną?
5. Czy rok pochodzi z danych, a nie jest wpisany na stałe?
6. Czy tytuł to pytanie albo stwierdzenie z kropką?
