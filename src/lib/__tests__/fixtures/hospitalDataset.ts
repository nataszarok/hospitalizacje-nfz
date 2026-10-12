import type { hospitalDirectoryFromDataset } from "@/lib/staticData";

export type HospitalDatasetFixture = Parameters<typeof hospitalDirectoryFromDataset>[0];

/** Mały, deterministyczny zbiór z różnymi metodami NFZ i profilami RPWDL. */
export function hospitalDataset(): HospitalDatasetFixture {
  return {
    version: 1,
    analysisYear: "2024",
    defaultProductCode: "P1",
    products: [
      ["P1", "A01", "Interna"],
      ["P2", "B02", "Chirurgia *"],
      ["P3", "C03", "Badanie bez wolumenu"],
    ],
    regions: [["07", "Mazowieckie"], ["12", "Małopolskie"]],
    facilities: [
      ["07", "111-111", "Szpital docelowy", "Warszawa"],
      ["07", "222", "Szpital podobny", "Radom"],
      ["12", "333", "Szpital średni", "Kraków"],
      ["12", "444", "Mała placówka", "Tarnów"],
      ["07", "555", "Bez danych RPWDL", "Płock"],
      ["07", "666", "Bez hospitalizacji", "Siedlce"],
    ],
    populations: [["07", 1_000_000], ["12", 500_000]],
    facts: [
      // OW, NIP, produkt, długość, tryb, hospitalizacje SIM/MIN, zgony SIM/MIN.
      ["07", "111-111", "P1", "0-1", "6", 100, 90, 10, 9],
      ["07", "111-111", "P1", "2-3", "2", 36, 30, 4, 3],
      ["07", "111-111", "P2", "0-1", "9", 40, 30, 0, 0],
      ["07", "222", "P1", "0-1", "6", 110, 100, 6, 5],
      ["07", "222", "P2", "2-3", "3", 50, 40, 3, 2],
      ["12", "333", "P1", "0-1", "6", 65, 60, 7, 6],
      ["12", "333", "P2", "2-3", "3", 20, 20, 0, 0],
      ["12", "444", "P1", "0-1", "6", 9, 9, 0, 0],
      ["07", "555", "P1", "0-1", "6", 120, 120, 4, 4],
    ],
  };
}

export const hospitalRpwdl = {
  "111111": {
    liczba_komorek: 12,
    liczba_poradni: 4,
    oddzialy: [
      { kod: "4000", nazwa: "Oddział chorób wewnętrznych", lozka: 100 },
      { kod: "4500", nazwa: "Oddział chirurgii", lozka: 40 },
      { kod: "5160", nazwa: "Zakład opiekuńczo-leczniczy", lozka: 200 },
      { kod: "4300", nazwa: "Rehabilitacja", lozka: 20 },
    ],
    poradnie: [{ kod: "1000", nazwa: "Poradnia internistyczna" }],
  },
  "222": {
    liczba_komorek: 10,
    liczba_poradni: 3,
    oddzialy: [
      { kod: "4000", nazwa: "Oddział chorób wewnętrznych", lozka: 90 },
      { kod: "4500", nazwa: "Oddział chirurgii", lozka: 35 },
      { kod: "5160", nazwa: "Zakład opiekuńczo-leczniczy", lozka: 100 },
      { kod: "4300", nazwa: "Rehabilitacja", lozka: 20 },
    ],
    poradnie: [{ kod: "1000", nazwa: "Poradnia internistyczna" }],
  },
  "333": {
    liczba_komorek: 8,
    liczba_poradni: 2,
    oddzialy: [{ kod: "4000", nazwa: "Oddział chorób wewnętrznych", lozka: 60 }],
    poradnie: [],
  },
} satisfies NonNullable<Parameters<typeof import("@/lib/staticData").hospitalPeerBenchmarkFromDataset>[3]>;
