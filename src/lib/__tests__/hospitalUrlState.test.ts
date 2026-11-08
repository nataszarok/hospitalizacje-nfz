import { describe, expect, it } from "vitest";
import { DEFAULT_HOSPITAL_KEY, hospitalUrlSearch, readHospitalUrlState } from "@/lib/hospitalUrlState";

describe("stan strony /szpitale w adresie", () => {
  it("bez parametru otwiera szpital domyślny (Koszalin); domyślny stan nie trafia do adresu", () => {
    expect(DEFAULT_HOSPITAL_KEY).toBe("16|6691044410");
    expect(readHospitalUrlState("")).toEqual({ hospitalKey: DEFAULT_HOSPITAL_KEY, view: "summary", method: "min", peerDistance: 10.01 });
    expect(readHospitalUrlState("?hospital=%20")).toMatchObject({ hospitalKey: DEFAULT_HOSPITAL_KEY });
    expect(hospitalUrlSearch({ hospitalKey: DEFAULT_HOSPITAL_KEY, view: "summary", method: "min", peerDistance: 10.01 })).toBe("");
    expect(hospitalUrlSearch({ hospitalKey: "", view: "summary", method: "min", peerDistance: 10.01 })).toBe("");
  });

  it("zapisuje i odczytuje szpital, widok Porównanie i metodę", () => {
    const state = { hospitalKey: "07|111", view: "comparison" as const, method: "sim" as const, peerDistance: 10.01 };
    const search = hospitalUrlSearch(state);
    expect(search).toBe("?hospital=07%7C111&hv=c&m=sim");
    expect(readHospitalUrlState(search)).toEqual(state);
  });

  it("dawne hv=s otwiera Porównanie, nieznane wartości dają ustawienia domyślne", () => {
    expect(readHospitalUrlState("?hv=s").view).toBe("comparison");
    expect(readHospitalUrlState("?hv=x&m=bad")).toMatchObject({ view: "summary", method: "min" });
  });

  it("koduje dystans par (pd) tylko poza domyślną granicą A", () => {
    const state = { hospitalKey: "07|111", view: "comparison" as const, method: "min" as const, peerDistance: 13.51 };
    const search = hospitalUrlSearch(state);
    expect(new URLSearchParams(search).get("pd")).toBe("13.51");
    expect(readHospitalUrlState(search)).toEqual(state);
  });

  it.each([
    ["?pd=7.26", 7.26],
    ["?pd=abc", 10.01],
    ["?pd=-1", 2.01],
    ["?pd=99", 17.06],
    ["?pd=12.3456", 12.36],
  ] as const)("bezpiecznie parsuje dystans %s", (search, distance) => {
    expect(readHospitalUrlState(search).peerDistance).toBe(distance);
  });
});
