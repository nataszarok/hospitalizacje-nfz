import { describe, expect, it } from "vitest";
import { buildJgpDescription, inSentence, plural, type JgpProfilesFile } from "@/lib/jgpDescription";
import { familyFor } from "@/lib/jgpGroupInfo";

// Wycinek prawdziwych danych API statystyk JGP NFZ za 2024 r. (E10, H55) i grupa zachowawcza z rozproszonymi rozpoznaniami.
const profiles: JgpProfilesFile = {
  version: 1,
  source: "test",
  icd10: {
    "I21.4": "Ostry zawał serca podwsierdziowy", "I21.9": "Ostry zawał serca, nie określony", "I21.0": "Ostry zawał serca pełnościenny ściany przedniej",
    "M51.1": "Choroby krążka międzykręgowego lędźwiowego i innych odcinków z uszkodzeniem korzeni nerwowych", "M47.8": "Inne zmiany zwyrodnieniowe kręgosłupa",
    "D38.0": "Nowotwór o niepewnym charakterze krtani", "J37.0": "Przewlekłe zapalenie krtani",
  },
  icd9: { "88.56": "Koronarografia z użyciem dwóch cewników", "88.57": "Koronarografia - inne", "88.55": "Koronarografia z użyciem jednego cewnika", "03.96": "Przezskórne odnerwienie powierzchni stawowej wyrostka kręgu", "80.502": "Inna" },
  groups: {
    E10: ["2024", 8957, 8995, 4, [["I21.4", 56.6], ["I21.9", 34.2], ["I21.0", 3.4]], [["88.56", 90.7], ["88.57", 5.1], ["88.55", 3.7]]],
    H55: ["2024", 25816, 30971, 0, [["M51.1", 26.9], ["M47.8", 24.7]], [["03.96", 97.6], ["80.502", 2.1]]],
    X01: ["2024", null, 120, null, [["D38.0", 4.2], ["J37.0", 3.9]], []],
    X02: ["2023", 40, 41, 2, [["J37.0", 61.2]], [], 1],
  },
};

describe("buildJgpDescription — opis grupy z danych NFZ", () => {
  it("E10: rozpoznania i procedury od 5% pobytów, mediana pobytu, liczby i rodzina", () => {
    const description = buildJgpDescription("E10", profiles, familyFor("E10"))!;
    expect(description.sentences).toEqual([
      "Najczęstsze rozpoznania główne: ostry zawał serca podwsierdziowy (I21.4, 57%) i ostry zawał serca, nie określony (I21.9, 34%).",
      "Procedury z listy kierunkowej grupy: koronarografia z użyciem dwóch cewników (88.56) w 91% pobytów i koronarografia - inne (88.57) w 5,1% pobytów.",
      "Mediana pobytu: 4 dni; 8995 hospitalizacji u 8957 pacjentów w 2024 r.",
      "Należy do rodziny „Ostry zespół wieńcowy (OZW)”; pozostałe warianty: E11, E12G, E15, E16 i E17G.",
    ].map((s) => s.replace("8995", (8995).toLocaleString("pl-PL")).replace("8957", (8957).toLocaleString("pl-PL"))));
    expect(description.source).toBe("Źródło: NFZ, statystyki JGP 2024 (rozpoznania ICD-10, procedury ICD-9 z listy kierunkowej, dane ogólne); rodzina: lista portalu.");
  });

  it("mediana 0 dni ma objaśnienie; procedura poniżej 5% nie trafia do opisu", () => {
    const [, procedures, stay] = buildJgpDescription("H55", profiles)!.sentences;
    expect(procedures).toBe("Procedury z listy kierunkowej grupy: przezskórne odnerwienie powierzchni stawowej wyrostka kręgu (03.96) w 98% pobytów.");
    expect(stay).toMatch(/^Mediana pobytu: 0 dni \(wypis w dniu przyjęcia\); /);
  });

  it("rozproszone rozpoznania, brak procedur i mediany; bez rodziny wiersz źródła jej nie wymienia", () => {
    const description = buildJgpDescription("X01", profiles)!;
    expect(description.sentences).toEqual([
      "Rozpoznania są rozproszone: żadne nie przekracza 5% pobytów; najczęstsze to nowotwór o niepewnym charakterze krtani (D38.0, 4,2%).",
      "120 hospitalizacji w 2024 r.",
    ]);
    expect(description.source).toBe("Źródło: NFZ, statystyki JGP 2024 (rozpoznania ICD-10, dane ogólne).");
  });

  it("grupa tylko z listą kierunkową rozpoznań ma inne zdanie niż grupa z rozpoznaniami głównymi", () => {
    const description = buildJgpDescription("X02", profiles)!;
    expect(description.sentences[0]).toBe("Rozpoznania z listy kierunkowej grupy: przewlekłe zapalenie krtani (J37.0, 61%).");
    expect(description.sentences[1]).toBe("Mediana pobytu: 2 dni; 41 hospitalizacji u 40 pacjentów w 2023 r.");
    expect(description.source).toBe("Źródło: NFZ, statystyki JGP 2023 (rozpoznania ICD-10 z listy kierunkowej, dane ogólne).");
  });

  it("bez danych API grupy opisu nie ma", () => {
    expect(buildJgpDescription("Z99", profiles)).toBeNull();
    expect(buildJgpDescription("E10", null)).toBeNull();
  });

  it("odmiana po liczebniku", () => {
    expect([1, 2, 4, 5, 12, 14, 22, 73, 112].map((n) => plural(n, "hospitalizacja", "hospitalizacje", "hospitalizacji"))).toEqual([
      "hospitalizacja", "hospitalizacje", "hospitalizacje", "hospitalizacji", "hospitalizacji", "hospitalizacji", "hospitalizacje", "hospitalizacje", "hospitalizacji",
    ]);
  });

  it("nazwa ze słownika w środku zdania: mała litera, skróty bez zmian", () => {
    expect(inSentence("Koronarografia - inne")).toBe("koronarografia - inne");
    expect(inSentence("HIV - choroba")).toBe("HIV - choroba");
    expect(inSentence("Zapalenie płuc.")).toBe("zapalenie płuc");
  });
});
