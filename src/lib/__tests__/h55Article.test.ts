import { describe, expect, it } from "vitest";
import { activeRange, buildH55ArticleData, settledInPeriod, controlCoverage, facilityChart, monthKeys, providerSeries, shortSeriesProviders } from "@/lib/h55Article";
import { H55_CONTROLS } from "@/lib/h55Controls";
import { h55ArticleFixture as fixture } from "./fixtures/h55Article";

const months = monthKeys(["2022", "2023"]);
const at = (month: string) => months.indexOf(month);

describe("controlCoverage", () => {
  const values = months.map((month) => (month === "2021-12" ? 0 : month < "2022-06" ? 30 : month <= "2022-12" ? 5 : month <= "2023-03" ? 2 : 0));
  const control = { studyFrom: "2022-01", studyTo: "2022-12", end: "2023-01-20" };

  it("liczy miesiące z H55 w okresie objętym kontrolą, przed nim i po nim", () => {
    const coverage = controlCoverage(values, months, control);
    expect(coverage).toMatchObject({ months: 15, studied: 12, before: 0, after: 3, hospitalizations: 5 * 30 + 7 * 5 + 3 * 2, hospitalizationsStudied: 5 * 30 + 7 * 5 });
  });

  it("miesiąc „intensywny” = co najmniej 20 hospitalizacji", () => {
    expect(controlCoverage(values, months, control)).toMatchObject({ intense: 5, intenseStudied: 5 });
  });

  it("po kontroli: pełne miesiące po miesiącu jej zakończenia", () => {
    expect(controlCoverage(values, months, control)).toMatchObject({ afterControl: 2, hospitalizationsAfterControl: 4 });
  });

  it("miesiąc bez hospitalizacji się nie liczy", () => {
    expect(controlCoverage(months.map(() => 0), months, control).months).toBe(0);
  });
});

describe("shortSeriesProviders", () => {
  const series = new Map<string, number[]>([
    ["01|krotka", months.map((month) => (month >= "2023-01" && month <= "2023-12" ? 10 : 0))],
    ["01|za-dluga", months.map((month) => (month >= "2022-06" && month <= "2023-06" ? 20 : 0))],
    ["01|za-mala", months.map((month) => (month === "2023-05" ? 99 : 0))],
    ["01|kontrolowana", months.map((month) => (month === "2022-03" ? 500 : 0))],
  ]);

  it("wybiera placówki z całą aktywnością w ≤ 12 miesiącach i ≥ 100 hospitalizacjami, bez kontroli", () => {
    expect(shortSeriesProviders(series, new Set(["01|kontrolowana"]))).toEqual(["01|krotka"]);
  });

  it("activeRange: pierwszy i ostatni miesiąc z H55", () => {
    expect(activeRange(series.get("01|krotka")!)).toEqual([at("2023-01"), at("2023-12")]);
    expect(activeRange(months.map(() => 0))).toBeNull();
  });
});

describe("buildH55ArticleData", () => {
  const data = buildH55ArticleData(fixture(), new Map([["05|krotka", ["SZPITAL W PRZYKŁADOWIE", "PRZYKŁADOWO"]]]));

  it("sumuje kraj w miesiącach i latach", () => {
    expect(data.months).toHaveLength(108);
    expect(data.nationalByYear[0]).toBe(12 * (new Set(H55_CONTROLS.map((control) => control.provider)).size * 10 + 1));
    expect(data.total).toBe(data.nationalByYear.reduce((a, b) => a + b, 0));
  });

  it("rozdziela kontrole na serię 19 i sześć wcześniejszych; placówki: 18 i 6; krótka seria ma podpis z miejscowości", () => {
    expect(data.controls.filter((item) => item.control!.wave === "series")).toHaveLength(19);
    expect(data.controls.filter((item) => item.control!.wave === "early")).toHaveLength(6);
    expect(data.facilities.series).toHaveLength(18);
    expect(data.facilities.early).toHaveLength(6);
    expect(data.shortSeries.map((item) => item.label)).toEqual(["Przykładowo"]);
    expect(data.others).toEqual({ facilities: 1, hospitalizations: 108 });
  });

  it("Koszalin jako placówka: suma okresów dwóch kontroli (2022 i VIII–XII 2024) = 17 ze 108 miesięcy", () => {
    const koszalin = data.facilities.series.find((item) => item.key === "16|6691044410")!;
    expect(koszalin.controls).toHaveLength(2);
    expect(koszalin.coverage).toMatchObject({ months: 108, studied: 17 });
  });

  it("Miastko: okres objęty kontrolą IV 2024 – III 2025 = 12 ze 108 miesięcy", () => {
    const miastko = data.controls.find((item) => item.label === "Miastko")!;
    expect(miastko.coverage).toMatchObject({ months: 108, studied: 12 });
  });

  it("brak świadczeniodawcy kontroli w danych = błąd budowania", () => {
    const file = fixture();
    file.providers[0] = "99|brak";
    expect(() => buildH55ArticleData(file)).toThrow(/Brak hospitalizacji H55/);
  });

  it("facilityChart: wycinek miesięcy i serie w kolorach porównań", () => {
    const chart = facilityChart(data, ["Koszalin", "Gryfice"], "2022-01", "2022-12");
    expect(chart.months).toEqual(monthKeys(["2022"]));
    expect(chart.lines.map((line) => [line.name, line.values.length])).toEqual([["Koszalin", 12], ["Gryfice", 12]]);
    expect(chart.lines[0].color).not.toBe(chart.lines[1].color);
  });
});

describe("H55_CONTROLS", () => {
  it("25 kontroli z unikalnym numerem i podpisem; Koszalin skontrolowany dwa razy", () => {
    expect(H55_CONTROLS).toHaveLength(25);
    expect(new Set(H55_CONTROLS.map((control) => control.id)).size).toBe(25);
    expect(new Set(H55_CONTROLS.map((control) => control.label)).size).toBe(25);
    expect(H55_CONTROLS.filter((control) => control.provider === "16|6691044410")).toHaveLength(2);
    for (const control of H55_CONTROLS) {
      expect(control.studyFrom <= control.studyTo).toBe(true);
      expect(control.start <= control.end).toBe(true);
      expect(control.provider).toMatch(/^\d{2}\|\d{10}$/);
    }
  });

  it("providerSeries składa wiersze kolumnowe w szeregi", () => {
    const series = providerSeries(fixture());
    expect(series.get(H55_CONTROLS[0].provider)?.[0]).toBe(10);
  });
});

describe("settledInPeriod", () => {
  const byYear = new Map([["2022", 1200], ["2023", 600]]);
  const values = months.map((month) => (month.startsWith("2023") ? (month <= "2023-03" ? 30 : 10) : 5));

  it("rok w całości w okresie: kwota roku", () => {
    expect(settledInPeriod(values, months, "2022-01", "2022-12", byYear)).toEqual({ pln: 1200, estimated: false, missingYears: [] });
  });

  it("część roku: kwota roku × udział hospitalizacji z miesięcy okresu (szacunek)", () => {
    // I–III 2023: 90 z 180 hospitalizacji roku.
    expect(settledInPeriod(values, months, "2023-01", "2023-03", byYear)).toEqual({ pln: 300, estimated: true, missingYears: [] });
  });

  it("lata bez danych o kwotach są osobno i nie wchodzą do kwoty", () => {
    expect(settledInPeriod(values, months, "2021-01", "2022-12", byYear)).toEqual({ pln: 1200, estimated: false, missingYears: ["2021"] });
  });
});

describe("buildH55ArticleData — kwoty i wyceny", () => {
  const file = fixture();
  const koszalin = H55_CONTROLS.find((control) => control.label === "Koszalin")!.provider;
  const data = buildH55ArticleData(file, new Map(), { national: { "2022": 1000, "2023": 2000 }, providers: { "2022": [[koszalin, 500]], "2023": [[koszalin, 700]] } }, { year: "2025", points: { hospitalizacja: 3955 } });

  it("kwota rozliczona za okres objęty kontrolą i suma wszystkich lat", () => {
    const item = data.controls.find((control) => control.label === "Koszalin")!;
    expect(item.settled).toEqual({ pln: 500, estimated: false, missingYears: [] });
    expect(item.settledTotal).toBe(1200);
  });

  it("przeciętna wartość punktu = zł / punkty z rozliczeń", () => {
    expect(data.valuation.pointValue.map((row) => [row.group, row.perPoint])).toEqual([["H55", 1.86], ["HK14", 1.93]]);
    expect(data.valuation.hk14.points.hospitalizacja).toBe(2512);
  });
});
