BEGIN;

CREATE TABLE IF NOT EXISTS public.facilities (
    ow_nfz text NOT NULL,
    nip text NOT NULL,
    provider_name text NOT NULL,
    provider_name_official text,
    city text,
    provider_code text,
    regon text,
    postal_code text,
    street text,
    municipality text,
    phone text,
    PRIMARY KEY (ow_nfz, nip)
);

CREATE TABLE IF NOT EXISTS public.products (
    product_code text PRIMARY KEY,
    jgp_code text,
    product_name text
);

CREATE TABLE IF NOT EXISTS public.population_voivodeship (
    ow_nfz text PRIMARY KEY,
    voivodeship text NOT NULL,
    population bigint NOT NULL CHECK (population > 0),
    reference_date date NOT NULL,
    source_year integer NOT NULL,
    source_publication text NOT NULL,
    source_table text NOT NULL,
    source_sheet text NOT NULL,
    source_unit text NOT NULL,
    source_url text NOT NULL,
    source_file text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.nfz_regions (
    ow_nfz text PRIMARY KEY,
    voivodeship text NOT NULL,
    sort_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admission_modes (
    code integer PRIMARY KEY,
    label text NOT NULL,
    sort_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_config (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text
);

CREATE TABLE IF NOT EXISTS public.facility_product_duration_admission (
    ow_nfz text NOT NULL,
    nip text NOT NULL,
    product_code text NOT NULL,
    duration_group text NOT NULL,
    admission_code integer NOT NULL,
    hosp_sim double precision NOT NULL,
    hosp_min double precision NOT NULL,
    deaths_sim double precision NOT NULL,
    deaths_min double precision NOT NULL,
    PRIMARY KEY (ow_nfz, nip, product_code, duration_group, admission_code),
    FOREIGN KEY (ow_nfz, nip) REFERENCES public.facilities (ow_nfz, nip),
    FOREIGN KEY (product_code) REFERENCES public.products (product_code)
);

CREATE INDEX IF NOT EXISTS idx_serving_product
    ON public.facility_product_duration_admission (product_code);
CREATE INDEX IF NOT EXISTS idx_serving_product_duration
    ON public.facility_product_duration_admission (product_code, duration_group);
CREATE INDEX IF NOT EXISTS idx_serving_product_admission
    ON public.facility_product_duration_admission (product_code, admission_code);
CREATE INDEX IF NOT EXISTS idx_serving_facility
    ON public.facility_product_duration_admission (ow_nfz, nip);
CREATE INDEX IF NOT EXISTS idx_facilities_city
    ON public.facilities (city);

COMMIT;
