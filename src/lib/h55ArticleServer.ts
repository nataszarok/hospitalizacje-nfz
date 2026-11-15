import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildH55ArticleData, type H55ArticleData, type H55ArticleFile, type ValuationPoints } from "@/lib/h55Article";
import { readJgpGroupFileFromDisk, readValuationsFromDisk } from "@/lib/staticDataServer";
import type { FacilityYearsIndex } from "@/lib/regions";

// Odczyt podczas budowania (statyczny eksport); tylko dla komponentów serwerowych.
const ARTICLE_FILE = join(process.cwd(), "build-data", "articles", "h55.json.gz");
const FACILITY_INDEX = join(process.cwd(), "public", "data", "hospitalizations", "facilities", "index.json");

export async function readH55ArticleFileFromDisk(file = ARTICLE_FILE): Promise<H55ArticleFile> {
  return JSON.parse(gunzipSync(await readFile(file)).toString("utf8")) as H55ArticleFile;
}

/** Nazwy placówek z indeksu placówek: „OW|NIP” → [nazwa, miejscowość]. */
export async function readFacilityNamesFromDisk(file = FACILITY_INDEX): Promise<Map<string, [string, string]>> {
  const index = JSON.parse(await readFile(file, "utf8")) as FacilityYearsIndex;
  return new Map(index.facilities.map(([ow, nip, name, city]) => [`${ow}|${nip}`, [name, city]]));
}

/**
 * Dane artykułu „H55. Historia jednego kodu” gotowe dla strony: plik artykułu, nazwy placówek, kwoty rozliczone za H55
 * (`valuePln` pliku grupy H55) i wycena H55 z katalogu JGP w serwisie (ostatni rok grupy).
 */
export async function readH55ArticleDataFromDisk(): Promise<H55ArticleData> {
  const [file, names, group, valuations] = await Promise.all([
    readH55ArticleFileFromDisk(), readFacilityNamesFromDisk(), readJgpGroupFileFromDisk("H55"), readValuationsFromDisk(),
  ]);
  if (!group?.valuePln) throw new Error("Brak kwot rozliczonych za H55 w build-data/jgp/H55.json.gz");
  const h55 = valuations.rows.find((row) => row.kod_jgp === "H55");
  if (!h55?.pkt_hospitalizacja) throw new Error(`Brak wyceny H55 w katalogu ${valuations.year}`);
  const points: ValuationPoints = {
    hospitalizacja: h55.pkt_hospitalizacja,
    planowa: h55.pkt_hospitalizacja_planowa ?? undefined,
    jeden_dzien: h55.pkt_jeden_dzien ?? undefined,
    zero_dni: h55.pkt_przyjecie_wypis_ten_sam_dzien ?? undefined,
    jeden_dzien_pobytu: h55.pkt_hospitalizacja_1_dniowa ?? undefined,
    dwa_dni_pobytu: h55.pkt_hospitalizacja_2_dniowa ?? undefined,
  };
  return buildH55ArticleData(file, names, group.valuePln, { year: valuations.year, points });
}
