import { formatJgpName, formatYearRange } from "@/lib/formatters";
import { limitToCatalogYears, monthYears, sumByYear } from "@/lib/jgpCard";
import type { JgpPageData } from "@/lib/jgpPage";
import type { PreviewCard } from "@/lib/socialPreview";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

/** Treść obrazu podglądu karty grupy: hospitalizacje w kraju w latach grupy w katalogu (jak wykres „Ile?” w latach). */
export function jgpPreviewCard(data: JgpPageData): PreviewCard {
  const limited = limitToCatalogYears(data);
  const { years } = monthYears(limited.months);
  const values = sumByYear(limited.months, limited.national.hospitalizations);
  const lastYear = years.at(-1) ?? data.year;
  const lastValue = values.at(-1) ?? data.hospitalizations;
  return {
    eyebrow: `Grupa JGP · hospitalizacje ${formatYearRange(years[0] ?? lastYear, lastYear)}`,
    title: data.jgpCode,
    subtitle: formatJgpName(data.name),
    fact: { value: integer(lastValue), label: `hospitalizacji w ${lastYear} r.` },
    series: years.length > 1 ? { labels: years, values } : undefined,
  };
}

/** Tekst alternatywny obrazu: to samo co na obrazie, słowami. */
export function jgpPreviewAlt(card: PreviewCard): string {
  const range = card.series ? `${card.series.labels[0]}–${card.series.labels.at(-1)}` : null;
  return `${card.title} ${card.subtitle ?? ""}: ${card.fact?.value ?? ""} ${card.fact?.label ?? ""}${range ? `; wykres słupkowy hospitalizacji w latach ${range}` : ""}.`.replace(/\s+/g, " ");
}
