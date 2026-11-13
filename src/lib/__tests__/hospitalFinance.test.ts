import { describe, expect, it } from "vitest";
import {
  LUMP_BASE_YEAR, levelGenitive, lumpSumByYear, lumpSumIndex, lumpSumReference, yearOverYear, type HospitalContractsFile,
  bucketIndex, buildHospitalFinance, classifyProduct, groupSums, lumpSplit, payShareText, planTotals, scopeLabel, sectionPayRows, sentenceCase, settledYears, wardRows,
} from "@/lib/hospitalFinance";
import type { HospitalWard } from "@/lib/hospitalPage";
import { niceAxis } from "@/components/hospitals/YearStackBars";
import { contractsFixture, paymentFixture } from "./fixtures/hospitalFinanceFixture";

const financial = { nip: "111", years: [{ year: 2025, revenue: 200_000_000, net_result: -4_000_000, net_margin: null }] };
const finance = buildHospitalFinance(contractsFixture, paymentFixture, financial, ["2024", "2025"])!;

describe("classifyProduct — grupa pozycji umowy z kodu produktu", () => {
  it.each([
    ["03.0000.030.17", "RYCZAŁT PSZ - SZPITAL III STOPNIA", "ryczalt"],
    ["03.0000.010.17", "RYCZAŁT PSZ - SZPITAL I STOPNIA", "ryczalt"],
    ["03.0000.042.17", "RYCZAŁT PSZ - SZPITAL PULMONOLOGICZNY", "ryczalt"],
    ["03.9995.002.02", "KOSZTY ŚWIADCZEŃ WYNIKAJĄCE Z ROZPORZĄDZENIA", "owu"],
    ["03.4401.030.02", "PEDIATRIA - HOSPITALIZACJA", "kidsward"],
    ["03.4501.030.02", "CHIRURGIA DZIECIĘCA - HOSPITALIZACJA", "kidsward"],
    ["03.4421.160.02", "NEONATOLOGIA - HOSPITALIZACJA - III POZIOM REFERENCYJNY - N20", "birth"],
    ["03.4500.930.02", "CHIRURGIA OGÓLNA - HOSPITALIZACJA - PAKIET ONKOLOGICZNY", "onko"],
    ["03.4600.130.02", "OKULISTYKA - HOSPITALIZACJA - B18G, B19G", "eye"],
    ["03.4580.991.02", "ORTOPEDIA - HOSPITALIZACJA - ŚWIADCZENIA ENDOPROTEZOPLASTYKI", "endo"],
    ["03.4100.130.02", "KARDIOLOGIA - HOSPITALIZACJA E10, E11,E12G ,E15", "cardio"],
    ["03.4610.600.02", "OTORYNOLARYNGOLOGIA - HOSPITALIZACJA- ŚWIADCZENIA UDZIELANE OSOBOM DO UKOŃCZENIA 18. ROKU ŻYCIA", "kids18"],
    ["03.4530.130.02", "CHIRURGIA NACZYNIOWA - HOSPITALIZACJA Q01, Q52", "vascular"],
    ["03.4220.130.02", "NEUROLOGIA - HOSPITALIZACJA - A48", "otherjgp"],
    ["03.0001.306.02", "LEKI W PROGRAMIE LEKOWYM - LECZENIE CHORYCH NA RAKA PŁUCA", "lekowe"],
    ["03.0000.370.02", "PROGRAM LEKOWY - LECZENIE PACJENTÓW Z CHOROBAMI SIATKÓWKI", "lekowe"],
    ["03.3300.009.03", "ŚWIADCZENIA W SZPITALNYM ODDZIALE RATUNKOWYM (SOR)", "sor"],
    ["03.0000.112.02", "CHEMIOTERAPIA W TRYBIE JEDNODNIOWYM", "chemio"],
    ["03.4261.050.02", "ANESTEZJOLOGIA I INTENSYWNA TERAPIA DLA DZIECI", "oit"],
    ["03.4401.130.02", "PEDIATRIA - HOSPITALIZACJA - LECZENIE PĘCHERZOWEGO ODDZIELANIA NASKÓRKA", "othernonjgp"],
    ["02.7220.072.02", "BADANIA TOMOGRAFII KOMPUTEROWEJ (TK)", "aos"],
    ["01.0000.162.16", "ŚWIADCZENIA NOCNEJ I ŚWIĄTECZNEJ OPIEKI ZDROWOTNEJ", "nisoz"],
    ["05.1310.208.02", "FIZJOTERAPIA AMBULATORYJNA", "rehab"],
    ["17.3118.031.08", "ŚWIADCZENIA UDZIELANE PRZEZ WYJAZDOWY ZESPÓŁ SANITARNY TYPU \"N\"", "transport"],
    ["11.4132.003.12", "HEMODIALIZOTERAPIA - Z ZAPEWNIENIEM 24-GODZINNEGO DYŻURU", "dializy"],
    ["15.4180.021.02", "ŚWIADCZENIA W ODDZIALE MEDYCYNY PALIATYWNEJ/HOSPICJUM STACJONARNYM", "paliatywna"],
    ["18.9900.400.03", "ŚWIADCZENIA OPIEKI ZDROWOTNEJ W CENTRUM ZDROWIA PSYCHICZNEGO (CZP)", "psychiatria"],
    ["04.1744.007.02", "ŚWIADCZENIA TERAPII UZALEŻNIENIA I WSPÓŁUZALEŻNIENIA OD ALKOHOLU", "psychiatria"],
    ["14.5160.026.04", "ŚWIADCZENIA W ZAKŁADZIE PIELĘGNACYJNO- OPIEKUŃCZYM/OPIEKUŃCZO-LECZNICZYM", "dlugoterminowa"],
    ["11.1021.046.02", "LECZENIE CUKRZYCY Z ZASTOSOWANIEM POMPY INSULINOWEJ U DZIECI", "inne"],
    ["18.0000.004.02", "ŚWIADCZENIE ZDROWOTNE - DOBRY POSIŁEK W SZPITALU", "inne"],
  ])("%s → %s", (code, name, bucket) => {
    expect(classifyProduct(code, name)).toBe(bucket);
  });
});

describe("buildHospitalFinance — dane zakładki Finanse", () => {
  it("plan umów w czterech drogach pieniędzy; suma roku = suma pozycji", () => {
    expect(planTotals(finance)).toEqual([86_000_000, 170_000_000]);
    // 2025: ryczałt + dopłaty, za wykonanie z JGP (pediatria, kardiologia), bez JGP (lek, SOR), poza szpitalem (poradnia, rehabilitacja).
    expect(groupSums(finance.plan, 1)).toEqual([110_000_000, 20_000_000, 35_000_000, 5_000_000]);
    const lump = finance.items.filter(([bucket, year]) => bucket === bucketIndex("ryczalt") && year === 1);
    expect(lump.map(([, , name, value]) => [finance.names[name], value])).toEqual([["RYCZAŁT PSZ - SZPITAL III STOPNIA", 100_000_000]]);
    // Nazwa produktu raz w słowniku, także gdy pozycja jest w kilku latach.
    expect(finance.names.filter((name) => name === "RYCZAŁT PSZ - SZPITAL III STOPNIA")).toHaveLength(1);
  });

  it("rozliczenia grup JGP: zakres bez osobnej kwoty = ryczałt, za wykonanie według zakresu", () => {
    expect(finance.settled[bucketIndex("ryczalt")]).toEqual([0, 30_000_000]);
    expect(finance.settled[bucketIndex("cardio")]).toEqual([0, 7_000_000]);
    expect(finance.settled[bucketIndex("kidsward")]).toEqual([0, 11_000_000]);
    expect(lumpSplit(finance, 1)).toEqual({ lump: 30_000_000, paid: 18_000_000 });
    expect(settledYears(finance)).toEqual([1]);
    expect(finance.years[0]).toBeNull();
    // Do przeglądarki idą tabele roku, nie wiersze grup JGP.
    expect(finance).not.toHaveProperty("jgp");
  });

  it("sprawozdanie finansowe w latach karty; bez umów — brak zakładki", () => {
    expect(finance.revenue).toEqual([null, 200_000_000]);
    expect(finance.net).toEqual([null, -4_000_000]);
    expect(buildHospitalFinance(null, paymentFixture, financial, ["2025"])).toBeNull();
  });
});

describe("tabele zakładki Finanse (zagregowane podczas budowania)", () => {
  const wards: HospitalWard[] = [["4100", "Oddział kardiologiczny", 40, [], "Kardiologia"]];
  const withWards = buildHospitalFinance(contractsFixture, paymentFixture, financial, ["2024", "2025"], null, wards)!;

  it("oddziały: kod z zakresu, nazwa i łóżka z RPWDL, grupy JGP w obu częściach oddziału", () => {
    const [cardio, kids] = wardRows(withWards, 1);
    expect(cardio).toMatchObject({ code: "4100", name: "Oddział kardiologiczny", beds: 40, lump: 30_000_000, paid: 7_000_000, onlyLump: 0, onlyPaid: 1, both: 1 });
    expect(cardio.scopes.map((scope) => [scope.code, scope.paid])).toEqual([["03.4100.030.02", false], ["03.4100.130.02", true]]);
    // Kody JGP w tys. zł; E53 w obu częściach oddziału (znacznik 1).
    expect(cardio.scopes[1]).toMatchObject({ value: 7_000_000, chips: [["E10", 6000], ["E53", 1000, 1]], groups: 2 });
    // Krotka roku: [indeks oddziału w słowniku, ryczałt, za wykonanie, tylko R, tylko W, obie, zakresy]; oddział raz w słowniku.
    expect(withWards.years[1]!.wards[0].slice(0, 6)).toEqual([0, 30_000_000, 7_000_000, 0, 1, 1]);
    expect(withWards.wards).toEqual([["4100", "Oddział kardiologiczny", 40], ["4401", "Pediatria", null]]);
    expect(wardRows(withWards, 0)).toEqual([]);
    // Oddział bez profilu RPWDL: nazwa z zakresu, bez łóżek.
    expect(kids).toMatchObject({ code: "4401", name: "Pediatria", beds: null, paid: 11_000_000 });
  });

  it("grupy JGP pozycji umowy w roku: najwięksi pierwsi, kwoty w tys. zł", () => {
    expect(withWards.years[1]!.groups).toEqual(expect.arrayContaining([
      [bucketIndex("ryczalt"), [["E53", 30000]], 1],
      [bucketIndex("cardio"), [["E10", 6000], ["E53", 1000]], 2],
      [bucketIndex("kidsward"), [["D20", 11000]], 1],
    ]));
  });

  it("sekcje JGP: kwota, udziały i kwota za pobyt wobec średniej szpitala", () => {
    const rows = sectionPayRows(finance, 1, new Map([["E", 300], ["D", 100]]));
    expect(rows.map((row) => row.letter)).toEqual(["E", "D"]);
    expect(rows[0]).toMatchObject({ value: 37_000_000, lump: 30_000_000, paid: 7_000_000 });
    expect(rows[0].valueShare).toBeCloseTo(77.08, 1);
    expect(rows[0].hospShare).toBe(75);
    expect(rows[1].index).toBeCloseTo((11 / 48) / 0.25, 5);
  });

  it("podział słowami: zawsze obie części", () => {
    expect(payShareText(0.2)).toBe("100% ryczałt");
    expect(payShareText(43)).toBe("57% ryczałt · 43% za wykonanie");
    expect(payShareText(99.7)).toBe("100% za wykonanie");
    expect(scopeLabel("POŁOŻNICTWO I GINEKOLOGIA - HOSPITALIZACJA III POZIOM REFERENCYJNY - N01")).toBe("III poziom referencyjny – N01");
    expect(scopeLabel("KARDIOLOGIA - HOSPITALIZACJA")).toBe("zakres podstawowy oddziału");
    expect(sentenceCase("KARDIOLOGIA - HOSPITALIZACJA E10, E11,E12G ,E15")).toBe("Kardiologia - hospitalizacja E10, E11,E12G ,E15");
    expect(sentenceCase("ŚWIADCZENIA W SZPITALNYM ODDZIALE RATUNKOWYM (SOR)")).toBe("Świadczenia w szpitalnym oddziale ratunkowym (SOR)");
  });
});

describe("niceAxis — oś słupków w latach", () => {
  it.each([[272e6, 300e6, 100e6], [462e6, 500e6, 100e6], [86e6, 100e6, 20e6], [9, 10, 2], [0, 1, 0.25]])("%d → max %d, krok %d", (value, max, step) => {
    expect(niceAxis(value)).toEqual({ max, step });
  });
});

describe("ryczałt PSZ jako indeks (2018 = 100)", () => {
  const years = ["2017", "2018", "2019"];
  const contracts: HospitalContractsFile = {
    years,
    agreements: [[0, "03", "Leczenie szpitalne", 0, "A"], [1, "03", "Leczenie szpitalne", 0, "B"], [2, "03", "Leczenie szpitalne", 0, "C"]],
    products: [["03.0000.020.17", "RYCZAŁT PSZ - SZPITAL II STOPNIA"], ["03.4401.030.02", "PEDIATRIA - HOSPITALIZACJA"]],
    plans: [[0, 0, 3, 25], [0, 1, 1, 999], [1, 0, 12, 110], [2, 0, 12, 120]],
  };

  it("ryczałt w latach (bez innych pozycji); indeks od roku bazowego, lata przed bazą bez wartości", () => {
    expect(lumpSumByYear(contracts, years)).toEqual([25, 110, 120]);
    expect(LUMP_BASE_YEAR).toBe("2018");
    expect(lumpSumIndex([25, 200, 250, 0, 300], 1)).toEqual([null, 100, 125, null, 150]);
    // Bez ryczałtu w roku bazowym szpitala nie da się porównać od bazy.
    expect(lumpSumIndex([25, 0, 120], 1)).toBeNull();
    expect(lumpSumIndex([25, 110], -1)).toBeNull();
  });

  it("poziom sieci w dopełniaczu (po „szpitali”)", () => {
    expect(levelGenitive("III stopnia")).toBe("PSZ III stopnia");
    expect(levelGenitive("pediatryczny")).toBe("pediatrycznych PSZ");
    expect(levelGenitive("onkologiczny / pulmonologiczny")).toBe("onkologicznych i pulmonologicznych PSZ");
  });

  it("zmiana r/r: rok do poprzedniego, bez wartości — null", () => {
    expect(yearOverYear([null, 100, 125, null, 150])).toEqual([null, null, 25, null, null]);
    expect(yearOverYear([200, 150])).toEqual([null, -25]);
  });

  it("średnia indeksów poziomu sieci i całej sieci; rok bez wartości szpitala nie wchodzi do średniej", () => {
    const { levels, all } = lumpSumReference([
      { level: "III stopnia", index: [100, 120, 200] },
      { level: "III stopnia", index: [100, 140, null] },
      { level: "I stopnia", index: [100, 100, 110] },
    ], 3);
    expect(levels.get("III stopnia")).toEqual({ mean: [100, 130, 200], count: [2, 2, 1] });
    expect(all.mean).toEqual([100, 120, 155]);
    expect(all.count).toEqual([3, 3, 2]);
  });
});
