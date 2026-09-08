from pathlib import Path
import sqlite3
import zipfile
import numpy as np
import pandas as pd

from dashboard_logic import combine_hospital_sources, deduplicate_hospitals_by_nip, normalize_nip

BASE = Path(__file__).resolve().parent
CSV_ZIP = BASE / 'hospitalizacje_2025.csv.zip'
XLSX = BASE / 'PSZ_Polska_2026_z_NIP(1).xlsx'
PRODUCT_MAP = BASE / 'kody_produktu_jgp.csv'
DB_PATH = BASE / 'health_dashboard.db'
CSV_MEMBER = 'hospitalizacje_2025.csv'
CHUNK_SIZE = 200_000
SEED = 42

RAW_COLUMNS = [
    'ROK','MIESIAC','OW_NFZ','NIP_PODMIOTU','KOD_PRODUKTU_KONTRAKTOWEGO',
    'KOD_PRODUKTU_JEDNOSTKOWEGO','KOD_TRYBU_PRZYJECIA','KOD_TRYBU_WYPISU',
    'PLEC_PACJENTA','GRUPA_WIEKOWA_PACJENTA','PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI',
    'LICZBA_HOSPITALIZACJI'
]

def norm_nip(s: pd.Series) -> pd.Series:
    return normalize_nip(s)


def write_reference_tables(conn: sqlite3.Connection):
    """Zapisuje słowniki i konfigurację używane przez aplikację do SQLite."""
    config = [
        ('analysis_year', '2025', 'Rok danych prezentowanych w panelu'),
        ('death_discharge_code', '9', 'Kod trybu wypisu oznaczający zgon'),
        ('default_product_code', '5.51.01.0005010', 'Domyślnie wybrany produkt jednostkowy (E10)'),
        ('simulation_seed', str(SEED), 'Seed użyty przy jednorazowym losowaniu wartości 1–4 dla <5'),
        ('suppressed_min', '1', 'Dolna wartość zastępująca <5'),
        ('suppressed_max', '4', 'Górna wartość zastępująca <5'),
        ('suppressed_weight_formula', 'exp(-x)', 'Wagi losowania wartości 1–4 dla <5'),
    ]
    conn.execute('DROP TABLE IF EXISTS app_config')
    conn.execute('CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT)')
    conn.executemany('INSERT INTO app_config VALUES (?,?,?)', config)

    regions = [
        ('01','Dolnośląskie',1), ('02','Kujawsko-Pomorskie',2), ('03','Lubelskie',3),
        ('04','Lubuskie',4), ('05','Łódzkie',5), ('06','Małopolskie',6),
        ('07','Mazowieckie',7), ('08','Opolskie',8), ('09','Podkarpackie',9),
        ('10','Podlaskie',10), ('11','Pomorskie',11), ('12','Śląskie',12),
        ('13','Świętokrzyskie',13), ('14','Warmińsko-Mazurskie',14),
        ('15','Wielkopolskie',15), ('16','Zachodniopomorskie',16),
    ]
    conn.execute('DROP TABLE IF EXISTS nfz_regions')
    conn.execute('CREATE TABLE nfz_regions (ow_nfz TEXT PRIMARY KEY, wojewodztwo TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL)')
    conn.executemany('INSERT INTO nfz_regions VALUES (?,?,?)', regions)

    admissions = [
        (2, 'Przyjęcie w trybie nagłym w wyniku przekazania przez zespół ratownictwa medycznego', 1),
        (3, 'Przyjęcie w trybie nagłym – inne przypadki', 2),
        (5, 'Przyjęcie noworodka w wyniku porodu w tym szpitalu', 3),
        (6, 'Przyjęcie planowe na podstawie skierowania', 4),
        (7, 'Przyjęcie planowe osoby korzystającej ze świadczeń poza kolejnością na podstawie ustawowych uprawnień', 5),
        (8, 'Przeniesienie z innego szpitala', 6),
        (9, 'Przyjęcie osoby podlegającej obowiązkowemu leczeniu', 7),
        (10, 'Przyjęcie przymusowe', 8),
        (11, 'Przyjęcie na podstawie karty diagnostyki i leczenia onkologicznego', 9),
    ]
    conn.execute('DROP TABLE IF EXISTS admission_modes')
    conn.execute('CREATE TABLE admission_modes (code INTEGER PRIMARY KEY, label TEXT NOT NULL, sort_order INTEGER NOT NULL)')
    conn.executemany('INSERT INTO admission_modes VALUES (?,?,?)', admissions)

    colors = ['#2563EB','#DC2626','#16A34A','#9333EA','#EA580C','#0891B2','#DB2777','#65A30D','#4F46E5','#CA8A04','#0F766E','#7C3AED','#B91C1C','#0369A1','#15803D','#A21CAF']
    conn.execute('DROP TABLE IF EXISTS highlight_palette')
    conn.execute('CREATE TABLE highlight_palette (position INTEGER PRIMARY KEY, color TEXT NOT NULL)')
    conn.executemany('INSERT INTO highlight_palette VALUES (?,?)', list(enumerate(colors, 1)))

    symbols = ['circle','diamond','square','triangle-up','cross','x','triangle-down','star','hexagon','pentagon']
    conn.execute('DROP TABLE IF EXISTS product_symbols')
    conn.execute('CREATE TABLE product_symbols (position INTEGER PRIMARY KEY, symbol TEXT NOT NULL)')
    conn.executemany('INSERT INTO product_symbols VALUES (?,?)', list(enumerate(symbols, 1)))

    products = pd.read_csv(PRODUCT_MAP, encoding='utf-8-sig', dtype=str)
    products = products[['KOD_PRODUKTU_JEDNOSTKOWEGO','KOD_JGP','NAZWA']].dropna(subset=['KOD_PRODUKTU_JEDNOSTKOWEGO'])
    products = products.drop_duplicates('KOD_PRODUKTU_JEDNOSTKOWEGO')
    products.to_sql('produkty_jgp', conn, index=False, if_exists='replace')
    conn.execute('CREATE UNIQUE INDEX idx_produkty_jgp_code ON produkty_jgp(KOD_PRODUKTU_JEDNOSTKOWEGO)')


def rebuild_filter_values(conn: sqlite3.Connection):
    """Buduje słownik wartości filtrów z tabeli hospitalizacje."""
    conn.execute('DROP TABLE IF EXISTS filter_values')
    conn.execute('CREATE TABLE filter_values (column_name TEXT NOT NULL, value_text TEXT, value_num REAL)')
    text_cols = [
        'KOD_PRODUKTU_JEDNOSTKOWEGO', 'KOD_PRODUKTU_KONTRAKTOWEGO', 'OW_NFZ',
        'PLEC_PACJENTA', 'GRUPA_WIEKOWA_PACJENTA', 'PRZEDZIAL_DLUGOSCI_TRWANIA_HOSPITALIZACJI',
    ]
    num_cols = ['KOD_TRYBU_PRZYJECIA', 'KOD_TRYBU_WYPISU', 'MIESIAC']
    for col in text_cols:
        sql = 'INSERT INTO filter_values(column_name, value_text) SELECT ?, CAST("' + col + '" AS TEXT) FROM hospitalizacje WHERE "' + col + '" IS NOT NULL GROUP BY "' + col + '"'
        conn.execute(sql, (col,))
    for col in num_cols:
        sql = 'INSERT INTO filter_values(column_name, value_num) SELECT ?, CAST("' + col + '" AS REAL) FROM hospitalizacje WHERE "' + col + '" IS NOT NULL GROUP BY "' + col + '"'
        conn.execute(sql, (col,))
    conn.execute('CREATE INDEX idx_filter_values_column ON filter_values(column_name)')


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=OFF;')
    conn.execute('PRAGMA synchronous=OFF;')
    conn.execute('PRAGMA temp_store=MEMORY;')

    # Hospital metadata from XLSX
    sz = pd.read_excel(XLSX, sheet_name='PSZ Polska')
    keep = [c for c in ['NIP','Świadczeniodawca','Województwo','Miejscowość','Poziom PSZ','Nazwa zakładu leczniczego'] if c in sz.columns]
    sz = sz[keep].copy()
    sz['NIP'] = norm_nip(sz['NIP'])
    sz = sz[sz['NIP'].str.len().eq(10)].copy()
    sz.to_sql('szpitale', conn, index=False, if_exists='replace')

    # Dedup exactly at NIP level, analogous to the notebook logic.
    sz_psz_unique = deduplicate_hospitals_by_nip(sz)
    sz_psz_unique.to_sql('szpitale_psz_unique', conn, index=False, if_exists='replace')

    supplement_path = BASE / 'szpitale_uzupelnienie.csv'
    if supplement_path.exists():
        supp = pd.read_csv(supplement_path, dtype={'NIP': 'string'})
        supp['NIP'] = norm_nip(supp['NIP'])
        supp = supp[['NIP','Świadczeniodawca','Miejscowość']].drop_duplicates('NIP', keep='first')
    else:
        supp = pd.DataFrame(columns=['NIP','Świadczeniodawca','Miejscowość'])
    supp.to_sql('szpitale_uzupelnienie', conn, index=False, if_exists='replace')

    combined = combine_hospital_sources(sz_psz_unique, supp)
    combined.to_sql('szpitale_laczone', conn, index=False, if_exists='replace')

    rng = np.random.default_rng(SEED)
    wartosci = np.array([1,2,3,4])
    wagi = np.exp(-wartosci)
    p = wagi / wagi.sum()

    first = True
    total = 0
    with zipfile.ZipFile(CSV_ZIP) as z, z.open(CSV_MEMBER) as f:
        for chunk in pd.read_csv(
            f, sep=';', dtype={
                'OW_NFZ':'string','NIP_PODMIOTU':'string',
                'KOD_PRODUKTU_KONTRAKTOWEGO':'string','KOD_PRODUKTU_JEDNOSTKOWEGO':'string',
                'LICZBA_HOSPITALIZACJI':'string'
            }, chunksize=CHUNK_SIZE, low_memory=False
        ):
            chunk = chunk[RAW_COLUMNS].copy()
            chunk['NIP_PODMIOTU'] = norm_nip(chunk['NIP_PODMIOTU'])
            chunk['OW_NFZ'] = chunk['OW_NFZ'].astype('string').str.zfill(2)
            chunk['KOD_PRODUKTU_JEDNOSTKOWEGO'] = chunk['KOD_PRODUKTU_JEDNOSTKOWEGO'].astype('string')
            raw_hosp = chunk['LICZBA_HOSPITALIZACJI'].astype('string').str.strip()
            maska = raw_hosp.eq('<5').fillna(False)
            num = pd.to_numeric(raw_hosp, errors='coerce').astype('float64')
            num_min = num.copy()
            if maska.any():
                num.loc[maska] = rng.choice(wartosci, size=int(maska.sum()), p=p)
                num_min.loc[maska] = 1
            chunk['LICZBA_HOSPITALIZACJI_NUM'] = num.fillna(0)
            chunk['LICZBA_HOSPITALIZACJI_MIN'] = num_min.fillna(0)
            chunk.to_sql('hospitalizacje', conn, index=False, if_exists='replace' if first else 'append', chunksize=5_000)
            first = False
            total += len(chunk)
            print(f'Zaimportowano {total:,} rekordów')

    print('Tworzenie indeksów...')
    indexes = [
        ('idx_h_prod_jedn','KOD_PRODUKTU_JEDNOSTKOWEGO'),
        ('idx_h_prod_kontr','KOD_PRODUKTU_KONTRAKTOWEGO'),
        ('idx_h_tryb_przyj','KOD_TRYBU_PRZYJECIA'),
        ('idx_h_tryb_wyp','KOD_TRYBU_WYPISU'),
        ('idx_h_nip','NIP_PODMIOTU'),
        ('idx_h_ow','OW_NFZ'),
        ('idx_h_miesiac','MIESIAC'),
    ]
    for name, col in indexes:
        conn.execute(f'CREATE INDEX {name} ON hospitalizacje("{col}")')
    conn.execute('CREATE INDEX idx_szpitale_nip ON szpitale(NIP)')
    conn.execute('CREATE UNIQUE INDEX idx_szpitale_psz_unique_nip ON szpitale_psz_unique(NIP)')
    conn.execute('CREATE UNIQUE INDEX idx_szpitale_uzupelnienie_nip ON szpitale_uzupelnienie(NIP)')
    conn.execute('CREATE UNIQUE INDEX idx_szpitale_laczone_nip ON szpitale_laczone(NIP)')
    rebuild_filter_values(conn)
    write_reference_tables(conn)
    conn.commit()
    conn.execute('ANALYZE')
    conn.close()
    print(f'Gotowe: {DB_PATH} ({DB_PATH.stat().st_size/1024/1024:.1f} MB)')

if __name__ == '__main__':
    main()
