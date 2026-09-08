"""Import ludności województw z arkusza GUS do SQLite.

Źródło:
Rocznik Statystyczny Województw 2025, Dział IV. Ludność,
arkusz "1 (19)", TABL. 1 (19). LUDNOŚĆ W 2024 R., stan w dniu 31 grudnia.
Kolumna "Ogółem" jest podana w tysiącach osób.
"""
from __future__ import annotations

from pathlib import Path
import sqlite3
import unicodedata

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = BASE_DIR / "data_sources" / "gus" / "Dzial_04_Ludnosc.xlsx"
DB_PATH = BASE_DIR / "health_dashboard.db"
SQL_PATH = BASE_DIR / "db_build" / "sql" / "create_population.sql"

SOURCE_URL = (
    "https://stat.gov.pl/obszary-tematyczne/roczniki-statystyczne/"
    "roczniki-statystyczne/rocznik-statystyczny-wojewodztw-2025,4,20.html"
)
SOURCE_PUBLICATION = "Rocznik Statystyczny Województw 2025"
SOURCE_TABLE = "TABL. 1 (19). LUDNOŚĆ W 2024 R. — Stan w dniu 31 grudnia"
SOURCE_SHEET = "1 (19)"
REFERENCE_DATE = "2024-12-31"
SOURCE_YEAR = 2024
SOURCE_UNIT = "tys. osób"


def _norm(value: object) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.translate(str.maketrans({"ł": "l", "Ł": "L"}))
    return " ".join(text.lower().replace("-", " ").split())


def extract_population(xlsx_path: Path) -> tuple[pd.DataFrame, int]:
    raw = pd.read_excel(xlsx_path, sheet_name=SOURCE_SHEET, header=None)
    if raw.shape[1] < 2:
        raise ValueError("Arkusz GUS nie zawiera oczekiwanych kolumn A:B.")

    country_total = None
    rows: list[tuple[str, int]] = []
    for _, row in raw.iloc[:, :2].iterrows():
        name = row.iloc[0]
        value = row.iloc[1]
        if pd.isna(name) or pd.isna(value):
            continue
        normalized = _norm(name)
        try:
            population = int(round(float(value) * 1000))
        except (TypeError, ValueError):
            continue
        if normalized.startswith("polska"):
            country_total = population
        elif normalized in {
            "dolnoslaskie", "kujawsko pomorskie", "lubelskie", "lubuskie",
            "lodzkie", "malopolskie", "mazowieckie", "opolskie", "podkarpackie",
            "podlaskie", "pomorskie", "slaskie", "swietokrzyskie",
            "warminsko mazurskie", "wielkopolskie", "zachodniopomorskie",
        }:
            rows.append((str(name).strip(), population))

    if country_total is None:
        raise ValueError("Nie znaleziono wiersza POLSKA w pierwszej tabeli GUS.")
    if len(rows) != 16:
        raise ValueError(f"Oczekiwano 16 województw, znaleziono {len(rows)}.")

    return pd.DataFrame(rows, columns=["wojewodztwo_gus", "population"]), country_total


def import_population(xlsx_path: Path = DEFAULT_XLSX, db_path: Path = DB_PATH) -> None:
    population, country_total = extract_population(xlsx_path)

    with sqlite3.connect(db_path) as con:
        regions = pd.read_sql_query(
            "SELECT ow_nfz, wojewodztwo FROM nfz_regions ORDER BY sort_order",
            con,
            dtype={"ow_nfz": str, "wojewodztwo": str},
        )
        regions["key"] = regions["wojewodztwo"].map(_norm)
        population["key"] = population["wojewodztwo_gus"].map(_norm)
        merged = regions.merge(population[["key", "population"]], on="key", how="left", validate="one_to_one")
        if merged["population"].isna().any():
            missing = merged.loc[merged["population"].isna(), "wojewodztwo"].tolist()
            raise ValueError(f"Brak danych ludności dla: {missing}")

        province_sum = int(merged["population"].sum())
        if abs(province_sum - country_total) > 1000:
            raise ValueError(
                f"Suma województw ({province_sum}) nie zgadza się z Polską ({country_total})."
            )

        con.executescript(SQL_PATH.read_text(encoding="utf-8"))
        payload = [
            (
                row.ow_nfz,
                row.wojewodztwo,
                int(row.population),
                REFERENCE_DATE,
                SOURCE_YEAR,
                SOURCE_PUBLICATION,
                SOURCE_TABLE,
                SOURCE_SHEET,
                SOURCE_UNIT,
                SOURCE_URL,
                xlsx_path.name,
            )
            for row in merged.itertuples(index=False)
        ]
        con.executemany(
            """
            INSERT INTO population_voivodeship (
                ow_nfz, wojewodztwo, population, reference_date, source_year,
                source_publication, source_table, source_sheet, source_unit,
                source_url, source_file
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            payload,
        )
        con.commit()

    print(
        f"Zaimportowano {len(payload)} województw do {db_path.name}; "
        f"suma ludności={province_sum:,}, Polska={country_total:,}."
    )


if __name__ == "__main__":
    import_population()
