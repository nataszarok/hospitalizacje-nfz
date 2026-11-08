import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Pilnuje skali typografii z globals.css: rozmiary i grubości tylko przez tokeny --fs-* / --fw-*.
const SRC = join(__dirname, "..", "..");
// Profil szpitala skaluje tekst do szerokości karty (clamp z jednostką cqw) — wyjątek od skali.
const FLUID_SIZE_FILES = new Set(["components/HospitalProfileSummary.css"]);

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

function declarations(css: string, property: string): string[] {
  return [...css.matchAll(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "g"))].map((m) => m[1].replace(/!important/, "").trim());
}

const globals = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const definedTokens = new Set([...globals.matchAll(/(--f[sw]-[a-z0-9]+)\s*:/g)].map((m) => m[1]));
const files = cssFiles(SRC).map((path) => ({ name: relative(SRC, path), css: readFileSync(path, "utf8") }));

describe("tokeny typografii", () => {
  it("globals.css definiuje skalę rozmiarów i cztery grubości", () => {
    for (const token of ["--fs-2xs", "--fs-xs", "--fs-sm", "--fs-md", "--fs-base", "--fs-lg", "--fs-xl", "--fs-2xl", "--fs-3xl", "--fs-title", "--fs-section", "--fs-display", "--fs-hero"]) {
      expect(definedTokens).toContain(token);
    }
    expect([...definedTokens].filter((t) => t.startsWith("--fw-")).sort()).toEqual(["--fw-bold", "--fw-medium", "--fw-regular", "--fw-semibold"]);
  });

  it("font-size w CSS używa tylko tokenów --fs-*", () => {
    // Kontrola samego testu: skaner widzi deklaracje we wszystkich plikach CSS.
    expect(files.flatMap(({ css }) => declarations(css, "font-size")).length).toBeGreaterThan(300);
    const wrong = files.flatMap(({ name, css }) => declarations(css, "font-size")
      .filter((value) => value !== "inherit" && !/^var\(--fs-[a-z0-9]+\)$/.test(value) && !(FLUID_SIZE_FILES.has(name) && value.startsWith("clamp(")))
      .map((value) => `${name}: ${value}`));
    expect(wrong).toEqual([]);
  });

  it("font-weight w CSS używa tylko tokenów --fw-*", () => {
    const wrong = files.flatMap(({ name, css }) => declarations(css, "font-weight")
      .filter((value) => value !== "inherit" && !/^var\(--fw-(regular|medium|semibold|bold)\)$/.test(value))
      .map((value) => `${name}: ${value}`));
    expect(wrong).toEqual([]);
  });

  it("CSS odwołuje się tylko do zdefiniowanych tokenów typografii", () => {
    const unknown = files.flatMap(({ name, css }) => [...css.matchAll(/var\((--f[sw]-[a-z0-9]+)\)/g)]
      .map((m) => m[1]).filter((token) => !definedTokens.has(token)).map((token) => `${name}: ${token}`));
    expect(unknown).toEqual([]);
  });

  it("krój podajemy zmienną z next/font, nie nazwą „Inter”", () => {
    const literal = files.flatMap(({ name, css }) => declarations(css, "font-family")
      .filter((value) => /(^|,\s*)["']?Inter/.test(value)).map((value) => `${name}: ${value}`));
    expect(literal).toEqual([]);
  });
});
