from pathlib import Path
import sqlite3

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / "health_dashboard.db"
SQL_PATH = BASE / "sql" / "create_aggregates.sql"


def main():
    if not DB_PATH.exists():
        raise SystemExit(f"Brak bazy: {DB_PATH}")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.executescript(SQL_PATH.read_text(encoding="utf-8"))
        conn.execute("ANALYZE dashboard_facility_product")
        conn.execute("ANALYZE dashboard_facility_product_admission")
        row = conn.execute(
            "SELECT source_rows, aggregate_rows, refreshed_at FROM data_pipeline_status WHERE pipeline_name='dashboard_aggregates'"
        ).fetchone()
    print(f"Agregaty gotowe: source_rows={row[0]:,}, facility_product_rows={row[1]:,}, refreshed_at={row[2]}")

if __name__ == "__main__":
    main()
