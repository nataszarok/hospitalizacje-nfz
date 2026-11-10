import { decodeValuations, VALUATIONS_PATH, type JgpValuation, type ValuationsFile } from "@/lib/valuations";

/**
 * Pliki strony `/szpitale` (profil i porównanie): każdy pobierany raz na wizytę. `peek` zwraca plik już pobrany
 * (np. z wyprzedzeniem po najechaniu na link, `dataPrefetch.ts`), więc strona rysuje profil w pierwszym renderze.
 */
export interface CachedResource<T> {
  load: () => Promise<T>;
  /** Plik już pobrany i rozpakowany; `null`, gdy jeszcze go nie ma. */
  peek: () => T | null;
  /** Testy: czyści pamięć. */
  reset: () => void;
}

export function cachedResource<T>(fetchValue: () => Promise<T>): CachedResource<T> {
  let promise: Promise<T> | null = null;
  let value: T | null = null;
  return {
    load() {
      if (!promise) {
        promise = fetchValue().then((result) => (value = result));
        promise.catch(() => { promise = null; });
      }
      return promise;
    },
    peek: () => value,
    reset() {
      promise = null;
      value = null;
    },
  };
}

/** JSON z odpowiedzi: plik `.json.gz` rozpakowany w przeglądarce, zwykły JSON bez zmian. */
export async function parseMaybeGzip(response: Response) {
  if (!response.ok) throw new Error(`Nie udało się pobrać danych (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzip) return JSON.parse(new TextDecoder().decode(bytes));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

const json = (path: string) => () => fetch(path, { cache: "force-cache" }).then(parseMaybeGzip) as Promise<unknown>;

/** Wyniki finansowe (profil szpitala); typ pliku zna `HospitalAnalysisTab`. */
export const financialResultsResource = cachedResource(json("/data/financial_results.json.gz"));
/** Zagregowane profile RPWDL (profil szpitala). */
export const rpwdlSummaryProfilesResource = cachedResource(json("/data/rpwdl_summary_profiles.json.gz"));
/** Pary A/B modelu podobieństwa (porównanie). */
export const peerPairsResource = cachedResource(json("/data/peer_pairs_ab.json.gz"));
/** Wyceny JGP (porównanie). */
export const jgpValuationsResource = cachedResource<JgpValuation[]>(() =>
  fetch(VALUATIONS_PATH, { cache: "force-cache" }).then(parseMaybeGzip).then((file: ValuationsFile) => decodeValuations(file)));
