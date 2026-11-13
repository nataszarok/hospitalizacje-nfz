import type { HospitalPageInput } from "@/lib/hospitalPage";
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
  profile: { oz_nfz: "16", nip: "111", core: { beds: 60, wards: [{ code: "4000", name: "Wewnętrzny", beds: 10, fields: ["Choroby wewnętrzne"] }, { code: "4100", name: "Kardiologia", beds: 50 }] } },
  financial: { nip: "111", years: [{ year: 2025, revenue: 100, net_result: 5, net_margin: null }] },
  regionName: "zachodniopomorskie",
  payment: { years: ["2025"], scopes: [["03.4000.030.02", "Choroby wewnętrzne"], ["03.4100.030.02", "Kardiologia"], ["03.4100.130.02", "Kardiologia – finansowane odrębnie"]], hosp: [[0, 0, 0, 100], [0, 1, 0, 60], [0, 2, 1, 40]], value: [[0, 2, 1, 3_000_000]] },
  rpwdlDate: "2026-09-12",
};

