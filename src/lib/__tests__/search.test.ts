import { describe, expect, it } from "vitest";
import {
  buildSearchIndex, interpretQuery, normalizeText, parseQuery, sameWord, searchAll, searchGroups, searchHospitals, tokenize,
} from "@/lib/search";
import { searchIndexFixture as index } from "@/lib/__tests__/fixtures/searchIndexFixture";
import { latestDatasetFixture } from "@/lib/__tests__/fixtures/trendsFixture";

describe("tekst", () => {
  it("usuwa polskie znaki, wielkość liter i znaki przestankowe", () => {
    expect(normalizeText("  Zawał – NOWA Sól?! ")).toBe("zawal nowa sol");
    expect(tokenize("E10, Łódź")).toEqual(["e10", "lodz"]);
    expect(tokenize("   ")).toEqual([]);
  });

  it("rozpoznaje odmianę słów, ale nie myli kodów ani krótkich słów", () => {
    expect(sameWord("nowej", "nowa")).toBe(true);
    expect(sameWord("soli", "sol")).toBe(true);
    expect(sameWord("krakowie", "krakow")).toBe(true);
    expect(sameWord("lubuskim", "lubuskie")).toBe(true);
    expect(sameWord("e10", "e11")).toBe(false);
    expect(sameWord("nowa", "nowotwor")).toBe(false);
  });
});

describe("buildSearchIndex", () => {
  it("sumuje hospitalizacje grup i świadczeniodawców metodą konserwatywną i sortuje od największych", () => {
    const built = buildSearchIndex(latestDatasetFixture);
    expect(built.year).toBe("2025");
    // P1 (A01): 8 + 4 + 18 = 30; P3 (F99): 50.
    expect(built.groups).toEqual([["F99", "Nowy w 2025", 50], ["A01", "Stały produkt", 30]]);
    expect(built.hospitals.map(([key, , city, , h]) => [key, city, h])).toEqual([["12|333", "GLIWICE", 50], ["12|222", "KATOWICE", 18], ["07|111", "WARSZAWA", 12]]);
    expect(built.regions).toEqual([["07", "Mazowieckie"], ["12", "Śląskie"]]);
  });
});

describe("searchGroups", () => {
  it("znajduje grupę po kodzie bez względu na wielkość liter", () => {
    expect(searchGroups(index, "e10").map((hit) => hit.code)).toEqual(["E10"]);
    expect(searchGroups(index, "e1").map((hit) => hit.code)).toEqual(["E11", "E10"]);
  });

  it("znajduje grupy po słowie z nazwy; każda grupa prowadzi do swojej karty", () => {
    const hits = searchGroups(index, "ozw");
    expect(hits.map((hit) => hit.code)).toEqual(["E11", "E10"]);
    expect(hits[0]).toMatchObject({ href: "/jgp/E11", hasPage: true });
    expect(hits[1]).toMatchObject({ href: "/jgp/E10", hasPage: true });
  });

  it("zamienia słowa potoczne i podpowiada niedokończone słowo", () => {
    expect(searchGroups(index, "zawał").map((hit) => hit.code)).toEqual(["E11", "E10"]);
    expect(searchGroups(index, "koronarog").map((hit) => hit.code)).toEqual(["E27"]);
    expect(searchGroups(index, "porod").map((hit) => hit.code)).toEqual(["N01"]);
  });
});

describe("searchHospitals", () => {
  it("szuka po nazwie i mieście, z odmianą, od największych", () => {
    expect(searchHospitals(index, "nowa sol").map((hit) => hit.key)).toEqual(["04|9251723350", "04|9252028623"]);
    expect(searchHospitals(index, "szpital w krakowie")[0]).toMatchObject({ key: "06|6751199442", city: "Kraków", region: "Małopolskie", href: "/szpitale?hospital=06%7C6751199442" });
  });

  it("rozróżnia wpisy jednego podmiotu w kilku oddziałach NFZ", () => {
    expect(searchHospitals(index, "scanmed").map((hit) => hit.region)).toEqual(["Śląskie", "Łódzkie"]);
  });
});

describe("parseQuery i interpretQuery", () => {
  it("rozpoznaje grupę, szpital (z odmianą) i perspektywę porównania", () => {
    const parsed = parseQuery(index, "Jak wyglądały hospitalizacje E10 w Nowej Soli w porównaniu do innych szpitali?");
    expect(parsed.group?.code).toBe("E10");
    expect(parsed.perspective).toBe("compare");
    expect(parsed.hospitals.map((hit) => hit.key)).toEqual(["04|9251723350", "04|9252028623"]);
    const [first] = interpretQuery(parsed);
    expect(first.href).toBe("/jgp/E10?osrodek=04%7C9251723350");
    expect(first.parts).toEqual(["E10", "WIELOSPECJALISTYCZNY SZPITAL W NOWEJ SOLI (Nowa Sól)", "na tle innych ośrodków"]);
  });

  it("grupa i szpital prowadzą do karty grupy z wyróżnionym szpitalem", () => {
    expect(interpretQuery(parseQuery(index, "E11 Kraków"))[0].href).toBe("/jgp/E11?osrodek=06%7C6751199442");
  });

  it("rozpoznaje województwo w dowolnej formie i rok", () => {
    const parsed = parseQuery(index, "e10 w kujawsko-pomorskim 2024");
    expect(parsed.region).toEqual({ owNfz: "02", name: "Kujawsko-Pomorskie" });
    expect(parsed.year).toBe("2024");
    expect(interpretQuery(parsed)[0]).toEqual({ href: "/analizy?t=g&jgp=E10&y=2024&ow=02", parts: ["E10", "woj. kujawsko-pomorskie"] });
  });

  it("prowadzi do sekcji karty dla grupy i perspektywy", () => {
    expect(interpretQuery(parseQuery(index, "e10 gdzie"))[0].href).toBe("/jgp/E10#jgp-regions");
    expect(interpretQuery(parseQuery(index, "e10 trend"))[0].href).toBe("/jgp/E10#jgp-trend");
    expect(interpretQuery(parseQuery(index, "e11 tryb przyjęcia"))[0].href).toBe("/jgp/E11#jgp-admissions");
  });

  it("szpital na tle innych → porównanie z podobnymi szpitalami", () => {
    expect(interpretQuery(parseQuery(index, "Kraków na tle innych"))[0].href).toBe("/szpitale?hospital=06%7C6751199442&hv=c");
  });

  it("pojedynczy element nie tworzy interpretacji; nieznane słowa trafiają do unknown", () => {
    expect(interpretQuery(parseQuery(index, "e10"))).toEqual([]);
    expect(parseQuery(index, "e10 qwerty").unknown).toEqual(["qwerty"]);
  });
});

describe("searchAll", () => {
  it("dla zdania z grupą zwraca interpretacje i szpitale z reszty słów", () => {
    const result = searchAll(index, "E10 Nowa Sól na tle innych");
    expect(result.interpretations.map((item) => item.href)).toEqual(["/jgp/E10?osrodek=04%7C9251723350", "/jgp/E10?osrodek=04%7C9252028623"]);
    expect(result.hospitals.map((hit) => hit.key)).toEqual(["04|9251723350", "04|9252028623"]);
  });

  it("dla samego szpitala zwraca tylko szpitale", () => {
    expect(searchAll(index, "nowa sol")).toMatchObject({ interpretations: [], groups: [] });
    expect(searchAll(index, "xyz")).toEqual({ interpretations: [], groups: [], hospitals: [] });
  });
});
