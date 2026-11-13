import type { HospitalContractsFile } from "@/lib/hospitalFinance";
import type { HospitalPaymentFile } from "@/lib/hospitalPage";

/**
 * Umowy i rozliczenia szpitala testowego (lata karty 2024–2025): ryczałt PSZ, dopłaty, pediatria i kardiologia za wykonanie,
 * program lekowy, SOR, poradnia i rehabilitacja.
 */
export const contractsFixture: HospitalContractsFile = {
  years: ["2024", "2025"],
  agreements: [[0, "03", "Leczenie szpitalne", 0, "A-24"], [1, "03", "Leczenie szpitalne", 0, "A-25"], [1, "05", "Rehabilitacja lecznicza", 0, "R-25"]],
  products: [
    ["03.0000.030.17", "RYCZAŁT PSZ - SZPITAL III STOPNIA"],
    ["00.9999.000.02", "KOSZTY ŚWIADCZEŃ WYNIKAJĄCE Z ROZPORZĄDZENIA ZMIENIAJĄCEGO OWU - PSZ"],
    ["03.4401.030.02", "PEDIATRIA - HOSPITALIZACJA"],
    ["03.4100.130.02", "KARDIOLOGIA - HOSPITALIZACJA E10, E11,E12G ,E15"],
    ["03.0001.306.02", "LEKI W PROGRAMIE LEKOWYM - LECZENIE CHORYCH NA RAKA PŁUCA"],
    ["03.3300.009.03", "ŚWIADCZENIA W SZPITALNYM ODDZIALE RATUNKOWYM (SOR)"],
    ["02.1100.001.02", "ŚWIADCZENIA W ZAKRESIE KARDIOLOGII"],
    ["05.1310.208.02", "FIZJOTERAPIA AMBULATORYJNA"],
  ],
  plans: [
    [0, 0, 1, 80_000_000], [0, 3, 1, 6_000_000],
    [1, 0, 1, 100_000_000], [1, 1, 1, 10_000_000], [1, 2, 1, 12_000_000], [1, 3, 1, 8_000_000], [1, 4, 1, 15_000_000], [1, 5, 1, 20_000_000], [1, 6, 1, 3_000_000], [2, 7, 1, 2_000_000],
  ],
};

/** Rozliczenia grup JGP w 2025 r.: kardiologia w ryczałcie (E53) i za wykonanie (E10, E53), pediatria za wykonanie (D20). */
export const paymentFixture: HospitalPaymentFile = {
  years: ["2025"],
  scopes: [["03.4100.030.02", "KARDIOLOGIA - HOSPITALIZACJA"], ["03.4100.130.02", "KARDIOLOGIA - HOSPITALIZACJA E10, E11,E12G ,E15"], ["03.4401.030.02", "PEDIATRIA - HOSPITALIZACJA"]],
  hosp: [],
  value: [[0, 0, 0, 30_000_000], [0, 1, 1, 7_000_000], [0, 2, 1, 11_000_000]],
  codes: ["D20", "E10", "E53"],
  jgp: [[0, 0, 0, 2, 30_000_000], [0, 1, 1, 1, 6_000_000], [0, 1, 1, 2, 1_000_000], [0, 2, 1, 0, 11_000_000]],
};
