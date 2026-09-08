DROP TABLE IF EXISTS population_voivodeship;

CREATE TABLE population_voivodeship (
    ow_nfz TEXT PRIMARY KEY,
    wojewodztwo TEXT NOT NULL UNIQUE,
    population INTEGER NOT NULL CHECK (population > 0),
    reference_date TEXT NOT NULL,
    source_year INTEGER NOT NULL,
    source_publication TEXT NOT NULL,
    source_table TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    source_unit TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_file TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ow_nfz) REFERENCES nfz_regions(ow_nfz)
);

CREATE INDEX idx_population_voivodeship_name
    ON population_voivodeship(wojewodztwo);
