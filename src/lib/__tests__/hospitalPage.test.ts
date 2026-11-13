import { describe, expect, it } from "vitest";
import { buildHospitalCards, buildHospitalPageData, sectionTotals, wardPaymentByYear, wardPaymentStatus, yearlySums } from "@/lib/hospitalPage";
import { ME, hospitalPageInput as input } from "@/lib/__tests__/fixtures/hospitalPageFixture";
import { contractsFixture, paymentFixture } from "@/lib/__tests__/fixtures/hospitalFinanceFixture";
import { FINANCE_BUCKETS } from "@/lib/hospitalFinance";

describe("buildHospitalPageData", () => {
  const data = buildHospitalPageData(input)!;

  it("tożsamość szpitala i miesiące wszystkich lat", () => {
    expect(data).toMatchObject({ key: ME, owNfz: "16", nip: "111", name: "SZPITAL ALFA", city: "KOSZALIN", region: "zachodniopomorskie", pszLevel: "III stopnia", beds: 60, net: { year: 2025, value: 5 } });
    expect(data.months).toHaveLength(24);
    expect(data.months[13]).toBe("2025-02");
  });

  it("szpital miesięcznie z plików grup: hospitalizacje, zgony i przyjęcia nagłe (tryb 1)", () => {
    expect(data.monthly.hospitalizations[0]).toBe(15);
    expect(data.monthly.urgent[0]).toBe(10);
    expect(data.monthly.deaths[0]).toBe(1);
    expect(data.monthly.hospitalizations[13]).toBe(30);
    expect(yearlySums(data.monthly.hospitalizations, data.years)).toEqual([15, 30]);
  });

  it("sieć PSZ miesięcznie z plików grup: tylko ośrodki sieci (NIP z wykazu), nagłe = tryb 1", () => {
    // Styczeń 2024: szpital 10 nagłych + 5; Beta (40) jest poza siecią. Styczeń 2025: Gamma 50.
    expect(data.network!.hospitalizations[0]).toBe(15);
    expect(data.network!.urgent[0]).toBe(10);
    expect(data.network!.hospitalizations[12]).toBe(50);
    expect(data.network!.deaths[13]).toBe(2);
  });

  it("zakładka Finanse: szpital sieci PSZ z umowami; bez umów albo poza siecią — brak", () => {
    expect(data.finance).toBeNull();
    const withContracts = { ...input, contracts: contractsFixture, payment: paymentFixture };
    expect(buildHospitalPageData(withContracts)!.finance?.plan).toHaveLength(FINANCE_BUCKETS.length);
    expect(buildHospitalPageData({ ...withContracts, pszLevel: null })!.finance).toBeNull();
  });

  it("szpital spoza sieci PSZ: bez linii odniesienia sieci", () => {
    expect(buildHospitalPageData({ ...input, pszLevel: null })!.network).toBeNull();
  });

  it("grupy szpitala: nazwa z najnowszego produktu, miejsce w Polsce i liczba ośrodków w każdym roku, kwota NFZ", () => {
    // H53 bez hospitalizacji szpitala nie trafia na kartę.
    // 2024: Beta 40 > szpital 15 → 2. miejsce; 2025: Gamma 50 > szpital 30 > Beta 20 → 2. miejsce z 3.
    // Zgony szpitala; Polska: wszystkie ośrodki grupy (55 i 100 hosp., 1 i 2 zgony), kwota grupy w Polsce z `valuePln.national`.
    expect(data.groups).toEqual([["A01", "ZABIEG A", [15, 30], [2, 2], [2, 3], [0, 3_000_000], [1, 2], [55, 100], [1, 2], [0, 1000]]]);
    expect(sectionTotals(data.groups, data.years).get("A")).toEqual([15, 30]);
  });

  it("długość pobytu w latach: przedziały od najkrótszego, tylko ten szpital", () => {
    expect(data.durations.labels).toEqual(["0 dni", "1-2 dni", "6 i więcej dni"]);
    expect(data.durations.values).toEqual([[5, 15, 0], [0, 0, 30]]);
  });

  it("oddziały od największego; nazwa z rejestru, gdy brak nazwy urzędowej kodu", () => {
    expect(data.wards).toEqual([["4100", "Kardiologia", 50, [], "Kardiologia"], ["4000", "Wewnętrzny", 10, ["Choroby wewnętrzne"], "Wewnętrzny"]]);
  });

  it("oddziały: nazwa urzędowa kodu resortowego, nazwa z rejestru zostaje obok", () => {
    const named = buildHospitalPageData({ ...input, wardNames: { "4100": "Oddział kardiologiczny" } })!;
    expect(named.wards[0]).toEqual(["4100", "Oddział kardiologiczny", 50, [], "Kardiologia"]);
  });

  it("części wielu kart z jednego przejścia dają tę samą kartę co liczenie dla jednego szpitala", () => {
    const cards = buildHospitalCards([ME, "07|222", "16|333"], input.trends, input.groupFiles, input.datasets, input.networkNips);
    expect(buildHospitalPageData({ ...input, groupFiles: [], datasets: [] }, cards)).toEqual(data);
    // Beta: grupa A01 w 2024 r. na 1. miejscu z 2 ośrodków, w 2025 r. na 3. z 3.
    expect(cards.byKey.get("07|222")!.groups[0].slice(2, 5)).toEqual([[40, 20], [1, 3], [2, 3]]);
  });

  it("zwraca null dla szpitala spoza danych", () => {
    expect(buildHospitalPageData({ ...input, key: "01|999" })).toBeNull();
  });
});

describe("sposób zapłaty oddziałów (udział hospitalizacji w ryczałcie i za wykonanie)", () => {
  const payment = wardPaymentByYear({
    years: ["2024", "2025"],
    scopes: [["03.4000.030.02", "Choroby wewnętrzne"], ["03.4450.060.02", "Położnictwo"], ["03.4450.260.02", "Porody III poziom"], ["03.4401.030.02", "Pediatria"], ["03.4340.030.02", "Choroby zakaźne"]],
    hosp: [[1, 0, 0, 100], [1, 1, 0, 57], [1, 2, 1, 43], [1, 3, 1, 80], [0, 4, 0, 5]],
    value: [],
  }, ["2023", "2024", "2025"]);

  it("sumuje zakresy w oddziale (kod oddziału z kodu zakresu) i przelicza lata na lata karty", () => {
    expect(payment["4450"]).toEqual([[0, 0, 57], [0, 0, 43]]);
    expect(payment["4340"]).toEqual([[0, 5, 0], [0, 0, 0]]);
  });

  it("ryczałt, częściowo i poza ryczałtem; oddział bez zakresu przez trzy cyfry kodu; brak rozliczeń = null", () => {
    expect(wardPaymentStatus("4000", payment, 2)).toMatchObject({ status: "ryczalt", paidPct: 0 });
    expect(wardPaymentStatus("4450", payment, 2)).toMatchObject({ status: "czesciowo", paidPct: 43 });
    expect(wardPaymentStatus("4401", payment, 2)).toMatchObject({ status: "poza", total: 80 });
    // Oddział obserwacyjno-zakaźny 4348 rozlicza się w zakresie 4340.
    expect(wardPaymentStatus("4348", payment, 1)).toMatchObject({ status: "ryczalt", total: 5 });
    expect(wardPaymentStatus("4348", payment, 2)).toBeNull();
    expect(wardPaymentStatus("4260", payment, 2)).toBeNull();
    expect(wardPaymentStatus("4000", null, 2)).toBeNull();
  });
});
