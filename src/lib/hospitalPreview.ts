import { formatCityName, formatYearRange } from "@/lib/formatters";
import type { FacilityYearsIndex, FacilityYearsSection } from "@/lib/regions";
import type { PreviewCard } from "@/lib/socialPreview";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

/** Dane obrazu podglądu karty szpitala: tożsamość i hospitalizacje szpitala w kolejnych latach. */
export interface HospitalPreviewInput {
  name: string;
  city: string;
  region: string;
  years: string[];
  /** Hospitalizacje w latach `years` (metoda min, jak nagłówek karty). */
  hospitalizations: number[];
}

/**
 * Dane obrazu z plików placówek (`facilities/`): suma hospitalizacji (min) wszystkich produktów placówki w roku.
 * Te same liczby co nagłówek karty (pliki grup), ale bez części wszystkich kart: obraz buduje się w osobnym pakiecie
 * trasy, a druga kopia części kart w workerze przekracza limit pamięci buildu. `null`, gdy placówki nie ma w indeksie.
 */
export function hospitalPreviewInput(key: string, index: FacilityYearsIndex, sections: FacilityYearsSection[], region: string): HospitalPreviewInput | null {
  const [owNfz, nip] = key.split("|");
  const facility = index.facilities.findIndex(([ow, n]) => ow === owNfz && n === nip);
  if (facility < 0) return null;
  const hospitalizations = index.years.map(() => 0);
  for (const { rows } of sections) {
    rows.facility.forEach((value, i) => {
      if (value === facility) hospitalizations[rows.year[i]] += rows.hMin[i];
    });
  }
  const [, , name, city] = index.facilities[facility];
  return { name: name.trim(), city, region, years: index.years, hospitalizations };
}

/**
 * Treść obrazu podglądu karty szpitala: hospitalizacje szpitala w latach (jak „Hospitalizacje” w nagłówku karty).
 * Lata przed pierwszą hospitalizacją pomijamy (szpital mógł zacząć później); liczba kluczowa to ostatni rok z hospitalizacjami.
 */
export function hospitalPreviewCard(data: HospitalPreviewInput): PreviewCard {
  const first = data.hospitalizations.findIndex((value) => value > 0);
  const start = first < 0 ? Math.max(0, data.years.length - 1) : first;
  const years = data.years.slice(start);
  const values = data.hospitalizations.slice(start);
  let last = values.length - 1;
  while (last > 0 && !values[last]) last -= 1;
  const place = [formatCityName(data.city), data.region ? `woj. ${data.region}` : ""].filter(Boolean).join(" · ");
  return {
    eyebrow: `Szpital · hospitalizacje ${formatYearRange(years[0] ?? "", years.at(-1) ?? "")}`,
    title: data.name,
    subtitle: place || undefined,
    fact: { value: integer(values[last] ?? 0), label: `hospitalizacji w ${years[last] ?? ""} r.` },
    series: years.length > 1 ? { labels: years, values } : undefined,
  };
}

/** Tekst alternatywny obrazu: to samo co na obrazie, słowami. */
export function hospitalPreviewAlt(card: PreviewCard): string {
  const range = card.series ? `${card.series.labels[0]}–${card.series.labels.at(-1)}` : null;
  return `${card.title}${card.subtitle ? `, ${card.subtitle}` : ""}: ${card.fact?.value ?? ""} ${card.fact?.label ?? ""}${range ? `; wykres słupkowy hospitalizacji w latach ${range}` : ""}.`.replace(/\s+/g, " ");
}
