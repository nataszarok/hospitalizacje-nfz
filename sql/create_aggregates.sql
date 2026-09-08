-- Materializowane agregaty dla dashboardu Hospitalizacje 2025.
-- URUCHOM PO KAŻDEJ ZMIANIE tabeli hospitalizacje:
--     poetry run python refresh_aggregates.py
-- Aplikacja sama wykrywa nieaktualny agregat przez data_pipeline_status.

DROP TABLE IF EXISTS dashboard_facility_product;
CREATE TABLE dashboard_facility_product AS
SELECT
    OW_NFZ,
    NIP_PODMIOTU,
    KOD_PRODUKTU_JEDNOSTKOWEGO,
    SUM(LICZBA_HOSPITALIZACJI_NUM) AS HOSP_NUM,
    SUM(LICZBA_HOSPITALIZACJI_MIN) AS HOSP_MIN,
    SUM(CASE WHEN KOD_TRYBU_WYPISU = 9 THEN LICZBA_HOSPITALIZACJI_NUM ELSE 0 END) AS DEATHS_NUM,
    SUM(CASE WHEN KOD_TRYBU_WYPISU = 9 THEN LICZBA_HOSPITALIZACJI_MIN ELSE 0 END) AS DEATHS_MIN
FROM hospitalizacje
GROUP BY OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO;
CREATE UNIQUE INDEX idx_dfp_facility_product
ON dashboard_facility_product(OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO);
CREATE INDEX idx_dfp_product ON dashboard_facility_product(KOD_PRODUKTU_JEDNOSTKOWEGO);

DROP TABLE IF EXISTS dashboard_facility_product_admission;
CREATE TABLE dashboard_facility_product_admission AS
SELECT
    OW_NFZ,
    NIP_PODMIOTU,
    KOD_PRODUKTU_JEDNOSTKOWEGO,
    KOD_TRYBU_PRZYJECIA,
    SUM(LICZBA_HOSPITALIZACJI_NUM) AS HOSP_NUM,
    SUM(LICZBA_HOSPITALIZACJI_MIN) AS HOSP_MIN,
    SUM(CASE WHEN KOD_TRYBU_WYPISU = 9 THEN LICZBA_HOSPITALIZACJI_NUM ELSE 0 END) AS DEATHS_NUM,
    SUM(CASE WHEN KOD_TRYBU_WYPISU = 9 THEN LICZBA_HOSPITALIZACJI_MIN ELSE 0 END) AS DEATHS_MIN
FROM hospitalizacje
GROUP BY OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO, KOD_TRYBU_PRZYJECIA;
CREATE UNIQUE INDEX idx_dfpa_facility_product_admission
ON dashboard_facility_product_admission(OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO, KOD_TRYBU_PRZYJECIA);
CREATE INDEX idx_dfpa_product ON dashboard_facility_product_admission(KOD_PRODUKTU_JEDNOSTKOWEGO);
CREATE INDEX idx_dfpa_admission ON dashboard_facility_product_admission(KOD_TRYBU_PRZYJECIA);

CREATE TABLE IF NOT EXISTS data_pipeline_status (
    pipeline_name TEXT PRIMARY KEY,
    needs_refresh INTEGER NOT NULL DEFAULT 1,
    refreshed_at TEXT,
    source_rows INTEGER,
    aggregate_rows INTEGER,
    note TEXT
);
INSERT INTO data_pipeline_status(pipeline_name, needs_refresh, refreshed_at, source_rows, aggregate_rows, note)
VALUES (
    'dashboard_aggregates', 0, datetime('now'),
    (SELECT COUNT(*) FROM hospitalizacje),
    (SELECT COUNT(*) FROM dashboard_facility_product),
    'Agregaty aktualne.'
)
ON CONFLICT(pipeline_name) DO UPDATE SET
    needs_refresh=0, refreshed_at=datetime('now'),
    source_rows=(SELECT COUNT(*) FROM hospitalizacje),
    aggregate_rows=(SELECT COUNT(*) FROM dashboard_facility_product),
    note='Agregaty aktualne.';

DROP TRIGGER IF EXISTS trg_hospitalizacje_dashboard_stale_insert;
DROP TRIGGER IF EXISTS trg_hospitalizacje_dashboard_stale_update;
DROP TRIGGER IF EXISTS trg_hospitalizacje_dashboard_stale_delete;
CREATE TRIGGER trg_hospitalizacje_dashboard_stale_insert AFTER INSERT ON hospitalizacje BEGIN
  UPDATE data_pipeline_status SET needs_refresh=1, note='Zmieniono hospitalizacje. Uruchom: poetry run python refresh_aggregates.py' WHERE pipeline_name='dashboard_aggregates';
END;
CREATE TRIGGER trg_hospitalizacje_dashboard_stale_update AFTER UPDATE ON hospitalizacje BEGIN
  UPDATE data_pipeline_status SET needs_refresh=1, note='Zmieniono hospitalizacje. Uruchom: poetry run python refresh_aggregates.py' WHERE pipeline_name='dashboard_aggregates';
END;
CREATE TRIGGER trg_hospitalizacje_dashboard_stale_delete AFTER DELETE ON hospitalizacje BEGIN
  UPDATE data_pipeline_status SET needs_refresh=1, note='Zmieniono hospitalizacje. Uruchom: poetry run python refresh_aggregates.py' WHERE pipeline_name='dashboard_aggregates';
END;
