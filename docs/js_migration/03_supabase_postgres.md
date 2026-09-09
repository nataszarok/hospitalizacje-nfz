# Etap 3 — PostgreSQL / Supabase

Produkcja nie kopiuje pliku SQLite ani tabeli `hospitalizacje`. Publikowany jest wyłącznie serving layer.

## Tabele
- `facilities` — tylko 833 świadczeniodawców występujących w danych dashboardu.
- `products` — tylko produkty występujące w serving layer.
- `facility_product_duration_admission` — główny fakt (543 633 wiersze w aktualnym buildzie).
- `population_voivodeship`, `nfz_regions`, `admission_modes`, `app_config` — małe słowniki.

## Import
1. `poetry run python -m db_build.export_serving_layer`
2. Utworzyć projekt Supabase i pobrać connection string z panelu Connect.
3. DDL: `psql "$SUPABASE_DB_URL" -f db_build/postgres/schema.sql`
4. Dane (uruchomić z katalogu projektu): `psql "$SUPABASE_DB_URL" -f db_build/postgres/load_with_psql.sql`
5. Walidacja: `psql "$SUPABASE_DB_URL" -f db_build/postgres/validate.sql`

Do migracji/bulk load używamy direct connection albo session pooler. Dla przyszłego runtime Next.js/Vercel użyjemy transaction pooler i wyłączymy prepared statements w kliencie, zgodnie z wymaganiami Supavisor transaction mode.

Connection string jest sekretem. Nie zapisujemy go w repozytorium, ZIP-ach ani kodzie.
