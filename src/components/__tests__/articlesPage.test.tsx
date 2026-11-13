/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArticlesPage } from "@/components/articles/ArticlesPage";
import { metadata } from "@/app/artykuly/page";

afterEach(cleanup);

describe("Strona Artykuły", () => {
  it("pokazuje moduł jako planowany, bez artykułów, z linkami do działających modułów", () => {
    render(<ArticlesPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Artykuły");
    expect(screen.getByText("Planowane")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Hospitalizacje w Polsce" })).toHaveAttribute("href", "/hospitalizacje");
    expect(screen.getByRole("link", { name: "Grupy JGP" })).toHaveAttribute("href", "/jgp");
    expect(screen.getByRole("link", { name: "Szpitale publiczne" })).toHaveAttribute("href", "/szpitale");
  });

  it("ma metadane z adresem /artykuly", () => {
    expect(metadata.openGraph).toMatchObject({ url: "/artykuly", title: "Artykuły" });
  });
});
