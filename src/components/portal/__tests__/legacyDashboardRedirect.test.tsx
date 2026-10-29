/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LegacyDashboardRedirect } from "@/components/portal/LegacyDashboardRedirect";

const replace = vi.fn();

function visit(search: string, hash = "") {
  vi.stubGlobal("location", { ...window.location, search, hash, replace });
}

beforeEach(() => replace.mockReset());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LegacyDashboardRedirect", () => {
  it("przenosi stary link dashboardu ze strony głównej pod /analizy", () => {
    visit("?t=h&hospital=07%7C111", "#top");
    render(<LegacyDashboardRedirect />);
    expect(replace).toHaveBeenCalledWith("/analizy?t=h&hospital=07%7C111#top");
  });

  it("nie przekierowuje zwykłego wejścia na stronę główną", () => {
    visit("");
    render(<LegacyDashboardRedirect />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignoruje parametry, których dashboard nie używa", () => {
    visit("?utm_source=newsletter");
    render(<LegacyDashboardRedirect />);
    expect(replace).not.toHaveBeenCalled();
  });
});
