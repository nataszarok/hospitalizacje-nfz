import { describe, expect, it } from "vitest";
import { hospitalUrlSearch, readHospitalUrlState } from "@/lib/hospitalUrlState";

describe("stan strony /szpitale w adresie", () => {
  it("domyślny stan nie trafia do adresu", () => {
    expect(readHospitalUrlState("")).toEqual({ hospitalKey: "", view: "summary", method: "min" });
    expect(hospitalUrlSearch({ hospitalKey: "", view: "summary", method: "min" })).toBe("");
  });

  it("zapisuje i odczytuje szpital, widok Porównanie i metodę", () => {
    const state = { hospitalKey: "07|111", view: "comparison" as const, method: "sim" as const };
    const search = hospitalUrlSearch(state);
    expect(search).toBe("?hospital=07%7C111&hv=c&m=sim");
    expect(readHospitalUrlState(search)).toEqual(state);
  });

  it("dawne hv=s otwiera Porównanie, nieznane wartości dają ustawienia domyślne", () => {
    expect(readHospitalUrlState("?hv=s").view).toBe("comparison");
    expect(readHospitalUrlState("?hv=x&m=bad")).toMatchObject({ view: "summary", method: "min" });
  });
});
