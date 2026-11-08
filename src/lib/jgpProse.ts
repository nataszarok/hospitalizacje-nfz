/**
 * Opisy grup JGP pisane prozą: `scripts/jgp_opisy/<sekcja>.tsv` (kolumny `kod`, `opis`; czyta je tylko build).
 * Każde zdanie ma pokrycie w tabelach NFZ grupy (`build-data/jgp_profiles.json.gz`), w nazwie grupy
 * albo w nazwach wariantów rodziny; kody, procenty i liczby dni sprawdza test `jgpProse.test.ts`.
 */
export function readJgpProse(files: string[]): Record<string, string> {
  const prose: Record<string, string> = {};
  for (const file of files) {
    for (const line of file.split(/\r?\n/).slice(1)) {
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const code = line.slice(0, tab).trim();
      const text = line.slice(tab + 1).trim();
      if (code && text) prose[code] = text;
    }
  }
  return prose;
}
