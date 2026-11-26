/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleVideo } from "@/components/articles/ArticleVideo";
import { KoszalinFilmArticle } from "@/components/articles/KoszalinFilmArticle";
import { KOSZALIN_FILM_SOURCES } from "@/components/articles/koszalinFilm";
import { findArticle } from "@/lib/articles";

afterEach(cleanup);

describe("KoszalinFilmArticle", () => {
  it("ma tytuł i wstęp z 3 zdań, bez spisu treści i bez tekstu filmu", () => {
    render(<KoszalinFilmArticle />);
    expect(screen.getByRole("heading", { level: 1, name: "Koszalin: H52 i H53 miesiąc po miesiącu" })).toBeInTheDocument();
    const lead = document.querySelector("main > header p")!;
    // Każde zdanie wstępu kończy się przypisem.
    expect(lead.querySelectorAll("sup")).toHaveLength(3);
    expect(lead).toHaveTextContent("ze 109 do 19");
    expect(screen.queryByRole("navigation", { name: "Spis treści" })).not.toBeInTheDocument();
    expect(screen.queryByText("Tekst filmu")).not.toBeInTheDocument();
  });

  it("pokazuje film i kadr z wpisu w ARTICLES; oba pliki są w public/", () => {
    render(<KoszalinFilmArticle />);
    const { video } = findArticle("film-koszalin-h52-h53");
    const element = document.querySelector("#film video")!;
    expect(element).toHaveAttribute("src", video!.src);
    expect(element).toHaveAttribute("poster", video!.poster);
    for (const file of [video!.src, video!.poster]) expect(existsSync(join(process.cwd(), "public", file)), file).toBe(true);
    expect(document.querySelector("#film figure p")).toBeNull();
  });

  it("każdy odsyłacz prowadzi do przypisu, a numer przypisu = kolejność pierwszego użycia", () => {
    render(<KoszalinFilmArticle />);
    const refs = [...document.querySelectorAll("sup a[href^='#przypis-']")];
    for (const ref of refs) expect(document.getElementById(ref.getAttribute("href")!.slice(1))).not.toBeNull();
    expect(document.querySelectorAll("#przypisy li")).toHaveLength(KOSZALIN_FILM_SOURCES.length);
    const firstUse = [...new Set(refs.map((ref) => Number(ref.getAttribute("href")!.slice("#przypis-".length))))];
    expect(firstUse).toEqual(KOSZALIN_FILM_SOURCES.map((_, i) => i + 1));
  });

  it("jest na liście artykułów jako film", () => {
    expect(findArticle("film-koszalin-h52-h53").kicker).toBe("Film");
  });
});

describe("ArticleVideo", () => {
  it("odtwarzacz bez autoodtwarzania, z kontrolkami, opisem i linkiem zapasowym do pliku", () => {
    render(<ArticleVideo title="Tytuł filmu" src="/video/a.mp4" ariaLabel="Opis filmu" caption="Źródło: test" />);
    const figure = screen.getByRole("figure", { name: "Tytuł filmu" });
    const video = figure.querySelector("video")!;
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("aria-label", "Opis filmu");
    expect(within(figure).getByText("Pobierz film (MP4)")).toHaveAttribute("href", "/video/a.mp4");
    expect(figure).toHaveTextContent("Źródło: test");
  });
});
