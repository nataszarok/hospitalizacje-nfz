import { formatCityName } from "@/lib/formatters";
import type { StaticDataset } from "@/lib/staticData";
import type { EstimationMethod, ReferencePayload } from "@/lib/types";

/**
 * Obszar analizy: cały kraj, województwo (OW NFZ świadczeniodawcy) albo miasto (siedziba świadczeniodawcy).
 * Obszar filtruje dane we wszystkich widokach eksploratora.
 */
export type AnalysisArea =
  | { kind: "country" }
  | { kind: "region"; owNfz: string }
  | { kind: "city"; city: string };

export const COUNTRY_AREA: AnalysisArea = { kind: "country" };

/** Wartość pola wyboru: `pl`, `ow:07`, `c:KRAKÓW`. */
export function areaToValue(area: AnalysisArea): string {
  if (area.kind === "region") return `ow:${area.owNfz}`;
  if (area.kind === "city") return `c:${area.city}`;
  return "pl";
}

export function areaFromValue(value: string | null | undefined): AnalysisArea {
  if (value?.startsWith("ow:") && value.length > 3) return { kind: "region", owNfz: value.slice(3) };
  if (value?.startsWith("c:") && value.length > 2) return { kind: "city", city: value.slice(2) };
  return COUNTRY_AREA;
}

export function sameArea(a: AnalysisArea, b: AnalysisArea) {
  return areaToValue(a) === areaToValue(b);
}

/** Obszar istnieje w słowniku danego roku; w przeciwnym razie cały kraj. */
export function validArea(area: AnalysisArea, reference: ReferencePayload): AnalysisArea {
  if (area.kind === "region") return reference.regions.some((region) => region.owNfz === area.owNfz) ? area : COUNTRY_AREA;
  if (area.kind === "city") return reference.cities.includes(area.city) ? area : COUNTRY_AREA;
  return area;
}

export function areaLabel(area: AnalysisArea, reference: Pick<ReferencePayload, "regions">): string {
  if (area.kind === "region") {
    const name = reference.regions.find((region) => region.owNfz === area.owNfz)?.name ?? area.owNfz;
    return `woj. ${name.toLocaleLowerCase("pl-PL")}`;
  }
  if (area.kind === "city") return formatCityName(area.city);
  return "cała Polska";
}

/** Funkcja (OW, NIP) → czy świadczeniodawca należy do obszaru; `null` = cały kraj, bez filtrowania. */
export function areaMatcher(d: StaticDataset, area: AnalysisArea | undefined): ((ow: string, nip: string) => boolean) | null {
  if (!area || area.kind === "country") return null;
  if (area.kind === "region") return (ow) => ow === area.owNfz;
  const inCity = new Set(d.facilities.filter(([, , , city]) => city.trim() === area.city).map(([ow, nip]) => `${ow}|${nip}`));
  return (ow, nip) => inCity.has(`${ow}|${nip}`);
}

/**
 * Województwo (OW NFZ), w którym świadczeniodawcy z danego miasta mają najwięcej hospitalizacji wybranych produktów.
 * Trend miesięczny nie ma podziału na miasta, więc dla miasta pokazujemy to województwo. `null` = brak danych.
 */
export function dominantRegionForCity(d: StaticDataset, city: string, productCodes: string[], method: EstimationMethod): string | null {
  const inCity = areaMatcher(d, { kind: "city", city });
  if (!inCity) return null;
  const selected = new Set(productCodes);
  const totals = new Map<string, number>();
  for (const [ow, nip, product, , , hSim, hMin] of d.facts) {
    if ((selected.size && !selected.has(product)) || !inCity(ow, nip)) continue;
    totals.set(ow, (totals.get(ow) ?? 0) + (method === "sim" ? hSim : hMin));
  }
  const best = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? best[0] : null;
}
