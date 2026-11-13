/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArticlesPage } from "@/components/articles/ArticlesPage";
import { metadata } from "@/app/artykuly/page";
import { ARTICLES } from "@/lib/articles";

afterEach(cleanup);

describe("Strona Artykuły", () => {
  it("pokazuje każdy artykuł z linkiem", () => {
    render(<ArticlesPage articles={ARTICLES} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Artykuły");
    expect(screen.getByRole("link", { name: /Czym są grupy JGP\?/ })).toHaveAttribute("href", "/artykuly/czym-sa-jgp");
    expect(screen.getAllByRole("listitem")).toHaveLength(ARTICLES.length);
    expect(screen.queryByText("Planowane")).not.toBeInTheDocument();
  });

  it("bez artykułów pokazuje moduł jako planowany, z linkami do działających modułów", () => {
    render(<ArticlesPage articles={[]} />);
    expect(screen.getByText("Planowane")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hospitalizacje w Polsce" })).toHaveAttribute("href", "/hospitalizacje");
    expect(screen.getByRole("link", { name: "Grupy JGP" })).toHaveAttribute("href", "/jgp");
    expect(screen.getByRole("link", { name: "Szpitale publiczne" })).toHaveAttribute("href", "/szpitale");
  });

  it("ma metadane z adresem /artykuly", () => {
    expect(metadata.openGraph).toMatchObject({ url: "/artykuly", title: "Artykuły" });
  });
});
