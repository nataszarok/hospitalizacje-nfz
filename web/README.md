# Web dashboard (Next.js + TypeScript)

Nowa aplikacja jest budowana równolegle do istniejącego Streamlita. Katalog `web/` nie zastępuje `app.py`, `dashboard/` ani `db_build/`.

## Zakres tego etapu

- Next.js App Router + TypeScript.
- Backend Node.js z `pg` i `DATABASE_URL` do PostgreSQL/Supabase.
- `/api/reference` — produkty, województwa, miasta, długości pobytu i konfiguracja.
- `/api/mortality` — pierwszy kompletny backend dla zakładki „Wolumen i śmiertelność”.
- Semantyka current/baseline zgodna ze Streamlitem: current uwzględnia długość pobytu i próg, baseline ignoruje oba.
- Próg jest liczony per `(OW_NFZ, NIP)` po zsumowaniu wszystkich wybranych produktów.
- Geografia jest tylko wyróżnieniem na froncie i nie filtruje SQL.
- Obsługa metod `<5`: `min` i `sim`.
- Oś X: wolumen lub hospitalizacje / 100 000 ludności województwa OW NFZ.
- Do 5 produktów i do 5 wyróżnianych województw/miast.

Zakładki „Tryb przyjęcia” i „Metodologia i dane” są widoczne jako następne etapy, ale w tym patchu są jeszcze wyłączone.

## Konfiguracja lokalna

```bash
cd web
cp .env.example .env.local
```

W `.env.local` ustaw `DATABASE_URL` na connection string PostgreSQL Supabase. Nie używaj prefiksu `NEXT_PUBLIC_` — hasło do bazy ma pozostać wyłącznie po stronie serwera.

```bash
npm install
npm run dev
```

Aplikacja: http://localhost:3000

## Test kompilacji

```bash
npm run typecheck
npm run build
```

## Vercel

Root Directory projektu Vercel ustaw na `web`. Dodaj `DATABASE_URL` jako Environment Variable. Kod korzystający z bazy działa w Node.js Route Handlers, nie w przeglądarce.
