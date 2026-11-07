import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Pilnuje tokenów kolorów z globals.css (DESIGN.md, sekcja 2): jeden zestaw --color-* na :root,
// szarości tylko z rodziny z odcieniem zieleni.
const SRC = join(__dirname, "..", "..");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

const globals = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const rootTokens = new Set([...globals.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const files = cssFiles(SRC).map((path) => ({ name: relative(SRC, path), css: readFileSync(path, "utf8") }));

// Kolory danych (DESIGN.md, 2.2) — błękity, nie szarości.
const DATA_COLORS = new Set(["#E4EAF4", "#B5C7E6", "#9DB4DB"]);

// Chłodne szarości dawnego dashboardu (rodzina „#667085”): niebieskawe, mało nasycone.
function isCoolGray(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return !DATA_COLORS.has(hex) && Math.max(r, g, b) - Math.min(r, g, b) <= 45 && b > g && g >= r;
}

describe("tokeny kolorów", () => {
  it("globals.css definiuje rdzeń, dane, sygnał i plakietkę „szacunek”", () => {
    for (const token of [
      "--color-primary", "--color-text", "--color-text-secondary", "--color-text-tertiary", "--color-border", "--color-border-strong",
      "--color-data", "--color-data-strong", "--color-data-soft", "--color-data-muted", "--color-data-faint",
      "--color-signal", "--color-estimate-bg", "--color-estimate-fg", "--color-positive",
    ]) {
      expect(rootTokens).toContain(token);
    }
  });

  it("CSS używa tylko tokenów --color-* zdefiniowanych na :root", () => {
    const unknown = files.flatMap(({ name, css }) => [...css.matchAll(/var\((--color-[a-z0-9-]+)/g)]
      .map((m) => m[1]).filter((token) => !rootTokens.has(token)).map((token) => `${name}: ${token}`));
    expect(unknown).toEqual([]);
  });

  it("dawne tokeny (--primary, --text, --muted…) nie wracają", () => {
    const legacy = files.flatMap(({ name, css }) => [...css.matchAll(/var\(--(primary|data|text|muted|border|soft|sidebar|panel)\)/g)]
      .map((m) => `${name}: --${m[1]}`));
    expect(legacy).toEqual([]);
  });

  it("CSS nie zawiera chłodnych szarości dawnego dashboardu", () => {
    const grays = files.flatMap(({ name, css }) => [...css.matchAll(/#[0-9a-fA-F]{6}\b/g)]
      .map((m) => m[0].toUpperCase()).filter(isCoolGray).map((hex) => `${name}: ${hex}`));
    expect(grays).toEqual([]);
  });
});
