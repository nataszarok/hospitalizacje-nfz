import { describe, expect, it } from "vitest";
import { explorerHref, hospitalHref, jgpHref } from "@/lib/portalLinks";

describe("linki portalu", () => {
  it("buduje adres profilu z kluczem OW|NIP", () => {
    expect(hospitalHref("07", "1234567890")).toBe("/szpitale?hospital=07%7C1234567890");
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
