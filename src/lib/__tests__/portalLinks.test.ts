import { describe, expect, it } from "vitest";
import { hospitalHref, jgpHref } from "@/lib/portalLinks";

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
