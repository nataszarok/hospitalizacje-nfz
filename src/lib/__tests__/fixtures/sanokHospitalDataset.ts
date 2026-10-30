import type { SanokHospitalDataset } from "@/lib/sanokHospital";

export const sanokHospitalDataset: SanokHospitalDataset = {
  facility: {
    name: "SP ZOZ w Sanoku",
    fullName: "Samodzielny Publiczny Zespół Opieki Zdrowotnej w Sanoku",
    nip: "6871640438",
    providerCode: "09R/010019",
    address: "ul. 800-lecia 26, Sanok",
  },
  fields: ["year", "department", "code", "patients", "value", "hospMin", "hospMax", "longStayMin"],
  hospitalizationYears: [2024, 2025],
  partialYears: [2026],
  departments: [
    { code: "03.4000.030.02", name: "Choroby wewnętrzne", ward: 0 },
    { code: "03.4100.030.02", name: "Kardiologia", ward: 1 },
    { code: "03.4580.030.02", name: "Ortopedia i traumatologia narządu ruchu", ward: 2 },
    { code: "03.4580.600.02", name: "Ortopedia – dzieci do 18 r.ż. (poza PSZ)", ward: 2 },
  ],
  wards: [
    { name: "Choroby wewnętrzne" },
    { name: "Kardiologia" },
    { name: "Ortopedia i traumatologia" },
  ],
  finance: { year: 2025, revenue: 10_000_000, netResult: -2_500_000, source: "KRS" },
  financeHistory: [
    { year: 2024, revenue: 9_000_000, costs: 11_000_000, netResult: -2_000_000 },
    { year: 2025, revenue: 10_000_000, costs: 12_500_000, netResult: -2_500_000 },
  ],
  agreements: {
    groups: ["Hospitalizacje JGP – ryczałt sieci szpitali", "Hospitalizacje JGP poza ryczałtem", "SOR", "Inne"],
    years: {
      2024: [800000, 100000, 150000, 50000],
      2025: [1200000, 300000, 200000, 0],
      2026: [600000, 0, 100000, 0],
    },
  },
  codes: {
    E53G: "NIEWYDOLNOŚĆ KRĄŻENIA",
    H52: "ZABIEGI NA KRĘGOSŁUPIE Z ZASTOSOWANIEM IMPLANTÓW",
    D18: "ZAPALENIE PŁUC NIETYPOWE",
  },
  facts: [
    [2023, 1, "E53G", 50, 400000, null, null, null],
    [2024, 1, "E53G", 90, 900000, 80, 200, 60],
    [2024, 0, "E53G", 10, 100000, 8, 20, 4],
    [2025, 2, "H52", 20, 1200000, 15, 40, 0],
    [2025, 3, "H52", 2, 100000, 2, 8, 0],
    [2025, 0, "D18", 30, 200000, 25, 70, 20],
    [2026, 2, "H52", 5, 300000, null, null, null],
  ],
};
