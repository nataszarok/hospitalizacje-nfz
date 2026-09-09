\set ON_ERROR_STOP on
BEGIN;
TRUNCATE TABLE
    public.facility_product_duration_admission,
    public.facilities,
    public.products,
    public.population_voivodeship,
    public.nfz_regions,
    public.admission_modes,
    public.app_config;
\copy public.facilities FROM 'data_exports/supabase/facilities.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy public.products FROM 'data_exports/supabase/products.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy public.population_voivodeship FROM 'data_exports/supabase/population_voivodeship.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy public.nfz_regions FROM 'data_exports/supabase/nfz_regions.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy public.admission_modes FROM 'data_exports/supabase/admission_modes.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy public.app_config FROM 'data_exports/supabase/app_config.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy public.facility_product_duration_admission FROM 'data_exports/supabase/facility_product_duration_admission.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
COMMIT;
ANALYZE public.facilities;
ANALYZE public.products;
ANALYZE public.facility_product_duration_admission;
