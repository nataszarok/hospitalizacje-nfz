import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CHART_COLORS } from "@/lib/chartPalette";
import { shortenName } from "@/lib/formatters";
import { SITE_NAME } from "@/lib/site";

/**
 * Obraz podglądu linku (Open Graph / X `summary_large_image`), jeden generator dla wszystkich kart:
 * grupy JGP dziś, profile szpitali w przyszłości. Strona podaje tylko treść (`PreviewCard`), wygląd jest tutaj.
 * DESIGN.md 6.2a: podgląd nie ma legendy, więc dane rysujemy jednym błękitem w trzech stopniach jasności.
 * Płaskie kolory i paleta PNG (`sharp`): plik ok. 20–30 KB.
 */

export const PREVIEW_SIZE = { width: 1200, height: 630 } as const;
export const PREVIEW_CONTENT_TYPE = "image/png";

/** Seria wykresu słupkowego: etykiety (np. lata) i wartości od zera. Ostatni słupek jest ciemniejszy. */
export interface PreviewSeries {
  labels: string[];
  values: number[];
}

export interface PreviewCard {
  /** Etykieta nad tytułem, np. „Grupa JGP · Hospitalizacje 2017–2025”. */
  eyebrow: string;
  /** Tytuł: kod grupy albo nazwa szpitala. */
  title: string;
  /** Drugi wiersz tytułu, np. nazwa grupy. */
  subtitle?: string;
  /** Liczba kluczowa pod tytułem, np. { value: "2050", label: "hospitalizacji w 2025 r." }. */
  fact?: { value: string; label: string };
  series?: PreviewSeries;
}

// Kolory interfejsu (DESIGN.md 2.1) i motyw kafla z banera (DESIGN.md 8).
const UI = {
  primary: "#087F75",
  primaryHover: "#076B63",
  tile: "#F3F8F7",
  tileLine: "rgba(8,127,117,0.085)",
  heading: "#1C3534",
} as const;
const TILE = 40;

// Inter i Inter Tight (OFL, `src/assets/fonts/OFL.txt`) w podzbiorze łacina + łacina rozszerzona A, ok. 50 KB na plik:
// python3 -m fontTools.subset <plik>.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2009,U+2013,U+2014,U+2018-201E,U+2022,U+2026,U+2212,U+00D7" --layout-features='kern,liga,calt,tnum'
const FONT_DIR = join(process.cwd(), "src", "assets", "fonts");
let fonts: { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[] | null = null;
function previewFonts() {
  fonts ??= [
    { name: "Inter", data: readFileSync(join(FONT_DIR, "Inter-Regular.ttf")), weight: 400, style: "normal" },
    { name: "Inter", data: readFileSync(join(FONT_DIR, "Inter-Bold.ttf")), weight: 700, style: "normal" },
    { name: "Inter Tight", data: readFileSync(join(FONT_DIR, "InterTight-Regular.ttf")), weight: 400, style: "normal" },
  ];
  return fonts;
}

/** Słupki od zera; ostatni (najnowszy rok) granatem, pozostałe błękitem fartucha. Wysokości w px. */
export function previewBars(series: PreviewSeries, height: number): { label: string; height: number; color: string }[] {
  const max = Math.max(0, ...series.values);
  const last = series.values.length - 1;
  return series.values.map((value, i) => ({
    label: series.labels[i] ?? "",
    height: max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * height)) : 0,
    color: i === last ? CHART_COLORS.dataStrong : CHART_COLORS.dataSoft,
  }));
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill={UI.primary} />
        <g transform="translate(3.4 3.4) scale(1.05)" stroke="#fff" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 20.2s-7.6-4.5-8.9-9.6C2.3 7.4 4.3 4.4 7.4 4.4c1.9 0 3.5 1.1 4.6 2.7 1.1-1.6 2.7-2.7 4.6-2.7 3.1 0 5.1 3 4.3 6.2-1.3 5.1-8.9 9.6-8.9 9.6Z" />
          <path d="M3.6 12h4.2l1.6-3 2.5 6 1.9-4.1h6.6" strokeLinecap="round" />
        </g>
      </svg>
      <div style={{ display: "flex", fontFamily: "Inter Tight", fontSize: 30, letterSpacing: "-0.045em", color: CHART_COLORS.text }}>
        {SITE_NAME.replace(/\.pl$/, "")}
        <span style={{ color: CHART_COLORS.textTertiary }}>.pl</span>
      </div>
    </div>
  );
}

const CHART_HEIGHT = 280;

function BarChart({ series }: { series: PreviewSeries }) {
  const bars = previewBars(series, CHART_HEIGHT);
  const gap = bars.length > 12 ? 6 : 12;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 440 }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: CHART_HEIGHT, gap, borderBottom: `2px solid ${CHART_COLORS.borderStrong}` }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ display: "flex", flex: 1, height: bar.height, background: bar.color, borderRadius: "3px 3px 0 0" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap, marginTop: 10 }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ display: "flex", flex: 1, justifyContent: "center", fontSize: 17, color: i === bars.length - 1 ? CHART_COLORS.text : CHART_COLORS.textTertiary, fontWeight: i === bars.length - 1 ? 700 : 400 }}>
            {bars.length > 6 ? `’${bar.label.slice(-2)}` : bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Element obrazu (JSX w podzbiorze CSS Satori: tylko flexbox). */
export function previewElement(card: PreviewCard) {
  const withChart = Boolean(card.series && card.series.values.length > 1);
  const titleSize = card.title.length <= 8 ? 96 : card.title.length <= 40 ? 60 : 48;
  return (
    <div
      style={{
        display: "flex", width: "100%", height: "100%", padding: "56px 72px", fontFamily: "Inter",
        backgroundColor: UI.tile,
        backgroundImage: `linear-gradient(${UI.tileLine} 1px, transparent 1px), linear-gradient(90deg, ${UI.tileLine} 1px, transparent 1px)`,
        backgroundSize: `${TILE}px ${TILE}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, paddingRight: withChart ? 48 : 0 }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 56, fontSize: 20, fontWeight: 700, letterSpacing: "0.11em", color: UI.primaryHover, textTransform: "uppercase" }}>
          <div style={{ display: "flex", width: 30, height: 2, background: UI.primary }} />
          {card.eyebrow}
        </div>
        <div style={{ display: "flex", marginTop: 18, fontFamily: "Inter Tight", fontSize: titleSize, lineHeight: 1.04, letterSpacing: "-0.04em", color: UI.heading }}>
          {shortenName(card.title, 70)}
        </div>
        {card.subtitle && (
          <div style={{ display: "flex", marginTop: 12, fontSize: 34, lineHeight: 1.2, color: CHART_COLORS.textSecondary }}>
            {shortenName(card.subtitle, 105)}
          </div>
        )}
        {card.fact && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: "auto" }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: CHART_COLORS.dataStrong }}>{card.fact.value}</span>
            <span style={{ fontSize: 24, color: CHART_COLORS.textSecondary }}>{card.fact.label}</span>
          </div>
        )}
      </div>
      {withChart && (
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
          <BarChart series={card.series!} />
        </div>
      )}
    </div>
  );
}

/**
 * PNG 1200×630 z paletą 64 kolorów (płaskie kolory nie tracą jakości, plik jest kilka razy mniejszy).
 * Bez `sharp` (pakiet opcjonalny Next) zostaje PNG z Satori/Resvg.
 */
export async function renderPreviewPng(card: PreviewCard): Promise<Buffer> {
  const response = new ImageResponse(previewElement(card), { ...PREVIEW_SIZE, fonts: previewFonts() });
  const png = Buffer.from(await response.arrayBuffer());
  try {
    const sharp = (await import("sharp")).default;
    // Build renderuje strony w wielu procesach naraz: jeden wątek libvips na proces, inaczej procesy walczą o rdzenie.
    sharp.concurrency(1);
    return await sharp(png).png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 }).toBuffer();
  } catch {
    return png;
  }
}
