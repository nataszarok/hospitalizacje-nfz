import { describe, expect, it } from "vitest";
import {
  buildHospitalStructure, clinicEntries, contractItems, contractPay, fieldsShown, groupOf, highlightParts, isKidsWard, layoutBuildings,
  matchesSearch, otherEntries, PLAN, placeName, roomLabel, searchWords, shortPlaceName, squarifyRatio, wardEntries,
} from "@/lib/hospitalStructure";
import { contractsFixture } from "./fixtures/hospitalFinanceFixture";
import { structureFixture } from "./fixtures/hospitalPageFixture";

const NFZ = structureFixture.nfzCodes;
type Item = Parameters<typeof contractPay>[1][number];
const item = (code: string, amount: number, psz = true, extra: Partial<Item> = {}): Item => ({ code, name: "ŚWIADCZENIA", units: 1, amount, psz, type: "Leczenie szpitalne", ...extra });

describe("groupOf: części szpitala (kolejność warunków)", () => {
  it.each([
    ["4900", "admission_room", "support"], ["4902", "emergency_department", "support"], ["4910", "operating_block", "support"],
    ["4180", "palliative", "care"], ["5170", "long_term_care", "care"], ["2184", "hospice_palliative", "care"],
    ["4300", "rehabilitation", "rehab"], ["6500", "spa_sanatorium_or_rehabilitation", "rehab"], ["4700", "psychiatry_addiction", "psych"],
    ["4260", "hospital_4xxx", "icu"], ["4106", "hospital_4xxx", "icu"], ["4240", "hospital_4xxx", "onco"], ["4421", "hospital_4xxx", "mother"],
    ["4580", "hospital_4xxx", "surgery"], ["4000", "hospital_4xxx", "internal"],
  ])("%s %s → %s", (code, category, group) => expect(groupOf(code, category)).toBe(group));

  it("oddziały dla dzieci: kod kończący się na 1 albo pediatria i neonatologia", () => {
    expect(["4101", "4401", "4421", "4000", "4450"].map(isKidsWard)).toEqual([true, true, true, false, false]);
  });
});

describe("nazwy placówek", () => {
  it("bez „ w <miasto>”, gdy miasto jest w adresie (odmiana: 3 litery słowa)", () => {
    expect(placeName(["Szpital w Kłodzku"], "Kłodzko")).toBe("Szpital");
    expect(placeName(["Zakład Opiekuńczo-Leczniczy w Nowej Rudzie"], "Nowa Ruda")).toBe("Zakład Opiekuńczo-Leczniczy");
    expect(placeName(["Szpital Uzdrowiskowo-Rehabilitacyjny w Kudowie-Zdroju"], "Kudowa-Zdrój")).toBe("Szpital Uzdrowiskowo-Rehabilitacyjny");
    expect(placeName(["Przychodnia w Kłodzku"], "Stronie Śląskie")).toBe("Przychodnia w Kłodzku");
  });

  it("wspólny człon przed „ – ” raz; inne nazwy przez „ · ”", () => {
    expect(placeName(["Uniwersyteckie Centrum Kliniczne – ZOL", "Uniwersyteckie Centrum Kliniczne – Szpital"], "Gdańsk")).toBe("Uniwersyteckie Centrum Kliniczne – ZOL, Szpital");
    expect(placeName(["Przychodnia", "Szpital w Kłodzku"], "Kłodzko")).toBe("Przychodnia · Szpital");
  });

  it("telefon: bez nazwy szpitala z tytułu karty i ze skrótami", () => {
    expect(shortPlaceName("Uniwersyteckie Centrum Kliniczne – Szpital", "Uniwersyteckie Centrum Kliniczne, Gdańsk")).toBe("Szpital");
    expect(shortPlaceName("Zakład Opiekuńczo-Leczniczy", "ZOZ w Kłodzku")).toBe("ZOL");
  });
});

describe("sposób zapłaty z umów NFZ", () => {
  it("zakres w umowie sieci bez kwoty = ryczałt; z kwotą = osobna kwota; część i część = ryczałt + osobna kwota (OIT)", () => {
    expect(contractPay("4260", [item("03.4260.050.02", 0)], NFZ)[0]).toBe("lump");
    expect(contractPay("4261", [item("03.4261.050.02", 3_000_000)], NFZ)[0]).toBe("separate");
    expect(contractPay("4260", [item("03.4260.050.02", 0), item("03.4260.601.02", 467_987)], NFZ)[0]).toBe("mixed");
  });

  it("stawka dobowa (365 jednostek) przez słownik kodów: SOR 4902 → 3300", () => {
    expect(contractPay("4902", [item("03.3300.008.03", 46_562_112, true, { units: 365 })], NFZ)[0]).toBe("daily");
  });

  it("słownik kodów: ZOL 5170 → 5160 w osobnej umowie; bez słownika — brak w umowach", () => {
    const zol = [item("14.5160.026.04", 4_443_962, false, { type: "Świadczenia pielęgnacyjne i opiekuńcze" })];
    expect(contractPay("5170", zol, NFZ)).toEqual(["separate", [["Świadczenia pielęgnacyjne i opiekuńcze", 0, 4_443_962]]]);
    expect(contractPay("5170", zol, {})[0]).toBe("none");
  });

  it("pododdział bez własnego zakresu: zakres o tych samych 3 cyfrach", () => {
    expect(contractPay("4106", [item("03.4100.130.02", 5_000_000)], NFZ)[0]).toBe("separate");
  });

  it("program pilotażowy CZP; poradnia: za porady albo bez kwoty", () => {
    expect(contractPay("4700", [item("18.4700.400.02", 1_440_786, false, { name: "ŚWIADCZENIA PSYCHIATRYCZNE DLA DOROSŁYCH W CZP", type: "Programy pilotażowe" })], NFZ)[0]).toBe("czp");
    expect(contractPay("1100", [item("02.1100.001.02", 549_515, false)], NFZ, true)[0]).toBe("advice");
    expect(contractPay("1020", [item("02.1020.501.02", 0)], NFZ, true)[0]).toBe("nokwota");
  });

  it("pozycje planu z pliku umów: rok, umowa sieci (z produktem ryczałtu), bez pozycji 00", () => {
    const items = contractItems(contractsFixture, 1);
    expect(items.find((entry) => entry.code === "03.3300.009.03")).toMatchObject({ amount: 20_000_000, psz: true });
    expect(items.find((entry) => entry.code === "05.1310.208.02")).toMatchObject({ psz: false, type: "Rehabilitacja lecznicza" });
    expect(items.some((entry) => entry.code.startsWith("00."))).toBe(false);
  });
});

describe("dane zakładki z pliku buildu", () => {
  const structure = buildHospitalStructure("16|111", structureFixture, contractsFixture, ["2024", "2025"], { outpatient: { cell_count: 3 }, registry: { location_count: 3, city_count: 2 } })!;

  it("łóżka razem i słowniki tylko z wartościami szpitala", () => {
    expect(structure.beds.reduce((sum, row) => sum + row[5], 0)).toBe(85);
    expect(structure.fields).toEqual(["Choroby wewnętrzne", "Kardiologia", "Kardiologia dziecięca", "Diabetologia"]);
    expect(structure.outpatient).toEqual({ cells: 3, fields: 0, locations: 0 });
    expect(buildHospitalStructure("99|999", structureFixture, null, [], null)).toBeNull();
  });

  it("sposób zapłaty w latach karty: SOR z kwotą w umowie sieci w 2025 r.; rok bez umów = null", () => {
    expect(structure.pay["4902"][1]?.[0]).toBe("separate");
    expect(structure.pay["1100"][1]?.[0]).toBe("advice");
    expect(structure.pay["4000"][0]?.[0]).toBe("none");
  });

  it("lista oddziałów: wiersz na kod w częściach, miejsca spoza oddziałów na końcu części", () => {
    expect(wardEntries(structure).map((entry) => [entry.part, entry.name, entry.beds])).toEqual([
      ["acute", "Oddział kardiologiczny", 50], ["acute", "Oddział chorób wewnętrznych", 10], ["acute", "SOR", 13], ["care", "ZOL", 12],
    ]);
  });

  it("lista poradni: wiersz na kod, liczba poradni i suma dziedzin", () => {
    expect(clinicEntries(structure).map((entry) => [entry.name, entry.count, entry.fields])).toEqual([
      ["Poradnia diabetologiczna", 1, ["Diabetologia"]], ["Poradnia kardiologiczna", 2, ["Kardiologia", "Kardiologia dziecięca"]],
    ]);
  });
});

describe("rzut", () => {
  it("wiersze budynków zajmują całą szerokość (szerokości + odstępy = kontener)", () => {
    const lines = layoutBuildings([{ beds: 900 }, { beds: 135 }, { beds: 95 }], 1100);
    expect(lines.map((line) => line.length)).toEqual([1, 2]);
    for (const line of lines) {
      const used = line.reduce((sum, b) => sum + b.width, 0) + PLAN.buildingGap * (line.length - 1);
      expect(Math.abs(used - 1099)).toBeLessThan(0.5);
      expect(new Set(line.map((b) => Math.round(b.height))).size).toBe(1);
    }
  });

  it("telefon: każdy wiersz na całą szerokość, także resztka (wysokość co najmniej minLast)", () => {
    const lines = layoutBuildings([{ beds: 140 }, { beds: 60 }, { beds: 50 }], 343);
    expect(lines.map((line) => line.length)).toEqual([2, 1]);
    for (const line of lines) expect(Math.abs(line.reduce((sum, b) => sum + b.width, 0) + PLAN.buildingGap * (line.length - 1) - 342)).toBeLessThan(0.5);
    expect(lines[1][0].height).toBe(PLAN.minLast + 2 * PLAN.pad);
  });

  it("jedyny mały budynek: wysokość co najmniej minLast, nadal na całą szerokość", () => {
    const [[only]] = layoutBuildings([{ beds: 10 }], 343);
    expect(only.height).toBe(PLAN.minLast + 2 * PLAN.pad);
    expect(Math.round(only.width)).toBe(342);
  });

  it("lista innych miejsc: na rodzaj, z jednostkami i adresami", () => {
    const entries = otherEntries({ addresses: [["Szpitalna 1", "Katowice"], ["Polna 3", "Katowice"]], other: [[0, "poz", "Gabinet POZ", 0], [1, "poz", "Gabinet POZ", 0], [0, "dialysis", "Stacja dializ", 18], [1, "misc", "Punkt pobrań", 0]] });
    expect(entries.map((entry) => [entry.name, entry.count, entry.units, entry.addresses.length])).toEqual([
      ["Podstawowa opieka zdrowotna (POZ)", 2, 0, 2], ["Stacja dializ", 1, 18, 1], ["Punkt pobrań", 1, 0, 1],
    ]);
  });

  it("oddziały szersze niż wyższe (proporcja podpisu), pole proporcjonalne do łóżek", () => {
    const rooms = squarifyRatio([{ value: 30 }, { value: 10 }], 0, 0, 400, 100, PLAN.roomRatio);
    expect(rooms[0].w * rooms[0].h / (rooms[1].w * rooms[1].h)).toBeCloseTo(3);
    // Bez proporcji squarify dałby największemu oddziałowi kwadrat; z proporcją 2,6 jest szerszy niż wyższy.
    expect(rooms[0].w / rooms[0].h).toBeGreaterThan(1.5);
  });

  it("podpis: dwie linie, jedna albo brak — nazw nie skracamy", () => {
    const measure = (text: string) => text.length * 6;
    expect(roomLabel({ x: 0, y: 0, w: 120, h: 40 }, "Kardiologiczny", 24, measure)).toBe("two");
    expect(roomLabel({ x: 0, y: 0, w: 120, h: 22 }, "Kardiologiczny", 24, measure)).toBe("one");
    expect(roomLabel({ x: 0, y: 0, w: 50, h: 40 }, "Kardiologiczny", 24, measure)).toBeNull();
  });
});

describe("wyszukiwarka", () => {
  it("bez polskich znaków i wielkości liter, z rdzeniem dłuższych słów", () => {
    expect(searchWords("Diabetologiczna")).toEqual(["diabetologi"]);
    expect(matchesSearch(["Diabetologia"], searchWords("diabetologiczna"))).toBe(true);
    expect(matchesSearch(["Oddział chorób płuc"], searchWords("chorob pluc"))).toBe(true);
    expect(matchesSearch(["SOR"], searchWords("sor"))).toBe(true);
  });

  it("wszystkie słowa w jednym tekście", () => {
    const words = searchWords("kardiologia dzieci");
    expect(matchesSearch(["Kardiologia dziecięca"], words)).toBe(true);
    expect(matchesSearch(["Kardiologia", "Chirurgia dziecięca"], words)).toBe(false);
  });

  it("podświetlenie w oryginalnym tekście; dziedziny z trafieniem na początku", () => {
    expect(highlightParts("Poradnia kardiologiczna", searchWords("kardio"))).toEqual([["Poradnia ", false], ["kardio", true], ["logiczna", false]]);
    expect(fieldsShown(["Alergologia", "Kardiologia", "Neurologia"], searchWords("kardio"), 2)).toEqual({ shown: ["Kardiologia", "Alergologia"], rest: ["Neurologia"] });
  });
});
