# Atlas Publicznej Ochrony Zdrowia (hospitalizacje-nfz)

## Cel projektu

Rozwijamy aplikację do analizy danych o hospitalizacjach NFZ. Obecna wersja to POC w formie dashboardu.
Docelowo ma to być jedna porządna strona internetowa — **Atlas Publicznej Ochrony Zdrowia** (nazwa w `src/lib/site.ts`) — z modułami:

- analiza hospitalizacji,
- porównanie szpitali,
- analiza porównawcza szpitali (model par / peerów),
- analiza JGP i zmian w wycenach,
- artykuły.

Docelowo projekt wymaga porządnego redesignu (z dashboardu na portal z nawigacją między modułami).
Przy nowych funkcjach myśl o tym kierunku: komponenty mają być wielokrotnego użytku i niezależne od
obecnego układu `Dashboard` + `Sidebar`.

## Zasady pracy

- **Testy przy każdej większej zmianie.** Przed commitem większej zmiany (nie przy drobnych poprawkach)
  nowe komponenty i funkcje mają być dobrze pokryte testami. Przed commitem uruchom
  `npm test`, `npm run lint` i `npm run typecheck` — wszystko musi przechodzić.
- **Nigdy nie pushuj do `main`.** Push do `main` = deploy produkcyjny na Cloudflare Pages
  (`.github/workflows`).
- Każda nowa zmiana dostaje dedykowany branch (`feature/*` / `bugfix/*`). Po każdym commicie
  pushuj ten branch na `origin`. Do `main` trafia tylko przez PR (squash merge).
- Teksty w UI i komentarze w kodzie piszemy po polsku. Commity i opisy PR — po angielsku.

## Stack

- Next.js 16 (App Router, `output: "export"` — statyczny eksport do `dist/`), React 19, TypeScript.
- Mantine 9 (kontrolki: `Select`, `SegmentedControl`, `NumberInput`…), Plotly (`plotly.js-dist-min`).
- Style: globalne CSS (`src/app/globals.css`, `src/components/*.css`) i CSS Modules (`*.module.css`).
- Testy: Vitest + Testing Library. Testy komponentów wymagają na górze pliku
  `/** @vitest-environment jsdom */` (domyślne środowisko to `node`).

## Komendy

```bash
npm run dev          # serwer deweloperski
npm test             # testy (vitest run)
npm run lint
npm run typecheck
npm run build        # verify:static + next build + finalize → dist/
npm run refresh:data # przebudowa public/data/dashboard.json.gz z data_exports/
```

## Struktura

- `src/app/` — strony: `/` (strona główna portalu) i `/analizy` (dashboard). Pliki `page.tsx` mogą
  eksportować tylko stronę i metadane — widoki trzymaj w komponentach.
  Stare linki dashboardu z parametrami na `/` przekierowuje `LegacyDashboardRedirect`.
- `src/components/portal/` — elementy portalu: `HomePage` (widok strony głównej; liczby w pasku faktów
  liczy `datasetHighlights` podczas budowania), `SiteHeader` (nagłówek w `layout.tsx`), `PortalIcon`.
  Grafika hero (`public/images/hero-data.svg`) powstaje z danych skryptem `scripts/build_hero_art.py`
  (szpitale: hospitalizacje × udział przyjęć nagłych) — bez zdjęć i zewnętrznych licencji.
  Po aktualizacji `dashboard.json.gz` uruchom skrypt ponownie.
  Nagłówek i dashboard synchronizują zakładkę zdarzeniami z `src/lib/dashboardNavigation.ts`;
  adresy podstron dashboardu są w `DASHBOARD_HREFS`.
- `src/components/` — komponenty UI. Zakładka „Profil szpitala” to `HospitalAnalysisTab`
  z widokami Profil / Porównanie.
  - `HospitalSimilarityTab` — aktualna analiza porównawcza (model par A/B).
  - `HospitalComparisonLegacyTab` — stara metoda, **odłączona** od UI, zostaje w repo.
  - `HospitalComparisonShared` — wspólne wykresy/tabele porównań i typ `PeerPair`.
- `src/lib/` — logika danych: `staticData.ts` (ładowanie i agregacje), `dashboardUrlState.ts`
  (stan w URL), `types.ts`, `query.ts`, `metrics.ts`.
- Testy w `__tests__/` obok kodu, fixtures w `__tests__/fixtures/`.
- `scripts/` — budowanie danych statycznych (Node i Python).
- `db_build/` — pipeline bazy (lokalny, w `.gitignore`).

## Dane

- Do repo trafiają tylko kompaktowe pliki dla przeglądarki w `public/data/*.json.gz`.
- Duże pliki źródłowe trzymamy w `data/` (w `.gitignore`). Każdy plik w `public/data/` powinien mieć
  skrypt, który go buduje ze źródła i zostawia tylko to, co czyta UI, np.:
  - `scripts/build_peer_pairs.py`: `data/peer_pairs_ab.json.gz` → `public/data/peer_pairs_ab.json.gz`
    (pary A i B, tylko kolumny czytane przez UI; nowe pole czytane z `PeerPair` dopisz do `FIELDS`),
  - `scripts/build_rpwdl_summary_profiles.py`, `scripts/build_financial_results.py`.
- Świadczeniodawca = unikalna para OW NFZ + NIP (klucz `"07|1234567890"`).
- Wartości `<5` w danych źródłowych są estymowane: metoda `sim` (symulacyjna) lub `min` (konserwatywna).

## Uwagi

- `next dev` dopisuje do tego pliku blok `nextjs-agent-rules` (poniżej). Zostaw go — inaczej Next doda go ponownie.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
