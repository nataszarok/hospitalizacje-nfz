# Hospitalizacje NFZ

Interaktywny dashboard do eksploracji danych o hospitalizacjach w
Polsce.

Aplikacja pozwala analizować wolumen hospitalizacji i śmiertelność w
przekroju świadczeniodawców, produktów JGP oraz geografii.

## Co można sprawdzić?

Dashboard umożliwia m.in.:

-   porównywanie liczby hospitalizacji pomiędzy świadczeniodawcami,
-   analizę śmiertelności,
-   analizę hospitalizacji w przeliczeniu na 100 000 mieszkańców,
-   wybór i porównywanie produktów JGP,
-   wyróżnianie województw i miast,
-   filtrowanie wyników według wybranych parametrów.

Wartości źródłowe oznaczone jako `<5` mogą być analizowane z
wykorzystaniem dostępnych w aplikacji metod estymacji.

## Dane

Dashboard wykorzystuje dane dotyczące hospitalizacji rozliczonych przez
NFZ oraz dane ludności województw publikowane przez GUS.

Jednostką świadczeniodawcy jest unikalne połączenie województwa NFZ i
NIP.

Wskaźnik hospitalizacji na 100 000 mieszkańców wykorzystuje ludność
województwa przypisanego do świadczeniodawcy. Nie jest to wskaźnik
oparty na miejscu zamieszkania pacjenta.

## Interpretacja

Dashboard służy do eksploracji i porównywania zagregowanych danych
hospitalizacyjnych.

Prezentowane wyniki należy interpretować w kontekście zakresu i
charakteru danych źródłowych. Aplikacja nie powinna być traktowana jako
samodzielne narzędzie do oceny jakości pojedynczego świadczeniodawcy.

## Status

Projekt jest rozwijanym MVP.
