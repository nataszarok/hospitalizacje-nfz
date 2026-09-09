from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DB_PATH = BASE / "health_dashboard.db"
OUT_DIR = BASE / "data_exports" / "supabase"

EXPORTS = {
    "facilities.csv": """
        SELECT oddzial_nfz, nip,
               COALESCE(NULLIF(TRIM(swiadczeniodawca_wyswietlany), ''), swiadczeniodawca) AS provider_name,
               swiadczeniodawca AS provider_name_official,
               miejscowosc, kod, regon, kod_pocztowy, ulica, gmina, telefon
        FROM nfz_swiadczeniodawcy_unique s
        WHERE EXISTS (
            SELECT 1 FROM dashboard_facility_product_duration_admission d
            WHERE d.OW_NFZ=s.oddzial_nfz AND d.NIP_PODMIOTU=s.nip
        )
        ORDER BY oddzial_nfz, nip
    """,
    "products.csv": """
        SELECT KOD_PRODUKTU_JEDNOSTKOWEGO, KOD_JGP, NAZWA
        FROM produkty_jgp
        WHERE KOD_PRODUKTU_JEDNOSTKOWEGO IN (
            SELECT DISTINCT KOD_PRODUKTU_JEDNOSTKOWEGO
            FROM dashboard_facility_product_duration_admission
        )
        ORDER BY KOD_PRODUKTU_JEDNOSTKOWEGO
    """,
    "population_voivodeship.csv": """
        SELECT ow_nfz, wojewodztwo, population, reference_date, source_year,
               source_publication, source_table, source_sheet, source_unit,
               source_url, source_file
        FROM population_voivodeship ORDER BY ow_nfz
    """,
    "nfz_regions.csv": "SELECT ow_nfz, wojewodztwo, sort_order FROM nfz_regions ORDER BY sort_order",
    "admission_modes.csv": "SELECT code, label, sort_order FROM admission_modes ORDER BY sort_order",
    "app_config.csv": "SELECT key, value, description FROM app_config ORDER BY key",
    "facility_product_duration_admission.csv": """
        SELECT OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO,
               PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI, KOD_TRYBU_PRZYJECIA,
               HOSP_NUM, HOSP_MIN, DEATHS_NUM, DEATHS_MIN
        FROM dashboard_facility_product_duration_admission
        ORDER BY OW_NFZ, NIP_PODMIOTU, KOD_PRODUKTU_JEDNOSTKOWEGO,
                 PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI, KOD_TRYBU_PRZYJECIA
    """,
}

HEADERS = {
    "facilities.csv": ["ow_nfz","nip","provider_name","provider_name_official","city","provider_code","regon","postal_code","street","municipality","phone"],
    "products.csv": ["product_code","jgp_code","product_name"],
    "population_voivodeship.csv": ["ow_nfz","voivodeship","population","reference_date","source_year","source_publication","source_table","source_sheet","source_unit","source_url","source_file"],
    "nfz_regions.csv": ["ow_nfz","voivodeship","sort_order"],
    "admission_modes.csv": ["code","label","sort_order"],
    "app_config.csv": ["key","value","description"],
    "facility_product_duration_admission.csv": ["ow_nfz","nip","product_code","duration_group","admission_code","hosp_sim","hosp_min","deaths_sim","deaths_min"],
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        for filename, query in EXPORTS.items():
            path = OUT_DIR / filename
            cur = conn.execute(query)
            count = 0
            with path.open("w", encoding="utf-8", newline="") as fh:
                writer = csv.writer(fh)
                writer.writerow(HEADERS[filename])
                for row in cur:
                    writer.writerow(row)
                    count += 1
            print(f"{filename}: {count:,} rows")

    print(f"Export ready: {OUT_DIR}")


if __name__ == "__main__":
    main()
