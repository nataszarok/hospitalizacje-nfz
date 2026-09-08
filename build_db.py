from pathlib import Path
import sqlite3
import zipfile
import numpy as np
import pandas as pd

from dashboard_logic import combine_hospital_sources, deduplicate_hospitals_by_nip, normalize_nip

BASE = Path(__file__).resolve().parent
CSV_ZIP = BASE / 'hospitalizacje_2025.csv.zip'
XLSX = BASE / 'PSZ_Polska_2026_z_NIP(1).xlsx'
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
    conn.commit()
    conn.execute('ANALYZE')
    conn.close()
    print(f'Gotowe: {DB_PATH} ({DB_PATH.stat().st_size/1024/1024:.1f} MB)')

if __name__ == '__main__':
    main()
