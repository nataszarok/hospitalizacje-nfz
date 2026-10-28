export function formatCityName(city: string): string {
  return city
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase("pl-PL")}`,
    );
}

const integerFormat = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Liczba w skrócie: 7 832 118 → „7,8 mln”, 48 200 → „48,2 tys.”, 833 → „833”. */
export function formatCompactCount(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${compactFormat.format(value / 1_000_000)} mln`;
  if (Math.abs(value) >= 10_000) return `${compactFormat.format(value / 1_000)} tys.`;
  return integerFormat.format(value);
}
