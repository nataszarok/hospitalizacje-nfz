from __future__ import annotations

import argparse
import sqlite3
import re
from pathlib import Path

import pandas as pd

from dashboard.domain.preprocessing import NFZ_PROVIDER_COLUMNS, prepare_nfz_providers

BASE = Path(__file__).resolve().parents[1]
DEFAULT_CSV = BASE / "data_sources" / "nfz_swiadczeniodawcy_2025.csv"
DEFAULT_DB = BASE / "health_dashboard.db"
TABLE_NAME = "nfz_swiadczeniodawcy_unique"
EXPECTED_COLUMNS = NFZ_PROVIDER_COLUMNS

# Ręczne uzupełnienia dla par (OW_NFZ, NIP) występujących w hospitalizacje,
# których nie ma w źródłowym CSV NFZ 2025.
MANUAL_ROWS = [
    {
        "nip": "6151706942",
        "swiadczeniodawca": (
            "WIELOSPECJALISTYCZNY SZPITAL - SAMODZIELNY PUBLICZNY ZESPÓŁ "
            "OPIEKI ZDROWOTNEJ W ZGORZELCU"
        ),
        "miejscowosc": "ZGORZELEC",
        "kod": "3401029",
        "regon": "231161448",
        "kod_pocztowy": "59900",
        "ulica": "UL. LUBAŃSKA 11-12",
        "gmina": "0225021",
        "oddzial_nfz": "01",
        "telefon": "+48 75 772 29 00",
    },
    {
        "nip": "5422208990",
        "swiadczeniodawca": (
            "NIEPUBLICZNY ZAKŁAD OPIEKI ZDROWOTNEJ SPECJALISTYCZNA PORADNIA "
            "LEKARSKA DR N. MED. ADRIAN WOJCIECH PRZYSTUPA"
        ),
        "miejscowosc": "BIELSK PODLASKI",
        "kod": "100003731",
        "regon": "200236185",
        "kod_pocztowy": "17100",
        "ulica": "ALEJA JÓZEFA PIŁSUDSKIEGO 31",
        "gmina": "2003011",
        "oddzial_nfz": "10",
        "telefon": "85 675 97 40",
    },
]

# Korekta błędnego oddziału NFZ w pliku źródłowym. W hospitalizacje podmiot
# 6121542507 występuje w OW_NFZ=01; źródłowy CSV przypisuje go do 04,
# mimo że ZOZ w Bolesławcu należy do woj. dolnośląskiego.

# NFZ czasem zapisuje dzielnicę/delegaturę jako miejscowość. Dashboard ma
# prezentować miasta, więc te wartości normalizujemy do miasta nadrzędnego.
CITY_EXACT_OVERRIDES = {
    "MOKOTÓW": "WARSZAWA",
    "WARSZAWA WOLA": "WARSZAWA",
}
CITY_PREFIX_OVERRIDES = {
    "POZNAŃ-": "POZNAŃ",
    "WROCŁAW-": "WROCŁAW",
    "ŁÓDŹ-": "ŁÓDŹ",
}


def normalize_provider_cities(providers: pd.DataFrame) -> pd.DataFrame:
    """Zamień dzielnice zapisane w polu miejscowość na właściwe miasta."""
    work = providers.copy()
    city = work["miejscowosc"].astype("string").str.strip().str.upper()
    city = city.replace(CITY_EXACT_OVERRIDES)
    for prefix, parent_city in CITY_PREFIX_OVERRIDES.items():
        city = city.mask(city.str.startswith(prefix, na=False), parent_city)
    work["miejscowosc"] = city
    return work


# Formy prawne nie są użyteczne w dashboardzie, ale zachowujemy oficjalną
# nazwę NFZ w kolumnie ``swiadczeniodawca``. Oczyszczona wersja trafia do
# osobnej kolumny ``swiadczeniodawca_wyswietlany``.
LEGAL_FORM_PATTERNS = [
    r"PROSTA\s+SPÓŁKA\s+AKCYJNA",
    r"SPÓŁKA\s+KOMANDYTOWO[- ]AKCYJNA",
    r"SPÓŁKA\s+Z\s+OGRANICZONĄ\s+ODPOWIEDZIALNOŚCIĄ",
    r"SPÓŁKA\s+AKCYJNA",
    r"SPÓŁKA\s+KOMANDYTOWA",
    r"SPÓŁKA\s+JAWNA",
    r"SPÓŁKA\s+PARTNERSKA",
    r"SPÓŁKA\s+CYWILNA",
    r"\bSP\.?\s*Z\.?\s*O\.?\s*O\.?\b",
    r"\bSP\.?\s*K\.?\b",
    r"S\.\s*A\.",
    r"S\.\s*C\.",
]
LEGAL_FORM_RE = re.compile(
    r"(?:" + "|".join(LEGAL_FORM_PATTERNS) + r")",
    flags=re.IGNORECASE,
)


def normalize_provider_name_for_display(value: object) -> str:
    """Usuń formę prawną i techniczną interpunkcję z nazwy do prezentacji."""
    if value is None or pd.isna(value):
        return ""
    name = str(value).strip()
    name = LEGAL_FORM_RE.sub(" ", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\s+([,;:.])", r"\1", name)
    name = re.sub(r"([,;:/-])(?:\s*[,;:/-])+", r"\1", name)
    name = name.strip(" \t\r\n,;:.-/")
    return name or str(value).strip().rstrip(" ,;:")

BRANCH_OVERRIDES = {
    "6121542507": "01",
    # Dwa ręcznie dodawane rekordy są wpisane jawnie również tutaj, aby
    # przyszłe wersje CSV nie mogły nadpisać ich nieprawidłowym OW.
    "6151706942": "01",
    "5422208990": "10",
}


def prepare_provider_dataframe(csv_path: Path | str = DEFAULT_CSV) -> pd.DataFrame:
    """Wczytaj, popraw i zdeduplikuj słownik świadczeniodawców NFZ 2025."""
    csv_path = Path(csv_path)
    raw = pd.read_csv(csv_path, dtype="string")
    providers = prepare_nfz_providers(
        raw,
        manual_rows=MANUAL_ROWS,
        branch_overrides=BRANCH_OVERRIDES,
    )
    providers = normalize_provider_cities(providers)
    providers["swiadczeniodawca_wyswietlany"] = providers["swiadczeniodawca"].map(
        normalize_provider_name_for_display
    )
    manual_nips = {row["nip"] for row in MANUAL_ROWS}
    manual_check = providers[providers["nip"].isin(manual_nips)]
    if len(manual_check) != len(manual_nips) or (manual_check[EXPECTED_COLUMNS] == "").any().any():
        raise RuntimeError("Ręcznie uzupełnione rekordy muszą mieć dane we wszystkich kolumnach")
    return providers


def write_provider_table(conn: sqlite3.Connection, providers: pd.DataFrame) -> None:
    """Zapisz finalny słownik 1:1 do SQLite, nie usuwając starych tabel."""
    providers.to_sql(TABLE_NAME, conn, index=False, if_exists="replace")
    conn.execute(
        f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{TABLE_NAME}_ow_nip "
        f"ON {TABLE_NAME}(oddzial_nfz, nip)"
    )
    conn.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{TABLE_NAME}_nip ON {TABLE_NAME}(nip)"
    )


def verify_hospital_join(conn: sqlite3.Connection) -> dict[str, int]:
    """Sprawdź, że join 1:1 pokrywa hospitalizacje bez multiplikowania wierszy."""
    hospital_rows = int(conn.execute("SELECT COUNT(*) FROM hospitalizacje").fetchone()[0])
    hospital_pairs = int(
        conn.execute(
            "SELECT COUNT(*) FROM ("
            "SELECT OW_NFZ, NIP_PODMIOTU FROM hospitalizacje "
            "GROUP BY OW_NFZ, NIP_PODMIOTU)"
        ).fetchone()[0]
    )
    matched_pairs = int(
        conn.execute(
            f"SELECT COUNT(*) FROM ("
            f"SELECT h.OW_NFZ, h.NIP_PODMIOTU "
            f"FROM hospitalizacje h "
            f"JOIN {TABLE_NAME} s "
            f"  ON s.oddzial_nfz = h.OW_NFZ "
            f" AND s.nip = CAST(h.NIP_PODMIOTU AS TEXT) "
            f"GROUP BY h.OW_NFZ, h.NIP_PODMIOTU)"
        ).fetchone()[0]
    )
    unmatched_pairs = hospital_pairs - matched_pairs
    joined_rows = int(
        conn.execute(
            f"SELECT COUNT(*) FROM hospitalizacje h "
            f"LEFT JOIN {TABLE_NAME} s "
            f"  ON s.oddzial_nfz = h.OW_NFZ "
            f" AND s.nip = CAST(h.NIP_PODMIOTU AS TEXT)"
        ).fetchone()[0]
    )
    duplicate_provider_keys = int(
        conn.execute(
            f"SELECT COUNT(*) FROM ("
            f"SELECT oddzial_nfz, nip, COUNT(*) n FROM {TABLE_NAME} "
            f"GROUP BY oddzial_nfz, nip HAVING COUNT(*) > 1)"
        ).fetchone()[0]
    )

    result = {
        "hospital_rows": hospital_rows,
        "joined_rows": joined_rows,
        "hospital_pairs": hospital_pairs,
        "matched_pairs": matched_pairs,
        "unmatched_pairs": unmatched_pairs,
        "duplicate_provider_keys": duplicate_provider_keys,
    }
    if joined_rows != hospital_rows:
        raise RuntimeError(
            f"Join zwielokrotnia rekordy: hospitalizacje={hospital_rows}, join={joined_rows}"
        )
    if unmatched_pairs != 0:
        raise RuntimeError(f"Brak metadanych dla {unmatched_pairs} par (OW_NFZ, NIP)")
    if duplicate_provider_keys != 0:
        raise RuntimeError("Tabela świadczeniodawców nie jest unikalna po (oddzial_nfz, nip)")
    return result


def import_to_db(
    csv_path: Path | str = DEFAULT_CSV,
    db_path: Path | str = DEFAULT_DB,
    verify: bool = True,
) -> dict[str, int] | None:
    providers = prepare_provider_dataframe(csv_path)
    db_path = Path(db_path)
    with sqlite3.connect(db_path) as conn:
        write_provider_table(conn, providers)
        result = verify_hospital_join(conn) if verify else None
        conn.commit()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import i deduplikacja świadczeniodawców NFZ 2025 do health_dashboard.db"
    )
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--no-verify", action="store_true")
    args = parser.parse_args()

    result = import_to_db(args.csv, args.db, verify=not args.no_verify)
    providers = prepare_provider_dataframe(args.csv)
    print(f"Zapisano {len(providers):,} unikalnych par (oddzial_nfz, nip) do {TABLE_NAME}.")
    if result:
        print(
            "Weryfikacja joinu: "
            f"{result['matched_pairs']:,}/{result['hospital_pairs']:,} par, "
            f"{result['joined_rows']:,}/{result['hospital_rows']:,} wierszy, "
            f"braki={result['unmatched_pairs']}, duplikaty klucza={result['duplicate_provider_keys']}."
        )


if __name__ == "__main__":
    main()
