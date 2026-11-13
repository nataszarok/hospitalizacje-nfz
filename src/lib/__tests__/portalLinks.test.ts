import { describe, expect, it } from "vitest";
import { hospitalCardHref, hospitalPageKey, hospitalSlug } from "@/lib/hospitalPages";
import { explorerHref, hospitalComparisonHref, hospitalHref, jgpHref } from "@/lib/portalLinks";

describe("linki portalu", () => {
  it("szpital bez karty nie ma adresu (nie ma strony, widoki pokazują nazwę bez linku)", () => {
    expect(hospitalHref("07", "1234567890")).toBeNull();
  });

  it("szpital z kartą prowadzi do /szpitale/<NIP>-<OW>; fragment adresu daje klucz OW|NIP tylko dla szpitali z kartą", () => {
    expect(hospitalHref("16", "6691044410")).toBe("/szpitale/6691044410-16");
    expect(hospitalSlug("16|6691044410")).toBe("6691044410-16");
    expect(hospitalCardHref("07", "6691044410")).toBeNull();
    expect(hospitalPageKey("6691044410-16")).toBe("16|6691044410");
    expect(hospitalPageKey("6691044410")).toBeNull();
    expect(hospitalPageKey("1234567890-07")).toBeNull();
  });

  it("porównanie z podobnymi: strona porównania szpitali, także dla szpitala z kartą", () => {
    expect(hospitalComparisonHref("16", "6691044410")).toBe("/szpitale/eksplorator?hospital=16%7C6691044410&hv=c");
  });

  it("linkuje każdą grupę JGP do jej karty", () => {
    expect(jgpHref("E10")).toBe("/jgp/E10");
    expect(jgpHref("F04")).toBe("/jgp/F04");
    expect(jgpHref(null)).toBeNull();
    expect(jgpHref("")).toBeNull();
  });
});

describe("explorerHref — widok eksploratora dla grupy JGP", () => {
  it("W czasie bez parametru widoku; pozostałe widoki z `t`, rokiem i województwami", () => {
    expect(explorerHref("E53G", "trend")).toBe("/analizy?jgp=E53G");
    expect(explorerHref("E53G", "mortality", { year: "2024", regions: ["07", "12"] })).toBe("/analizy?t=k&jgp=E53G&y=2024&ow=07&ow=12");
    expect(explorerHref("E53G", "admissions", { year: "2025" })).toBe("/analizy?t=a&jgp=E53G&y=2025");
    expect(explorerHref("E53G", "regions")).toBe("/analizy?t=g&jgp=E53G");
  });
});
