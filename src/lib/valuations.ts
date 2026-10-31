/** Katalog wycen JGP z `scripts/build_valuations.py` (punkty za grupę). */
export const VALUATIONS_PATH = "/data/wyceny_jgp_2025.json.gz";

export interface JgpValuation {
  kod_jgp: string;
  kod_produktu?: string;
  pkt_hospitalizacja: number | null;
  pkt_hospitalizacja_planowa?: number | null;
  pkt_jeden_dzien?: number | null;
  dni_finansowane_grupa?: number | null;
  pkt_przyjecie_wypis_ten_sam_dzien?: number | null;
  pkt_hospitalizacja_1_dniowa?: number | null;
  pkt_hospitalizacja_2_dniowa?: number | null;
  pkt_osobodzien_ponad_ryczalt?: number | null;
}

/** Plik w formacie krotek: kolejność wartości w wierszu jak w `fields`. */
export interface ValuationsFile {
  version: 2;
  year: string;
  source: string;
  fields: (keyof JgpValuation)[];
  rows: (string | number | null)[][];
}

/** Zamienia krotki z pliku na rekordy z nazwanymi polami. */
export function decodeValuations(file: ValuationsFile): JgpValuation[] {
  return file.rows.map((row) => Object.fromEntries(file.fields.map((field, i) => [field, row[i] ?? null])) as unknown as JgpValuation);
}
