import { formatCityName } from "@/lib/formatters";
import type { StaticDataset } from "@/lib/staticData";
import type { ReferencePayload } from "@/lib/types";

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

/** Najwięcej obszarów wybranych naraz (kolory wyróżnień na wykresach i mapie). */
export const MAX_AREAS = 5;

/** Wartość adresu i pola wyboru dla listy obszarów (pusta lista = cała Polska). */
export const areasToValues = (areas: AnalysisArea[]) => areas.filter((area) => area.kind !== "country").map(areaToValue);

export function areasFromValues(values: string[]): AnalysisArea[] {
  const seen = new Set<string>();
  return values.map(areaFromValue).filter((area) => {
    const value = areaToValue(area);
    if (area.kind === "country" || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, MAX_AREAS);
}

/** Obszary istniejące w słowniku danego roku (pozostałe wypadają). */
export function validAreas(areas: AnalysisArea[], reference: ReferencePayload): AnalysisArea[] {
  return areas.map((area) => validArea(area, reference)).filter((area) => area.kind !== "country");
}

/** Opis listy obszarów, np. „woj. mazowieckie, Kraków”; pusta lista = „cała Polska”. */
export function areasLabel(areas: AnalysisArea[], reference: Pick<ReferencePayload, "regions">): string {
  return areas.length ? areas.map((area) => areaLabel(area, reference)).join(", ") : "cała Polska";
}

/** Czy świadczeniodawca (OW NFZ, miasto siedziby) należy do obszaru. */
export function inArea(area: AnalysisArea, row: { owNfz: string; city: string }): boolean {
  if (area.kind === "region") return row.owNfz === area.owNfz;
  if (area.kind === "city") return row.city.trim() === area.city;
  return true;
}

/** Jak `areaMatcher`, ale dla kilku obszarów naraz: świadczeniodawca należy do któregokolwiek; pusta lista = cały kraj. */
export function areasMatcher(d: StaticDataset, areas: AnalysisArea[] | undefined): ((ow: string, nip: string) => boolean) | null {
  const matchers = (areas ?? []).map((area) => areaMatcher(d, area)).filter((match): match is (ow: string, nip: string) => boolean => match !== null);
  if (!matchers.length) return null;
  return (ow, nip) => matchers.some((match) => match(ow, nip));
}
