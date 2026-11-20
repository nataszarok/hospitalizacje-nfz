import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DESIGN.md 7.1: każda tabela ma przyklejone nazwy kolumn. Tabela na stronie — klasa `sticky-head` (globals.css);
 * tabela w pudełku z własnym przewijaniem — nagłówek u góry pudełka (`.table-wrap`, `scrollTable` i in.).
 */
const ROOT = join(__dirname, "..", "..");
/** Pudełka z własnym przewijaniem: nagłówek przyklejony u góry pudełka (globalne `th { position: sticky; top: 0 }` albo reguła modułu). */
const SCROLL_BOXES = ["table-wrap", "scrollTable", "hospital-peer-group-table-wrap", "hospital-jgp-table-scroll"];
/** Mapa ciepła (`heatWrap`): wykres w formie tabeli (16 województw), przezroczyste nagłówki lat nad pasem roku. */
const CHART_TABLES = ["heatWrap"];
/** Wyjątki z powodem. */
const EXCEPTIONS: Record<string, string> = {
  "components/ChartTooltip.tsx": "tabela w dymku wykresu, kilka wierszy",
  "components/HospitalAnalysisTab.tsx": "widok Profil bez strony (zostaje w kodzie)",
  "components/jgp/JgpCatalog.tsx": "własny przyklejony nagłówek z tytułem tabeli (JgpCatalog.module.css)",
  "components/hospitals/HospitalCatalog.tsx": "tabela katalogu JGP (JgpCatalog.module.css): ten sam przyklejony nagłówek",
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "__tests__") return [];
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("przyklejone nazwy kolumn we wszystkich tabelach", () => {
  it("każda tabela: `sticky-head` albo pudełko z własnym przewijaniem (lub wyjątek z powodem)", () => {
    const missing: string[] = [];
    for (const path of files(join(ROOT, "components"))) {
      const name = relative(ROOT, path);
      if (EXCEPTIONS[name]) continue;
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/<table[\s>]/.test(line)) return;
        const context = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
        if (line.includes("sticky-head") || SCROLL_BOXES.some((box) => context.includes(box)) || CHART_TABLES.some((box) => context.includes(box))) return;
        missing.push(`${name}:${i + 1}`);
      });
    }
    expect(missing).toEqual([]);
  });
});
