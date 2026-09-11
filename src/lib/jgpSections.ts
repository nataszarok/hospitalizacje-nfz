export const JGP_SECTION_NAMES: Record<string, string> = {
  A: "Choroby układu nerwowego",
  B: "Choroby oczu",
  C: "Choroby twarzy, jamy ustnej, gardła, krtani, nosa i uszu",
  D: "Choroby układu oddechowego",
  E: "Choroby serca",
  F: "Choroby przewodu pokarmowego",
  G: "Choroby wątroby, dróg żółciowych, trzustki i śledziony",
  H: "Choroby układu mięśniowo-szkieletowego",
  J: "Choroby piersi, skóry i oparzenia",
  K: "Choroby układu dokrewnego",
  L: "Choroby układu moczowo-płciowego",
  M: "Choroby żeńskiego układu rozrodczego",
  N: "Położnictwo i opieka nad noworodkami",
  P: "Choroby dziecięce",
  Q: "Choroby naczyń",
  S: "Choroby układu krwiotwórczego, zatrucia i choroby zakaźne",
};

export function getJgpSection(code: string | null | undefined): string | null {
  const section = code?.trim().charAt(0).toUpperCase();
  return section && /^[A-Z]$/.test(section) ? section : null;
}

export function getJgpSectionLabel(section: string): string {
  return `${section} — ${JGP_SECTION_NAMES[section] ?? "Sekcja JGP"}`;
}
