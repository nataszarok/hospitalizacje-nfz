import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CHART_COLORS } from "@/lib/chartPalette";

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

  it("stałe wykresów w chartPalette.ts mają wartości tokenów z globals.css", () => {
    const tokenValue = (token: string) => globals.match(new RegExp(`${token}\\s*:\\s*(#[0-9A-Fa-f]{6})`))?.[1]?.toUpperCase();
    const pairs: [keyof typeof CHART_COLORS, string][] = [
      ["text", "--color-text"], ["textSecondary", "--color-text-secondary"], ["textTertiary", "--color-text-tertiary"],
      ["border", "--color-border"], ["borderStrong", "--color-border-strong"], ["grid", "--color-chart-grid"], ["background", "--color-background"], ["backgroundMuted", "--color-background-muted"],
      ["dataStrong", "--color-data-strong"], ["data", "--color-data"], ["dataSoft", "--color-data-soft"], ["dataMuted", "--color-data-muted"],
      ["dataFaint", "--color-data-faint"], ["signal", "--color-signal"], ["positive", "--color-positive"],
    ];
    for (const [key, token] of pairs) expect(CHART_COLORS[key], token).toBe(tokenValue(token));
  });
});

function declarations(css: string, property: string): string[] {
  return [...css.matchAll(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "g"))].map((m) => m[1].replace(/!important/, "").trim());
}

describe("tokeny kształtu", () => {
  it("border-radius używa tylko tokenów --radius-* (plakietka, kontrolka, karta, chip), 0 albo 50%", () => {
    const wrong = files.flatMap(({ name, css }) => declarations(css, "border-radius")
      .filter((value) => !value.split(/\s+/).every((part) => /^(0|50%|var\(--radius-(badge|control|card|pill)\)|var\(--[a-z-]+-radius\))$/.test(part)))
      .map((value) => `${name}: ${value}`));
    expect(wrong).toEqual([]);
  });

  it("box-shadow używa tokenów cienia; poza nimi tylko obrysy (pierścień, linia wewnętrzna)", () => {
    const wrong = files.flatMap(({ name, css }) => declarations(css, "box-shadow")
      .filter((value) => !/^(none|var\(--shadow-(soft|float)\)|inset .*|0 0 0 [\d.]+px .*|0 1px 0 .*)$/.test(value))
      .map((value) => `${name}: ${value}`));
    expect(wrong).toEqual([]);
  });
});

describe("tabele bez przewijania w poziomie (DESIGN.md 7.1)", () => {
  it("globals.css ukrywa kolumny priorytetu 3 poniżej 900 px i priorytetu 2 poniżej 640 px kontenera", () => {
    expect(globals).toMatch(/\.priority-table\s*\{[^}]*container-type:\s*inline-size/);
    expect(globals).toMatch(/@container \(max-width: 899px\)\s*\{\s*\.priority-table \.col-p3\s*\{\s*display:\s*none/);
    expect(globals).toMatch(/@container \(max-width: 639px\)\s*\{\s*\.priority-table \.col-p2\s*\{\s*display:\s*none/);
  });

  it("żadna tabela nie wymusza szerokości większej niż kontener", () => {
    // Dawne `min-width: 1280px` (porównanie JGP) i `min-width: 620px` (oddziały) dawały przewijanie w poziomie.
    // Minimalna szerokość komórki nazwy (np. 260–320 px) jest dozwolona; tabela szersza niż telefon i tablet — nie.
    const forced = files.flatMap(({ name, css }) => [...css.matchAll(/table[^{]*\{[^}]*min-width:\s*(\d{3,})px/g)]
      .filter((m) => Number(m[1]) >= 600)
      .map((m) => `${name}: ${m[1]}px`));
    expect(forced).toEqual([]);
  });

  it("jedna szerokość strony: bez dawnego obszaru roboczego 1680 px", () => {
    expect(files.filter(({ css }) => css.includes("--atlas-workspace-max")).map(({ name }) => name)).toEqual([]);
    expect(globals).toMatch(/--atlas-sidebar-width:\s*300px/);
  });
});

describe("wykresy Plotly", () => {
  it("dymek może wychodzić poza wykres: warstwy SVG Plotly nie przycinają treści (DESIGN.md 6.3)", () => {
    expect(globals).toMatch(/\.js-plotly-plot \.plotly \.main-svg\.main-svg\s*\{\s*overflow:\s*visible;/);
  });
});
