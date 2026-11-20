import type { HospitalPageInput } from "@/lib/hospitalPage";
import type { HospitalStructureFile } from "@/lib/hospitalStructure";
import type { JgpGroupFile } from "@/lib/jgpPage";
import type { StaticDataset, TrendsDataset } from "@/lib/staticData";

/** Szpital karty w danych testowych (OW|NIP). Dwa lata, trzech świadczeniodawców, dwie grupy JGP. */
export const ME = "16|111";
const trends: TrendsDataset = {
  version: 1,
  years: ["2024", "2025"],
  products: [["P1", "A01", "STARA NAZWA", ["2024"]], ["P2", "A01", "ZABIEG A *", ["2025"]], ["P3", "H53", "KRĘGOSŁUP", ["2024", "2025"]]],
  monthly: [
    ["2024", 1, 0, "u", 0, 100, 0, 4],
    ["2024", 1, 2, "p", 0, 50, 0, 0],
    ["2025", 2, 0, "u", 0, 200, 0, 2],
  ],
  regional: [],
};
// Plik grupy: miesiąc = indeks roku pliku × 12 + miesiąc − 1; tryb 1 = przyjęcie nagłe.
const groupA01: JgpGroupFile = {
  version: 3, jgp: "A01", years: ["2024", "2025"],
  providers: [ME, "07|222", "16|333"],
  rows: [
    [0, 0, 1, 10, 1], [0, 0, 0, 5, 0], [0, 13, 1, 30, 2],
    [1, 0, 0, 40, 0], [1, 12, 0, 20, 0],
    [2, 12, 0, 50, 0],
  ],
  valuePln: { national: { "2025": 1000 }, providers: { "2025": [[ME, 3_000_000], ["07|222", 7_000_000]] } },
};
const groupH53: JgpGroupFile = { version: 3, jgp: "H53", years: ["2024", "2025"], providers: ["07|222"], rows: [[0, 0, 0, 9, 0]] };
const dataset = (year: string, facts: StaticDataset["facts"]): StaticDataset => ({ version: 1, analysisYear: year, defaultProductCode: "P1", products: [], regions: [], facilities: [], populations: [], facts });

/**
 * Struktura szpitala (zakładka „Struktura”): Szpitalna 1 w Katowicach (interna 10, kardiologia 50, SOR 13 łóżek, 3 poradnie)
 * i ZOL w Zabrzu (12 łóżek); lokalizacja bez łóżek Polna 3. Łóżka razem 85 = `registry.total_beds` profilu.
 */
export const structureFixture: HospitalStructureFile = {
  version: 1,
  names: { "4000": "Oddział chorób wewnętrznych", "4100": "Oddział kardiologiczny", "4902": "Szpitalny oddział ratunkowy", "5170": "Zakład/Oddział opiekuńczo-leczniczy", "1100": "Poradnia kardiologiczna", "1020": "Poradnia diabetologiczna" },
  fields: ["Choroby wewnętrzne", "Kardiologia", "Diabetologia", "Kardiologia dziecięca"],
  sites: ["Szpital Alfa w Katowicach", "Zakład Opiekuńczo-Leczniczy w Zabrzu"],
  nfzCodes: { "5170": ["5160", ""], "4902": ["3300", ""] },
  hospitals: {
    [ME]: {
      addr: [["Szpitalna 1", "Katowice"], ["Leśna 2", "Zabrze"]],
      beds: [[0, 0, "hospital_4xxx", "4000", "Klinika Chorób Wewnętrznych", 10, 0, [0]], [0, 0, "hospital_4xxx", "4100", "Oddział Kardiologii", 50, 6, [1, 0]],
        [0, 0, "emergency_department", "4902", "SOR", 13, 0, []], [1, 1, "long_term_care", "5170", "ZOL", 12, 0, []]],
      clinics: [[0, "1100", [1]], [0, "1100", [1, 3]], [0, "1020", [2]]],
      points: [["Polna 3, Katowice", ["other:Punkt pobrań"], [0]]],
    },
  },
};

export const hospitalPageInput: HospitalPageInput = {
  key: ME,
  trends,
  groupFiles: [groupA01, groupH53],
  datasets: [
    dataset("2024", [["16", "111", "P1", "1-2 dni", "2", 0, 15, 0, 1], ["16", "111", "P1", "0 dni", "6", 0, 5, 0, 0], ["07", "222", "P1", "0 dni", "6", 0, 99, 0, 0]]),
    dataset("2025", [["16", "111", "P2", "6 i więcej dni", "2", 0, 30, 0, 2]]),
  ],
  facilities: {
    index: { version: 1, years: ["2024", "2025"], facilities: [["16", "111", "SZPITAL ALFA", "KOSZALIN"], ["16", "333", "Szpital Gamma", "SŁUPSK"], ["07", "222", "Beta", "WARSZAWA"]], active: [3, 2, 1] },
    sections: [{ version: 2, products: ["P1"], rows: { product: [0, 0, 0, 0], facility: [0, 0, 1, 2], year: [0, 1, 1, 0], hMin: [15, 30, 50, 60], hSim: [0, 0, 0, 0], dMin: [0, 0, 0, 0], dSim: [0, 0, 0, 0] } }],
  },
  pszLevel: "III stopnia",
  // Sieć PSZ: szpital karty i Gamma (16|333); Beta (07|222) poza siecią.
  networkNips: new Set(["111", "333"]),
  profile: {
    oz_nfz: "16", nip: "111", core: { beds: 60, wards: [{ code: "4000", name: "Wewnętrzny", beds: 10, fields: ["Choroby wewnętrzne"] }, { code: "4100", name: "Kardiologia", beds: 50 }] },
    outpatient: { cell_count: 12, field_count: 9, location_count: 2 },
    registry: { location_count: 3, city_count: 2, total_beds: 85 },
    capabilities: { operating: { count: 1 }, sor: { count: 1, beds: 13 }, dialysis: { count: 1, stations: 18 }, poz: { count: 1 } },
  },
  locations: [["Szpitalna 1, Katowice", 70, ["hospital", "sor", "outpatient"]], ["Leśna 2, Zabrze", 15, ["long_term"]], ["Polna 3, Katowice", 0, ["other:Punkt pobrań"]]],
  financial: { nip: "111", years: [{ year: 2025, revenue: 100, net_result: 5, net_margin: null }] },
  regionName: "zachodniopomorskie",
  payment: { years: ["2025"], scopes: [["03.4000.030.02", "Choroby wewnętrzne"], ["03.4100.030.02", "Kardiologia"], ["03.4100.130.02", "Kardiologia – finansowane odrębnie"]], hosp: [[0, 0, 0, 100], [0, 1, 0, 60], [0, 2, 1, 40]], value: [[0, 2, 1, 3_000_000]] },
  rpwdlDate: "2026-09-12",
  structureFile: structureFixture,
};

