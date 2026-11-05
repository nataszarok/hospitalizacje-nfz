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

/** Zakres lat: „2025” dla jednego roku, „2019–2025” dla wielu. */
export function formatYearRange(from: string, to: string): string {
  return from === to ? from : `${from}–${to}`;
}

/**
 * Nazwa grupy JGP do zdania: „USUNIĘCIE ZAĆMY - KATEGORIA II *” → „Usunięcie zaćmy - kategoria II”.
 * Liczby rzymskie zostają wielkie; samo „I” tylko na końcu nazwy (w środku to spójnik „i”).
 */
export function formatJgpName(name: string): string {
  const lower = name.replace(/\s*\*\s*$/, "").trim().toLocaleLowerCase("pl-PL")
    .replace(/(^|[\s(])(ii|iii|iv|v|vi|vii|viii|ix|x)(?=$|[\s),.])/g, (_, before: string, roman: string) => `${before}${roman.toUpperCase()}`)
    .replace(/\si$/, " I");
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}
