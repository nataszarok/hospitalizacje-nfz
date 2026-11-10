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

/**
 * Dolna granica liczby w skrócie, dla szacunków konserwatywnych (metoda min): 49 613 383 → „ponad 49 mln”,
 * 48 200 → „ponad 48 tys.”, 833 → „833”. Część jednostki obcinamy w dół, więc „ponad” jest zawsze prawdą.
 */
export function formatAtLeastCount(value: number): string {
  if (value >= 1_000_000) return `ponad ${integerFormat.format(Math.floor(value / 1_000_000))} mln`;
  if (value >= 10_000) return `ponad ${integerFormat.format(Math.floor(value / 1_000))} tys.`;
  return integerFormat.format(value);
}

/**
 * Różnica ze znakiem i polskim minusem „−”, 1 miejsce po przecinku: 5.74 → „+5,7”, −1.2 → „−1,2”, 0 → „0,0”.
 * `unit` dopisujemy po liczbie, np. „ pp”.
 */
export function formatSigned(value: number, unit = ""): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${compactFormat.format(Math.abs(value))}${unit}`;
}

const oneDecimalFormat = compactFormat;

/**
 * Jednostka kwot w zł (DESIGN.md 3.1): tys. zł bez miejsc dziesiętnych; mln zł z 1 miejscem poniżej 100 mln,
 * bez miejsc od 100 mln; mld zł z 1 miejscem.
 */
export interface PlnScale {
  unit: "tys. zł" | "mln zł" | "mld zł";
  /** Sama liczba w jednostce, z polskim minusem: 1 403 200 000 → „1,4”. */
  format: (value: number) => string;
}

const PLN_DIVISORS: Record<PlnScale["unit"], number> = {
  "tys. zł": 1_000,
  "mln zł": 1_000_000,
  "mld zł": 1_000_000_000,
};

function plnUnit(abs: number): PlnScale["unit"] {
  // Próg liczymy po zaokrągleniu: 999,6 mln to już „1,0 mld zł”, nie „1 000 mln zł”.
  if (Math.round(abs / 1_000_000) >= 1_000) return "mld zł";
  if (Math.round(abs / 1_000) >= 1_000) return "mln zł";
  return "tys. zł";
}

/** Miejsca dziesiętne jednostki: mln od 100 (po zaokrągleniu do 1 miejsca) bez miejsc, „99,96 mln” → „100 mln”. */
function plnFormat(unit: PlnScale["unit"], maxAbs: number): Intl.NumberFormat {
  if (unit === "tys. zł") return integerFormat;
  if (unit === "mln zł" && Math.round(maxAbs / 100_000) >= 1_000) return integerFormat;
  return oneDecimalFormat;
}

/**
 * Wspólna jednostka dla zestawu kwot (słupki, kolumna tabeli, oś): jednostkę i miejsca dziesiętne
 * dobiera największa wartość. Jednostka idzie do podpisu lub nagłówka, w komórkach same liczby z `format`.
 */
export function plnScale(values: readonly number[]): PlnScale {
  const maxAbs = Math.max(0, ...values.map((value) => Math.abs(value)));
  const unit = plnUnit(maxAbs);
  const divisor = PLN_DIVISORS[unit];
  const format = plnFormat(unit, maxAbs);
  return { unit, format: (value) => `${value < 0 ? "−" : ""}${format.format(Math.abs(value) / divisor)}` };
}

/** Kwota w zł w skrócie: 1 403 200 000 → „1,4 mld zł”, 274 400 000 → „274 mln zł”, 38 210 000 → „38,2 mln zł”, 450 400 → „450 tys. zł”. */
export function formatPln(value: number): string {
  const scale = plnScale([value]);
  return `${scale.format(value)} ${scale.unit}`;
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
  const lower = name.replace(/(\s*\*)+\s*$/, "").trim().toLocaleLowerCase("pl-PL")
    .replace(/(^|[\s(])(ii|iii|iv|v|vi|vii|viii|ix|x)(?=$|[\s),.])/g, (_, before: string, roman: string) => `${before}${roman.toUpperCase()}`)
    .replace(/\si$/, " I");
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}

/** Długa nazwa skrócona do `max` znaków na granicy słowa, z „…” (pełną nazwę pokazuj w dymku). */
export function shortenName(name: string, max = 48): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:(\-–]+$/, "")}…`;
}
