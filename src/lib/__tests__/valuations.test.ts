import { describe, expect, it } from "vitest";
import { decodeValuations, type ValuationsFile } from "@/lib/valuations";

describe("decodeValuations", () => {
  it("zamienia krotki na rekordy według listy pól", () => {
    const file: ValuationsFile = {
      version: 2, year: "2025", source: "test",
      fields: ["kod_jgp", "pkt_hospitalizacja", "dni_finansowane_grupa"],
      rows: [["E10", 4161, null], ["A01", 8207, 30]],
    };
    expect(decodeValuations(file)).toEqual([
      { kod_jgp: "E10", pkt_hospitalizacja: 4161, dni_finansowane_grupa: null },
      { kod_jgp: "A01", pkt_hospitalizacja: 8207, dni_finansowane_grupa: 30 },
    ]);
  });

  it("brakującą wartość w krótszym wierszu zapisuje jako null", () => {
    expect(decodeValuations({ version: 2, year: "2025", source: "t", fields: ["kod_jgp", "pkt_hospitalizacja"], rows: [["E10"]] }))
      .toEqual([{ kod_jgp: "E10", pkt_hospitalizacja: null }]);
  });
});
