"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { SEARCH_INDEX_PATH, searchAll, type SearchIndex } from "@/lib/search";
import styles from "./SearchBox.module.css";

const integer = (value: number) => Math.round(value).toLocaleString("pl-PL");

// Indeks pobieramy raz na sesję, przy pierwszym kliknięciu w pole.
let indexPromise: Promise<SearchIndex> | null = null;
function loadSearchIndex() {
  indexPromise ??= fetch(SEARCH_INDEX_PATH).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<SearchIndex>;
  }).catch((error: unknown) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

/** Tylko dla testów: czyści indeks zapamiętany w module. */
export function resetSearchIndexCache() {
  indexPromise = null;
}

type Option = { id: string; href: string; section: string; primary: string; secondary: string; code?: string };

function buildOptions(index: SearchIndex, query: string): Option[] {
  const { interpretations, groups, hospitals } = searchAll(index, query);
  return [
    ...interpretations.map((item, i): Option => ({ id: `i${i}`, href: item.href, section: "Rozumiem pytanie jako", primary: item.parts.join(" · "), secondary: "" })),
    ...groups.map((hit): Option => ({
      id: `g-${hit.code}`, href: hit.href, section: "Grupy JGP", code: hit.code, primary: hit.name,
      secondary: `${integer(hit.hospitalizations)} hosp. · ${index.year}${hit.hasPage ? " · karta grupy" : " · eksplorator"}`,
    })),
    ...hospitals.map((hit): Option => ({
      id: `h-${hit.key}`, href: hit.href, section: "Szpitale", primary: hit.name,
      secondary: `${hit.city} · OW ${hit.region} · ${integer(hit.hospitalizations)} hosp. · ${index.year}`,
    })),
  ];
}

export type SearchBoxProps = {
  /** „hero” — duże pole na stronie głównej; „header” — kompaktowe w nagłówku. */
  variant?: "hero" | "header";
  autoFocus?: boolean;
  /** Wywoływane po przejściu do wyniku (np. zamknięcie menu w nagłówku). */
  onNavigate?: () => void;
};

/** Wyszukiwarka portalu: grupy JGP, szpitale i proste zdania („E10 Nowa Sól na tle innych”). Bez AI. */
export function SearchBox({ variant = "hero", autoFocus = false, onNavigate }: SearchBoxProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => index && query.trim() ? buildOptions(index, query) : [], [index, query]);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const ensureIndex = () => {
    if (index) return;
    loadSearchIndex().then((loaded) => { setIndex(loaded); setError(false); }).catch(() => setError(true));
  };

  const go = (option: Option | undefined) => {
    if (!option) return;
    setOpen(false);
    setQuery("");
    onNavigate?.();
    router.push(option.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => options.length ? (current + 1) % options.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => options.length ? (current - 1 + options.length) % options.length : 0);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length > 0;
  const activeOption = showList ? options[Math.min(active, options.length - 1)] : undefined;

  return <form
    role="search"
    className={`${styles.search} ${variant === "header" ? styles.header : styles.hero}`}
    onSubmit={(event) => { event.preventDefault(); go(activeOption ?? options[0]); }}
  >
    <label className={styles.field}>
      <span className={styles.icon}><PortalIcon name="search" size={variant === "header" ? 17 : 20} /></span>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Szukaj grupy JGP albo szpitala"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
        placeholder={variant === "header" ? "Szukaj: E10, ozw, szpital…" : "Kod JGP, nazwa grupy, szpital albo miasto"}
        value={query}
        onFocus={() => { ensureIndex(); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); ensureIndex(); }}
        onKeyDown={onKeyDown}
      />
    </label>
    {showList ? <div id={listId} role="listbox" aria-label="Wyniki wyszukiwania" className={styles.list}>
      {error ? <div className={styles.status}>Nie udało się pobrać wyszukiwarki. Spróbuj ponownie.</div>
        : !index ? <div className={styles.status}>Ładowanie…</div>
        : !options.length ? <div className={styles.status}>Brak wyników dla „{query.trim()}”. Wpisz kod JGP (np. E10), nazwę grupy, szpitala albo miasto.</div>
        : options.map((option, i) => <div key={option.id} role="presentation">
          {i === 0 || options[i - 1].section !== option.section ? <div className={styles.section} role="presentation">{option.section}</div> : null}
          <div
            id={`${listId}-${option.id}`}
            role="option"
            aria-selected={option === activeOption}
            className={`${styles.option} ${option === activeOption ? styles.optionActive : ""} ${option.section === "Rozumiem pytanie jako" ? styles.interpretation : ""}`}
            // mousedown zamiast click: inaczej blur pola zamyka listę przed wyborem.
            onMouseDown={(event) => { event.preventDefault(); go(option); }}
            onMouseEnter={() => setActive(i)}
          >
            {option.code ? <span className={styles.code}>{option.code}</span> : null}
            <span className={styles.text}>
              <span className={styles.primary}>{option.primary}</span>
              {option.secondary ? <span className={styles.secondary}>{option.secondary}</span> : null}
            </span>
          </div>
        </div>)}
    </div> : null}
  </form>;
}
