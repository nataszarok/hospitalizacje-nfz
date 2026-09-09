from __future__ import annotations
import random
import sqlite3
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DB_PATH = BASE / "health_dashboard.db"
TABLE = "dashboard_facility_product_duration_admission"


def main() -> None:
    con = sqlite3.connect(DB_PATH)
    products = [r[0] for r in con.execute(
        "SELECT KOD_PRODUKTU_JEDNOSTKOWEGO FROM dashboard_facility_product ORDER BY HOSP_MIN DESC LIMIT 30"
    )]
    durations = [r[0] for r in con.execute(
        "SELECT DISTINCT PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI FROM hospitalizacje ORDER BY 1"
    )]
    rng = random.Random(42)
    checks = 0
    for suffix in ("MIN", "NUM"):
        for _ in range(25):
            selected_products = rng.sample(products, rng.randint(1, 3))
            selected_durations = rng.sample(durations, rng.randint(1, len(durations)))
            p_marks = ",".join("?" for _ in selected_products)
            d_marks = ",".join("?" for _ in selected_durations)
            params = selected_products + selected_durations
            raw = con.execute(f"""
                SELECT OW_NFZ,NIP_PODMIOTU,SUM(LICZBA_HOSPITALIZACJI_{suffix}),
                       SUM(CASE WHEN KOD_TRYBU_WYPISU=9 THEN LICZBA_HOSPITALIZACJI_{suffix} ELSE 0 END)
                FROM hospitalizacje
                WHERE KOD_PRODUKTU_JEDNOSTKOWEGO IN ({p_marks})
                  AND PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI IN ({d_marks})
                GROUP BY 1,2 ORDER BY 1,2
            """, params).fetchall()
            serving = con.execute(f"""
                SELECT OW_NFZ,NIP_PODMIOTU,SUM(HOSP_{suffix}),SUM(DEATHS_{suffix})
                FROM {TABLE}
                WHERE KOD_PRODUKTU_JEDNOSTKOWEGO IN ({p_marks})
                  AND PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI IN ({d_marks})
                GROUP BY 1,2 ORDER BY 1,2
            """, params).fetchall()
            assert raw == serving
            checks += 1
            raw_admission = con.execute(f"""
                SELECT OW_NFZ,NIP_PODMIOTU,KOD_TRYBU_PRZYJECIA,SUM(LICZBA_HOSPITALIZACJI_{suffix})
                FROM hospitalizacje
                WHERE KOD_PRODUKTU_JEDNOSTKOWEGO IN ({p_marks})
                  AND PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI IN ({d_marks})
                  AND KOD_TRYBU_PRZYJECIA IN (2,3,6)
                GROUP BY 1,2,3 ORDER BY 1,2,3
            """, params).fetchall()
            serving_admission = con.execute(f"""
                SELECT OW_NFZ,NIP_PODMIOTU,KOD_TRYBU_PRZYJECIA,SUM(HOSP_{suffix})
                FROM {TABLE}
                WHERE KOD_PRODUKTU_JEDNOSTKOWEGO IN ({p_marks})
                  AND PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI IN ({d_marks})
                  AND KOD_TRYBU_PRZYJECIA IN (2,3,6)
                GROUP BY 1,2,3 ORDER BY 1,2,3
            """, params).fetchall()
            assert raw_admission == serving_admission
            checks += 1
    raw_rows = con.execute("SELECT COUNT(*) FROM hospitalizacje").fetchone()[0]
    serving_rows = con.execute(f"SELECT COUNT(*) FROM {TABLE}").fetchone()[0]
    print(f"Parity OK: {checks} scenariuszy")
    print(f"hospitalizacje: {raw_rows:,} wierszy")
    print(f"{TABLE}: {serving_rows:,} wierszy ({serving_rows/raw_rows:.1%} raw)")

if __name__ == "__main__":
    main()
