import type { JgpGroupFile } from "@/lib/jgpPage";

/** Szpital Wojewódzki im. M. Kopernika w Koszalinie (świadczeniodawca „OW|NIP”). */
export const KOSZALIN = "16|6691044410";

/** Miesięczne hospitalizacje jednego świadczeniodawcy w dwóch grupach JGP (wykres listy pytań o zabiegi na kręgosłupie). */
export interface ProviderGroupsSeries {
  /** Miesiące „RRRR-MM” od pierwszego roku plików grup. */
  months: string[];
  /** Kod grupy → hospitalizacje w miesiącu (ta sama długość co `months`). */
  groups: Record<string, number[]>;
}

const monthsOf = (years: string[]) => years.flatMap((year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));

/**
 * Hospitalizacje świadczeniodawcy miesiąc po miesiącu w kilku grupach JGP (pliki grup `build-data/jgp/<KOD>.json.gz`,
 * metoda min jak w aplikacji). Oś miesięcy z pierwszego pliku; pliki muszą mieć te same lata.
 */
export function providerGroupsSeries(files: readonly JgpGroupFile[], provider: string): ProviderGroupsSeries {
  if (!files.length) throw new Error("Brak plików grup");
  const years = files[0].years;
  for (const file of files) if (file.years.join() !== years.join()) throw new Error(`Inne lata w pliku ${file.jgp}`);
  const months = monthsOf(years);
  const groups: Record<string, number[]> = {};
  for (const file of files) {
    const index = file.providers.indexOf(provider);
    const values = new Array<number>(months.length).fill(0);
    if (index >= 0) for (const [p, month, , hospitalizations] of file.rows) if (p === index) values[month] += hospitalizations;
    groups[file.jgp] = values;
  }
  return { months, groups };
}
