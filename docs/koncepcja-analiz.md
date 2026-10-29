# Koncepcja modułu Analizy

Szkic do oceny przed przebudową `/analizy`. Opisuje, na jakie pytania ma odpowiadać moduł,
jak ułożyć strony i ekrany oraz jak przygotować dane, gdy dojdą kolejne lata.

## 1. Punkt wyjścia

Dzisiejsze `/analizy` to przeniesiony dashboard z POC: panel filtrów po lewej i karty, z których
każda pokazuje jeden wykres („Liczba hospitalizacji a śmiertelność”, „Tryb przyjęcia”) albo profil
szpitala. Działa, ale:

- karty są nazwane od wykresu, a nie od pytania, więc użytkownik musi wiedzieć, czego szuka;
- na pierwszym planie są ustawienia techniczne (metoda estymacji wartości `<5`);
- wybór JGP (maks. 10 kodów) żyje w panelu, a nie jako wspólny kontekst całego modułu;
- nie ma osi czasu — a przy wielu latach to najważniejszy wymiar;
- tabele pod wykresami powtarzają prawie te same kolumny;
- każdy nowy przypadek użycia oznaczałby kolejną kartę z kolejnym wykresem.

## 2. Dla kogo i jakie pytania

| Kto | Typowe pytanie |
|---|---|
| Dziennikarz, obywatel | Ile było hospitalizacji z powodu X i jak to się zmienia? Gdzie leczy się najwięcej? |
| Dyrektor szpitala | Jak wypadam na tle podobnych szpitali? Jaki mam udział przyjęć nagłych? |
| Analityk, badacz | Jak zmieniła się liczba hospitalizacji w grupie JGP po zmianie katalogu lub wyceny? |
| Płatnik, administracja | Gdzie koncentruje się wolumen i śmiertelność w danej grupie? |

Pytania, na które moduł ma odpowiadać wprost:

1. **Jak to się zmieniało w czasie?** — liczba hospitalizacji (i zgonów) dla wybranego zakresu JGP rok po roku i miesiąc po miesiącu.
2. **Kto leczy i z jakim wynikiem?** — świadczeniodawcy: wolumen a śmiertelność (obecny wykres punktowy).
3. **Planowo czy w trybie nagłym?** — struktura trybu przyjęcia (obecny wykres trybu przyjęcia).
4. **Gdzie?** — województwa i miasta, także w przeliczeniu na 100 tys. mieszkańców.
5. **Wszystko o jednej grupie JGP** — strona grupy.
6. **Wszystko o jednym szpitalu** — profil i porównanie z podobnymi (już działa).

## 3. Architektura informacji

Dwa poziomy, które się uzupełniają:

```
Atlas
├─ /analizy                 Eksplorator: wspólny kontekst + widoki-pytania
│   ├─ W czasie             trend (nowy)
│   ├─ Kto leczy            wolumen × śmiertelność
│   ├─ Tryb przyjęcia       planowe / nagłe
│   └─ Gdzie                województwa, miasta
├─ /jgp/[kod]               Strona grupy JGP (nowa)
├─ /szpitale/[id]           Profil szpitala + Porównanie (dziś: zakładka w /analizy)
└─ /o-danych                Metodologia, źródła, zmiany katalogu
```

**Eksplorator** odpowiada na pytania o dowolny zakres. **Strony obiektów** odpowiadają na pytanie
„pokaż mi wszystko o X”: mają stały adres, można je linkować w artykułach i są indeksowane przez
wyszukiwarki. Statyczny eksport obsłuży je przez `generateStaticParams` (ok. 700 grup JGP,
ok. 850 świadczeniodawców).

Każdy wiersz tabeli w eksploratorze prowadzi do strony szpitala albo grupy JGP.

## 4. Eksplorator: wspólny kontekst

Kontekst ustawia się raz, na górze, i obowiązuje we wszystkich widokach:

- **Zakres JGP** — jedna lub kilka grup (wyszukiwarka po kodzie i nazwie, później także całe sekcje katalogu, np. „F — przewód pokarmowy”);
- **Obszar** — cały kraj, województwo, miasto;
- **Okres** — rok (dziś) lub zakres lat (w widoku „W czasie”).

Ustawienia zaawansowane (metoda `<5`, próg minimalnej liczby hospitalizacji, długość pobytu)
chowamy w rozwijanym panelu „Więcej filtrów”. Cały stan jest w adresie URL, więc każdy widok
da się udostępnić linkiem.

## 5. Makiety

Liczby w makietach są przykładowe.

### 5.1. Eksplorator — widok „W czasie”

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Analizy hospitalizacji                                                   │
│ [Zakres JGP: E10 Ostry zespół wieńcowy ×] [Obszar: cała Polska ▾] [2024–2025 ▾] │
│                                                         Więcej filtrów ▸ │
├──────────────────────────────────────────────────────────────────────────┤
│ W czasie │ Kto leczy │ Tryb przyjęcia │ Gdzie                            │
├──────────────────────────────────────────────────────────────────────────┤
│  Hospitalizacje 2025      Zmiana r/r      Zgony 2025      Udział nagłych │
│  8 326                    +1,1%           412             78%            │
│                                                                          │
│  Hospitalizacje miesięcznie                         [Rok ▾|Miesiąc]      │
│  ▁▂▃▃▂▂▁▁▂▃▃▄ │ ▁▂▃▃▂▂▁▂▂▃▄▄                                              │
│     2024      │     2025                                                 │
│                                                                          │
│  ⚠ Grupa F04 występuje tylko do 2024 r. (zmiana katalogu JGP).           │
└──────────────────────────────────────────────────────────────────────────┘
```

Lata, w których wybranej grupy nie ma w katalogu, są przerwą na wykresie, a nie zerem.

### 5.2. Strona grupy JGP `/jgp/E10`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ E10 · Ostry zespół wieńcowy                       produkt 5.51.01.0005010 │
│ Grupa zachowawcza · w katalogu: 2024–2025                                │
├──────────────────────────────────────────────────────────────────────────┤
│ [Trend roczny i miesięczny]          │ [Tryb przyjęcia: planowe / nagłe] │
├──────────────────────────────────────┴───────────────────────────────────┤
│ [Mapa / ranking województw na 100 tys.]                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Kto leczy najwięcej          hospitalizacje  śmiertelność  nagłe         │
│ Szpital A  →                 412             4,1%          81%           │
│ Szpital B  →                 377             3,2%          74%           │
│ Pokaż w eksploratorze →                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Wycena (planowane) · Artykuły o tej grupie (planowane)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3. Eksplorator — widok „Kto leczy”

Obecny wykres punktowy (wolumen × śmiertelność) bez zmian w logice, ale:
kontekst na górze zamiast panelu bocznego, tabela z linkami do profili, pod wykresem krótka
interpretacja („Średnia śmiertelność: …; 10 największych ośrodków ma …% hospitalizacji”).

## 6. Dane

Stan po tej zmianie (branch `feature/analizy-redesign`):

| Warstwa | Plik | Zawartość | Rozmiar |
|---|---|---|---|
| Spis lat | `public/data/hospitalizations/index.json` | lata, najnowszy rok, domyślny produkt | < 1 KB |
| 1. Trendy | `trends.json.gz` | JGP × rok × miesiąc × tryb; JGP × rok × OW × tryb | ok. 0,6 MB |
| 2. Szczegóły roku | `<rok>.json.gz` | dotychczasowy format (OW, NIP, produkt, długość, tryb) | ok. 2,7 MB / rok |
| 3. Obiekty | `jgp/<kod>.json.gz`, `szpitale/<id>.json.gz` | wszystkie lata dla jednej grupy / placówki | planowane |

- Wszystko buduje `scripts/build_hospitalizations.py` z `data/hospitalizacje_<rok>.csv`
  (`npm run refresh:data`). Dziś: 2024–2025. Dane 2025 są identyczne z dawnym `dashboard.json.gz`.
- Eksplorator ładuje tylko spis lat i szczegóły wybranego roku; trendy to jeden mały plik dla wszystkich lat.
- Przy 9 latach (2017–2025): ok. 25 MB szczegółów w osobnych plikach, trendy ok. 2–3 MB.
  Limit Cloudflare Pages (25 MB na plik, 20 000 plików) nie jest problemem.

**Zmiany katalogu JGP.** `data/kody_produktu_jgp.csv` to katalog bieżący. Kody, których w nim nie ma
(w 2024: C05H, F04, F13, F31, F32, F34, G12, G13, S51, PZF04), skrypt bierze ze słownika API statystyk
NFZ (`data/jgp_benefits_nfz.json`, 883 kody historyczne). Trendy wiedzą, w których latach dany produkt
występuje. Otwarte: mapowanie następców (np. F04 → nowe grupy), żeby trend „rodziny” był ciągły.

**Nazwy placówek.** 7 świadczeniodawców z 2024 r. nie ma w żadnym lokalnym słowniku. Dostają nazwę
zastępczą „Świadczeniodawca NIP …”. Do uzupełnienia w `data/szpitale_uzupelnienie.csv`.

## 7. Etapy

1. **Dane wieloletnie (zrobione dla 2024–2025)** — warstwy 1–2, wybór roku w obecnym dashboardzie.
2. **Widok „W czasie”** na danych z `trends.json.gz` — pierwszy wykres trendu dla wybranego zakresu JGP.
3. **Wspólny pasek kontekstu** zamiast panelu bocznego; widoki-pytania zamiast kart-wykresów.
4. **Strony `/jgp/[kod]`** (warstwa 3 danych) i linki z tabel.
5. **Profil szpitala jako `/szpitale/[id]`**; zakładka w `/analizy` przekierowuje.
6. **Kolejne lata** (2017–2023) i mapowanie zmian katalogu JGP.

Każdy etap sprawdzamy na podglądzie Cloudflare (`feature-analizy-redesign.hospitalizacje-nfz.pages.dev`).

## 8. Do decyzji

1. Czy „Kto leczy” i „Tryb przyjęcia” zostają osobnymi widokami, czy łączymy je w jeden widok z przełącznikiem miary?
2. Czy obszar (województwo) ma filtrować dane, czy tylko wyróżniać na wykresie (dziś: wyróżnia)?
3. Czy profil szpitala ma pokazywać wybrany rok? Dziś zawsze najnowszy, bo finanse i model par są liczone dla 2025.
4. Jak prezentować grupy JGP, które zmieniły się w katalogu: przerwa w trendzie czy łączenie w „rodziny”?
