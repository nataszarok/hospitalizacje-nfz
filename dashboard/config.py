from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "health_dashboard.db"
SQL_DIR = BASE_DIR / "sql"
AGGREGATES_SQL_PATH = SQL_DIR / "create_aggregates.sql"

@dataclass(frozen=True)
class ReferenceData:
    analysis_year: str
    death_discharge_code: int
    default_product_code: str
    simulation_seed: int
    regions: dict[str, str]
    admission_modes: dict[int, str]
    highlight_colors: list[str]
    product_symbols: list[str]
