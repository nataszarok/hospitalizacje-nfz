import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agreementComposition,
  buildHospitalCodeRows,
  buildIncomeSeries,
  buildWardRows,
  buildWardYearSeries,
  buildYearSeries,
  formatMillions,
  formatPln,
  formatThousands,
  formatYearRange,
  fullYears,
  hospitalValuePerHosp,
  latestSummaryYear,
  loadSanokHospitalDataset,
  lowestValuePerHosp,
  summaryYears,
} from "@/lib/sanokHospital";
import { sanokHospitalDataset as dataset } from "./fixtures/sanokHospitalDataset";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lata", () => {
  it("pomija rok niepełny", () => {
    expect(fullYears(dataset)).toEqual([2023, 2024, 2025]);
    expect(summaryYears(dataset)).toEqual([2024, 2025]);
    expect(latestSummaryYear(dataset)).toBe(2025);
  });
});

describe("buildWardRows", () => {
  it("łączy zakresy w oddziały i liczy wartość na hospitalizację przy „<5” = 1", () => {
    const rows = buildWardRows(dataset, [2025]);
    const orthopedics = rows[0];

    expect(rows.map((row) => row.name)).toEqual(["Ortopedia i traumatologia", "Choroby wewnętrzne"]);
    expect(orthopedics).toMatchObject({ patients: 22, value: 1300000, hospCount: 17 });
    expect(orthopedics.valuePerHosp).toBeCloseTo(1300000 / 17);
    expect(orthopedics.valueShare).toBeCloseTo(1300000 / 1500000);
  });

  it("liczy średnią szpitala ważoną hospitalizacjami", () => {
    const rows = buildWardRows(dataset, [2025]);
    expect(hospitalValuePerHosp(rows)).toBeCloseTo(1500000 / 42);
    expect(hospitalValuePerHosp([])).toBeNull();
  });

  it("w latach bez danych o hospitalizacjach nie liczy wartości na hospitalizację", () => {
    const cardiology = buildWardRows(dataset, [2023]).find((row) => row.name === "Kardiologia")!;
    expect(cardiology.value).toBe(400000);
    expect(cardiology.valuePerHosp).toBeNull();
  });
});

describe("buildWardYearSeries", () => {
  it("zwraca pełne lata każdego oddziału ze średnią szpitala", () => {
    const [internal, cardiology] = buildWardYearSeries(dataset);

    expect(internal.map((point) => point.year)).toEqual([2023, 2024, 2025]);
    expect(internal.map((point) => point.value)).toEqual([0, 100000, 200000]);
    expect(cardiology[0].valuePerHosp).toBeNull();
    expect(cardiology[1].valuePerHosp).toBe(900000 / 80);
    expect(cardiology[1].hospitalValuePerHosp).toBe(1000000 / 88);
  });
});

describe("buildHospitalCodeRows", () => {
  it("zwraca kody z rozkładem wartości między oddziały", () => {
    const rows = buildHospitalCodeRows(dataset, [2024, 2025]);
    const e53g = rows.find((row) => row.code === "E53G")!;

    expect(rows.map((row) => row.code)).toEqual(["H52", "E53G", "D18"]);
    expect(e53g.name).toBe("Niewydolność krążenia");
    expect(e53g.wards).toEqual([
      { name: "Kardiologia", share: 0.9 },
      { name: "Choroby wewnętrzne", share: 0.1 },
    ]);
  });

  it("z filtrem oddziału liczy tylko ten oddział, ale zostawia pełny rozkład", () => {
    const rows = buildHospitalCodeRows(dataset, [2024, 2025], 0);
    const e53g = rows.find((row) => row.code === "E53G")!;

    expect(rows.map((row) => row.code)).toEqual(["D18", "E53G"]);
    expect(e53g.patients).toBe(10);
    expect(e53g.wards).toHaveLength(2);
  });

  it("wybiera najniżej wycenione kody z pominięciem rzadkich", () => {
    const rows = buildHospitalCodeRows(dataset, [2024, 2025]);
    expect(lowestValuePerHosp(rows, 0).map((row) => row.code)).toEqual(["D18", "E53G", "H52"]);
    expect(lowestValuePerHosp(rows, 30).map((row) => row.code)).toEqual(["E53G"]);
  });
});

describe("przychody", () => {
  it("łączy umowy z NFZ, wartość JGP oraz przychody i koszty ze sprawozdań w pełnych latach", () => {
    expect(buildIncomeSeries(dataset)).toEqual([
      { year: 2023, agreements: null, jgpAgreements: null, jgpSettled: 400000, revenue: null, costs: null },
      { year: 2024, agreements: 1100000, jgpAgreements: 900000, jgpSettled: 1000000, revenue: 9000000, costs: 11000000 },
      { year: 2025, agreements: 1700000, jgpAgreements: 1500000, jgpSettled: 1500000, revenue: 10000000, costs: 12500000 },
    ]);
  });

  it("zwraca umowy roku wg grup bez zerowych", () => {
    expect(agreementComposition(dataset, 2025)).toEqual([
      { group: "Hospitalizacje JGP – ryczałt sieci szpitali", amount: 1200000 },
      { group: "Hospitalizacje JGP poza ryczałtem", amount: 300000 },
      { group: "SOR", amount: 200000 },
    ]);
    expect(agreementComposition(dataset, 2019)).toEqual([]);
  });
});

describe("buildYearSeries", () => {
  it("zwraca pełne lata wybranego kodu", () => {
    const series = buildYearSeries(dataset, "H52");

    expect(series.map((point) => point.year)).toEqual([2023, 2024, 2025]);
    expect(series[2]).toEqual({ year: 2025, patients: 22, value: 1300000, hospMin: 17, partial: false });
  });

  it("filtruje po oddziale", () => {
    expect(buildYearSeries(dataset, null, 0).map((point) => point.patients)).toEqual([0, 10, 30]);
  });
});

describe("formatowanie", () => {
  it("formatuje kwoty i lata", () => {
    expect(formatPln(12703380).replace(/\s/g, " ")).toBe("12 703 380 zł");
    expect(formatPln(null)).toBe("–");
    expect(formatMillions(109697133)).toBe("109,7 mln zł");
    expect(formatMillions(-45187620)).toBe("−45,2 mln zł");
    expect(formatThousands(7633)).toBe("7,6 tys. zł");
    expect(formatThousands(null)).toBe("–");
    expect(formatYearRange([2025, 2022, 2023])).toBe("2022–2025");
    expect(formatYearRange([2024])).toBe("2024");
    expect(formatYearRange([])).toBe("–");
  });
});

describe("loadSanokHospitalDataset", () => {
  it("zgłasza błąd, gdy pobranie się nie uda", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, body: null }));
    await expect(loadSanokHospitalDataset()).rejects.toThrow("Nie udało się pobrać danych (500).");
  });

  it("rozpakowuje plik gzip", async () => {
    const compressed = new Response(JSON.stringify(dataset)).body!.pipeThrough(new CompressionStream("gzip"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: compressed }));
    await expect(loadSanokHospitalDataset()).resolves.toEqual(dataset);
  });
});
