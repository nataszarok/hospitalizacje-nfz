#!/usr/bin/env python3
"""Build the decorative hero graphic for the homepage from real data.

Each dot is one provider (OW NFZ + NIP): x = hospitalizations (log scale),
y = share of urgent admissions, dot size = volume. The axis is deliberately
neutral (no mortality), because the graphic is decorative and should not suggest
a finding. No text, no external assets — the graphic is our own work.

Default input:
  public/data/dashboard.json.gz
Default output:
  public/images/hero-data.svg
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

W, H = 1600, 1000
X0, X1 = 160, 1420          # obszar wykresu w poziomie (z zapasem na duże kropki)
Y0, Y1 = 820, 190           # 0% przyjęć nagłych na dole, 100% u góry
LOG_MIN, LOG_MAX = math.log10(200), math.log10(120_000)
URGENT_ADMISSIONS = {"2", "3"}  # jak w admissionsFromDataset
PLANNED_ADMISSIONS = {"6"}
MIN_HOSPITALIZATIONS = 200
TEAL = "#087F75"


def _jitter(key: str, scale: float) -> float:
    # Stałe przesunięcie (bez losowości), żeby plik był identyczny przy każdym budowaniu.
    digest = hashlib.sha1(key.encode()).digest()
    return (digest[0] / 255 - 0.5) * scale


def providers(dataset: dict) -> list[tuple[str, float, float]]:
    hosp: dict[str, float] = defaultdict(float)
    urgent: dict[str, float] = defaultdict(float)
    planned: dict[str, float] = defaultdict(float)
    for ow, nip, _product, _duration, admission, h_sim, _h_min, _d_sim, _d_min in dataset["facts"]:
        key = f"{ow}|{nip}"
        hosp[key] += h_sim
        if admission in URGENT_ADMISSIONS:
            urgent[key] += h_sim
        elif admission in PLANNED_ADMISSIONS:
            planned[key] += h_sim
    return sorted(
        (
            (key, h, urgent[key] / (urgent[key] + planned[key]) * 100)
            for key, h in hosp.items()
            if h >= MIN_HOSPITALIZATIONS and urgent[key] + planned[key] > 0
        ),
        key=lambda item: -item[1],  # duże kropki pod spodem
    )


def _x(h: float) -> float:
    t = (math.log10(h) - LOG_MIN) / (LOG_MAX - LOG_MIN)
    return X0 + (X1 - X0) * min(max(t, 0.0), 1.0)


def _y(urgent_share: float) -> float:
    return Y0 + (Y1 - Y0) * urgent_share / 100


def build_svg(dataset: dict) -> str:
    rows = providers(dataset)
    max_h = rows[0][1] if rows else 1
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">',
        "<defs>",
        '<radialGradient id="halo" cx=".62" cy=".5" r=".6">'
        '<stop offset="0" stop-color="#ffffff" stop-opacity=".75"/>'
        '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>',
        "</defs>",
        f'<rect width="{W}" height="{H}" fill="url(#halo)"/>',
    ]
    # Delikatna siatka: poziome linie co 25 p.p., pionowe co rząd wielkości.
    for m in range(0, 101, 25):
        y = _y(m)
        out.append(f'<line x1="{X0}" y1="{y:.1f}" x2="{X1}" y2="{y:.1f}" stroke="{TEAL}" stroke-opacity=".08" stroke-width="1.5"/>')
    for h in (1_000, 10_000, 100_000):
        x = _x(h)
        out.append(f'<line x1="{x:.1f}" y1="{Y1}" x2="{x:.1f}" y2="{Y0}" stroke="{TEAL}" stroke-opacity=".08" stroke-width="1.5"/>')
    for key, h, m in rows:
        r = 3.2 + 15 * math.sqrt(h / max_h)
        opacity = 0.22 + 0.33 * math.sqrt(h / max_h)
        x = _x(h) + _jitter(key + "x", 6)
        y = _y(m) + _jitter(key + "y", 4)
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{TEAL}" fill-opacity="{opacity:.2f}"/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="public/data/dashboard.json.gz")
    parser.add_argument("--output", default="public/images/hero-data.svg")
    args = parser.parse_args()

    with gzip.open(args.input, "rt", encoding="utf-8") as fh:
        dataset = json.load(fh)
    svg = build_svg(dataset)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(svg, encoding="utf-8")
    print(f"Wrote {output} ({len(svg) / 1024:.1f} KiB, {len(providers(dataset))} providers).")


if __name__ == "__main__":
    main()
