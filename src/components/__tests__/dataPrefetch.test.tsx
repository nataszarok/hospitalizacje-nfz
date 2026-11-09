/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

const prefetchForHref = vi.fn((href: string) => (href.startsWith("/analizy") ? "analizy" : href.startsWith("/szpitale") ? "szpitale" : null));
vi.mock("@/lib/dataPrefetch", () => ({ prefetchForHref: (href: string) => prefetchForHref(href) }));
const { DataPrefetch } = await import("@/components/portal/DataPrefetch");

afterEach(() => { cleanup(); prefetchForHref.mockClear(); });

describe("DataPrefetch — pobieranie z wyprzedzeniem po najechaniu na link", () => {
  it("najechanie, fokus albo dotyk linku do eksploratora lub szpitali pobiera dane raz; inne linki pomija", () => {
    const { container } = render(<div>
      <DataPrefetch />
      <a href="/analizy?t=k"><span>Eksplorator</span></a>
      <a href="/szpitale">Szpitale</a>
      <a href="https://example.com/jgp">Katalog</a>
    </div>);
    const [explorer, hospitals, catalog] = container.querySelectorAll("a");
    fireEvent.pointerOver(explorer.firstChild!);
    fireEvent.focusIn(explorer);
    fireEvent.touchStart(hospitals);
    fireEvent.pointerOver(catalog);
    expect(prefetchForHref.mock.calls.map(([href]) => href)).toEqual(["/analizy?t=k", "/szpitale"]);
  });
});
